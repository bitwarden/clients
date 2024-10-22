use std::{
    io,
    pin::Pin,
    task::{Context, Poll},
};

use futures::Stream;
use tokio::{
    net::windows::named_pipe::{NamedPipeServer, ServerOptions},
    select,
};
use tokio_util::sync::CancellationToken;

const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

#[pin_project::pin_project]
pub struct NamedPipeServerStream {
    rx: tokio::sync::mpsc::Receiver<NamedPipeServer>,
}

impl NamedPipeServerStream {
    pub fn new(cancellation_token: CancellationToken) -> Self {
        let (tx, rx) = tokio::sync::mpsc::channel(16);
        tokio::spawn(async move {
            println!(
                "[SSH Agent Native Module] Creating named pipe server on {}",
                PIPE_NAME
            );
            let mut listener = ServerOptions::new().create(PIPE_NAME).unwrap();
            loop {
                println!("[SSH Agent Native Module] Waiting for connection");
                select! {
                    _ = cancellation_token.cancelled() => {
                        println!("[SSH Agent Native Module] Cancellation token triggered, stopping named pipe server");
                        break;
                    }
                    _ = listener.connect() => {
                        println!("[SSH Agent Native Module] Incoming connection");
                        tx.send(listener).await.unwrap();
                        listener = ServerOptions::new().create(PIPE_NAME).unwrap();
                    }
                }
            }
        });
        Self { rx }
    }
}

impl Stream for NamedPipeServerStream {
    type Item = io::Result<NamedPipeServer>;

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<io::Result<NamedPipeServer>>> {
        let this = self.project();

        this.rx.poll_recv(cx).map(|v| v.map(Ok))
    }
}
