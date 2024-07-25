use std::{error::Error, vec};

use futures::{Sink, SinkExt, TryFutureExt};

use anyhow::Result;
use interprocess::local_socket::{tokio::prelude::*, GenericFilePath, ListenerOptions};
use log::{error, info};
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
    server_to_client_send: tokio::sync::broadcast::Sender<String>,
}

impl Server {
    /// Create and start the IPC server without blocking.
    /// # Parameters
    /// - `name`: The endpoint name to listen on. This name uniquely identifies the IPC connection and must be the same for both the server and client.
    /// - `client_to_server_send`: This [`Sink`] will receive all the [`Message`]'s that the clients send to this server.
    pub fn start<T>(name: &str, client_to_server_send: T) -> Result<Self, Box<dyn Error>>
    where
        T: Sink<Message> + Unpin + Send + Clone + 'static,
        <T as Sink<Message>>::Error: std::error::Error + 'static,
    {
        let path = super::path(name);

        // If the unix socket file already exists, we get an error when trying to bind to it. So we remove it first.
        // Any processes that were using the old socket should remain connected to it but any new connections will use the new socket.
        if !cfg!(windows) {
            let _ = std::fs::remove_file(&path);
        }

        let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
        let opts = ListenerOptions::new().name(name);
        let listener = opts.create_tokio()?;

        // This broadcast channel is used for sending messages to all connected clients, and so the sender
        // will be stored in the server while the receiver will be cloned and passed to each client handler.
        let (server_to_client_send, server_to_client_recv) =
            tokio::sync::broadcast::channel::<String>(32);

        // This cancellation token allows us to cleanly stop the server and all the spawned
        // tasks without having to wait on all the pending tasks finalizing first
        let cancel_token = CancellationToken::new();

        // Create the server and start listening for incoming connections
        // in a separate task to avoid blocking the current task
        let server = Server {
            cancel_token: cancel_token.clone(),
            server_to_client_send,
        };
        tokio::spawn(listen_incoming(
            listener,
            client_to_server_send,
            server_to_client_recv,
            cancel_token,
        ));

        Ok(server)
    }

    /// Send a message over the IPC server to all the connected clients
    /// # Returns
    /// The number of clients that the message was sent to. Note that the number of messages
    /// sent may be less than the number of connected clients if some clients disconnect while
    /// the message is being sent.
    pub fn send(&self, message: String) -> Result<usize> {
        let sent = self.server_to_client_send.send(message)?;
        Ok(sent)
    }

    /// Stop the IPC server.
    pub fn stop(&self) {
        self.cancel_token.cancel();
    }
}

impl Drop for Server {
    fn drop(&mut self) {
        self.stop();
    }
}

async fn listen_incoming<T>(
    listener: LocalSocketListener,
    client_to_server_send: T,
    server_to_client_recv: Receiver<String>,
    cancel_token: CancellationToken,
) where
    T: Sink<Message> + Unpin + Send + Clone + 'static,
    <T as Sink<Message>>::Error: std::error::Error + 'static,
{
    let mut next_client_id = 1_u32;
    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                info!("IPC server cancelled.");
                break;
            },

            // A new client connection has been established
            msg = listener.accept() => {
                match msg {
                    Ok(client_stream) => {
                        // We use a simple incrementing ID for each client
                        let client_id = next_client_id;
                        next_client_id += 1;

                        let future = handle_connection(
                            client_stream,
                            client_to_server_send.clone(),
                            // We resubscribe to the receiver here so this task can have it's own copy
                            // Note that this copy will only receive messages sent after this point,
                            // but that is okay, realistically we don't want any messages before we get a chance
                            // to send the connected message to the client, which is done inside [`handle_connection`]
                            server_to_client_recv.resubscribe(),
                            cancel_token.clone(),
                            client_id
                        );
                        tokio::spawn(future.map_err(|e| {
                            error!("Error handling connection: {}", e)
                        }));
                    },
                    Err(e) => {
                        error!("Error accepting connection: {}", e);
                        break;
                    },
                }
            }
        }
    }
}

async fn handle_connection<T>(
    mut client_stream: impl AsyncRead + AsyncWrite + Unpin,
    mut client_to_server_send: T,
    mut server_to_client_recv: Receiver<String>,
    cancel_token: CancellationToken,
    client_id: u32,
) -> Result<(), Box<dyn Error>>
where
    T: Sink<Message> + Unpin,
    <T as Sink<Message>>::Error: std::error::Error + 'static,
{
    client_to_server_send
        .send(Message {
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

            // Any messages received from the server will be written to the client stream
            msg = server_to_client_recv.recv() => {
                match msg {
                    Ok(msg) => {
                        client_stream.write_all(msg.as_bytes()).await?;
                    },
                    Err(e) => {
                        info!("Error reading message: {}", e);
                        break;
                    }
                }
            },

            // Any messages read from the client will be sent to the server
            // Note that we also send connect and disconnect events so that
            // the server can keep track of multiple clients
            result = client_stream.read(&mut buf) => {
                match result {
                    Err(e)  => {
                        info!("Error reading from client {client_id}: {e}");

                        client_to_server_send.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: "Disconnected".to_owned(),
                        }).await?;
                        break;
                    },
                    Ok(0) => {
                        info!("Client {client_id} disconnected.");

                        client_to_server_send.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: "Disconnected".to_owned(),
                        }).await?;
                        break;
                    },
                    Ok(size) => {
                        let msg = std::str::from_utf8(&buf[..size])?;

                        client_to_server_send.send(Message {
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
