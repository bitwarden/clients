use std::error::Error;

use futures::{Sink, SinkExt, StreamExt, TryFutureExt};

use anyhow::Result;
use log::{error, info};
use parity_tokio_ipc::{Endpoint, SecurityAttributes};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::broadcast::Receiver,
};
use tokio_util::sync::CancellationToken;

#[derive(Debug)]
pub struct Message {
    pub client_id: u32,
    pub kind: MessageType,
    pub message: String,
}

#[derive(Debug)]
pub enum MessageType {
    Connected,
    Disconnected,
    Message,
}

pub struct Server {
    cancel_token: CancellationToken,
    tx_connections: tokio::sync::broadcast::Sender<String>,
}

impl Server {
    pub fn start<T>(name: &str, tx: T) -> Result<Self, Box<dyn Error>>
    where
        T: Sink<Message> + Unpin + Send + Clone + 'static,
        <T as Sink<Message>>::Error: std::error::Error + 'static,
    {
        let path = super::path(name);

        // If the unix socket file already exists, we get an error when trying to bind to it. So we remove it first.
        // Any processes that were using the old socket will remain connected but any new connections will use the new socket.
        if !cfg!(windows) {
            let _ = std::fs::remove_file(&path);
        }

        let mut endpoint = Endpoint::new(path.to_string_lossy().to_string());
        endpoint.set_security_attributes(SecurityAttributes::allow_everyone_create()?);
        let incoming = endpoint.incoming()?;

        let (tx_connections, rx_connections) = tokio::sync::broadcast::channel::<String>(32);

        let cancel_token = CancellationToken::new();
        let cancel_token2 = cancel_token.clone();

        tokio::spawn(async move {
            futures::pin_mut!(incoming);
            let mut next_client_id = 1_u32;

            loop {
                tokio::select! {
                    _ = cancel_token2.cancelled() => {
                        info!("IPC server cancelled.");
                        break;
                    },

                    msg = incoming.next() => {
                        match msg {
                            Some(Ok(stream)) => {
                                let client_id = next_client_id;
                                next_client_id += 1;

                                let rx_connections = rx_connections.resubscribe();
                                let tx = tx.clone();
                                let cancel_token_clone = cancel_token2.clone();

                                tokio::spawn(handle_connection(stream, tx, rx_connections, cancel_token_clone, client_id).map_err(|e| {
                                    error!("Error handling connection: {}", e)
                                }));
                            },
                            Some(Err(e)) => {
                                error!("Error reading message: {}", e);
                                break;
                            },
                            None => {
                                info!("IPC endpoint closed.");
                                break;
                            }
                        }
                    }
                }
            }
        });

        Ok(Self {
            cancel_token,
            tx_connections,
        })
    }

    pub fn send(&self, message: String) -> Result<()> {
        self.tx_connections.send(message)?;
        Ok(())
    }

    pub fn stop(&self) {
        self.cancel_token.cancel();
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.stop();
    }
}

async fn handle_connection<T>(
    mut stream: impl AsyncRead + AsyncWrite + Unpin,
    mut tx: T,
    mut rx_connections: Receiver<String>,
    cancel_token: CancellationToken,
    client_id: u32,
) -> Result<(), Box<dyn Error>>
where
    T: Sink<Message> + Unpin,
    <T as Sink<Message>>::Error: std::error::Error + 'static,
{
    tx.send(Message {
        client_id,
        kind: MessageType::Connected,
        message: "Connected".to_owned(),
    })
    .await?;

    let mut buf = vec![0u8; 8192];

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                info!("Client {client_id} cancelled.");
                break;
            },

            msg = rx_connections.recv() => {
                match msg {
                    Ok(msg) => {
                        stream.write_all(msg.as_bytes()).await?;
                    },
                    Err(e) => {
                        info!("Error reading message: {}", e);
                        break;
                    }
                }
            },

            result = stream.read(&mut buf) => {
                match result {
                    Err(e)  => {
                        info!("Error reading from client {client_id}: {e}");

                        tx.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: "Disconnected".to_owned(),
                        }).await?;
                        break;
                    },
                    Ok(0) => {
                        info!("Client {client_id} disconnected.");

                        tx.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: "Disconnected".to_owned(),
                        }).await?;
                        break;
                    },
                    Ok(size) => {
                        let msg = std::str::from_utf8(&buf[..size])?;

                        tx.send(Message {
                            client_id,
                            kind: MessageType::Message,
                            message: msg.to_string(),
                        }).await?;
                    },

                }
            }
        }
    }

    Ok(())
}
