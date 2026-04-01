use std::{
    io,
    os::windows::prelude::AsRawHandle as _,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    task::{Context, Poll},
};

use futures::Stream;
use tokio::{
    net::windows::named_pipe::{NamedPipeServer, ServerOptions},
    select,
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};
use windows::Win32::{Foundation::HANDLE, System::Pipes::GetNamedPipeClientProcessId};

use crate::ssh_agent::peerinfo::{self, models::PeerInfo};

const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

#[pin_project::pin_project]
pub struct NamedPipeServerStream {
    rx: tokio::sync::mpsc::Receiver<(NamedPipeServer, PeerInfo)>,
}

impl NamedPipeServerStream {
    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    pub fn new(cancellation_token: CancellationToken, is_running: Arc<AtomicBool>) -> Self {
        let (tx, rx) = tokio::sync::mpsc::channel(16);
        tokio::spawn(async move {
            info!("Creating named pipe server on {}", PIPE_NAME);
            let mut listener = match ServerOptions::new().create(PIPE_NAME) {
                Ok(pipe) => pipe,
                Err(e) => {
                    error!(error = %e, "Encountered an error creating the first pipe. The system's openssh service must likely be disabled");
                    cancellation_token.cancel();
                    is_running.store(false, Ordering::Relaxed);
                    return;
                }
            };
            loop {
                info!("Waiting for connection");
                select! {
                    _ = cancellation_token.cancelled() => {
                        info!("[SSH Agent Native Module] Cancellation token triggered, stopping named pipe server");
                        break;
                    }
                    _ = listener.connect() => {
                        info!("[SSH Agent Native Module] Incoming connection");
                        let handle = HANDLE(listener.as_raw_handle());
                        let mut pid = 0;
                        let peer_info = unsafe {
                            GetNamedPipeClientProcessId(handle, &mut pid)
                        }
                        .map_err(|e| {
                            error!(error = %e, pid, "Failed to get named pipe client process id");
                            e
                        })
                        .ok()
                        .and_then(|_| {
                            peerinfo::gather::get_peer_info(pid)
                                .map_err(|e| {
                                    error!(error = %e, pid = %pid, "Failed getting process info");
                                    e
                                })
                                .ok()
                        });

                        // Always create a new pipe for the next connection, regardless
                        // of whether this connection succeeded. Without this, the old
                        // listener stays in a "connected" state and listener.connect()
                        // returns immediately on the next iteration, causing an infinite loop.
                        let new_listener = match ServerOptions::new().create(PIPE_NAME) {
                            Ok(pipe) => pipe,
                            Err(e) => {
                                error!(error = %e, "Encountered an error creating a new pipe");
                                cancellation_token.cancel();
                                is_running.store(false, Ordering::Relaxed);
                                return;
                            }
                        };

                        if let Some(peer_info) = peer_info {
                            tx.send((listener, peer_info)).await.unwrap();
                        }

                        listener = new_listener;
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
