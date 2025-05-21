use futures::Stream;
use std::os::windows::prelude::AsRawHandle as _;
use std::{
    io,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    task::{Context, Poll},
};
use tokio::{
    net::windows::named_pipe::{NamedPipeServer, ServerOptions},
    select,
};
use tokio_util::sync::CancellationToken;
use windows::Win32::{Foundation::HANDLE, System::Pipes::GetNamedPipeClientProcessId};

use crate::ssh_agent::peerinfo::{self, models::PeerInfo};

const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

#[pin_project::pin_project]
pub struct NamedPipeServerStream {
    rx: tokio::sync::mpsc::Receiver<(NamedPipeServer, PeerInfo)>,
}

impl NamedPipeServerStream {
    pub fn new(cancellation_token: CancellationToken, is_running: Arc<AtomicBool>) -> Self {
        let (tx, rx) = tokio::sync::mpsc::channel(16);
        tokio::spawn(async move {
            println!(
                "[SSH Agent Native Module] Creating named pipe server on {}",
                PIPE_NAME
            );
            let mut listener = match ServerOptions::new().create(PIPE_NAME) {
                Ok(pipe) => pipe,
                Err(err) => {
                    println!("[SSH Agent Native Module] Encountered an error creating the first pipe. The system's openssh service must likely be disabled");
                    println!("[SSH Agent Natvie Module] error: {}", err);
                    cancellation_token.cancel();
                    is_running.store(false, Ordering::Relaxed);
                    return;
                }
            };
            loop {
                println!("[SSH Agent Native Module] Waiting for connection");
                select! {
                    _ = cancellation_token.cancelled() => {
                        println!("[SSH Agent Native Module] Cancellation token triggered, stopping named pipe server");
                        break;
                    }
                    _ = listener.connect() => {
                        println!("[SSH Agent Native Module] Incoming connection");
                        let handle = HANDLE(listener.as_raw_handle());
                        let mut pid = 0;
                        unsafe {
                            if let Err(e) = GetNamedPipeClientProcessId(handle, &mut pid) {
                                println!("Error getting named pipe client process id {}", e);
                                continue
                            }
                        };

                        let peer_info = peerinfo::gather::get_peer_info(pid);
                        let peer_info = match peer_info {
                            Err(err) => {
                                println!("Failed getting process info for pid {} {}", pid, err);
                                continue
                            },
                            Ok(info) => info,
                        };

                        tx.send((listener, peer_info)).await.unwrap();

                        listener = match ServerOptions::new().create(PIPE_NAME) {
                            Ok(pipe) => pipe,
                            Err(err) => {
                                println!("[SSH Agent Native Module] Encountered an error creating a new pipe {}", err);
                                cancellation_token.cancel();
                                is_running.store(false, Ordering::Relaxed);
                                return;
                            }
                        };
                    }
                }
            }
        });
        Self { rx }
    }
}

impl Stream for NamedPipeServerStream {
    type Item = io::Result<(NamedPipeServer, PeerInfo)>;

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<io::Result<(NamedPipeServer, PeerInfo)>>> {
        let this = self.project();

        this.rx.poll_recv(cx).map(|v| v.map(Ok))
    }
}
