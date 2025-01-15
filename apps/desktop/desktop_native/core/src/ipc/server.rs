use std::{
    error::Error,
    path::{Path, PathBuf},
};

use futures::{SinkExt, StreamExt, TryFutureExt};

use anyhow::Result;
use interprocess::local_socket::{tokio::prelude::*, GenericFilePath, ListenerOptions};
use log::{error, info};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    sync::{broadcast, mpsc},
};
use tokio_util::sync::CancellationToken;

use super::MESSAGE_CHANNEL_BUFFER;

#[derive(Debug)]
pub struct Message {
    pub client_id: u32,
    pub kind: MessageType,
    // This value should be Some for MessageType::Message and None for the rest
    pub message: Option<String>,
}

#[derive(Debug)]
pub enum MessageType {
    Connected,
    Disconnected,
    Message,
}

pub struct Server {
    pub path: PathBuf,
    cancel_token: CancellationToken,
    server_to_clients_send: broadcast::Sender<String>,
}

impl Server {
    /// Create and start the IPC server without blocking.
    ///
    /// # Parameters
    ///
    /// - `name`: The endpoint name to listen on. This name uniquely identifies the IPC connection and must be the same for both the server and client.
    /// - `client_to_server_send`: This [`mpsc::Sender<Message>`] will receive all the [`Message`]'s that the clients send to this server.
    pub fn start(
        path: &Path,
        client_to_server_send: mpsc::Sender<Message>,
    ) -> Result<Self, Box<dyn Error>> {
        // If the unix socket file already exists, we get an error when trying to bind to it. So we remove it first.
        // Any processes that were using the old socket should remain connected to it but any new connections will use the new socket.
        if !cfg!(windows) {
            let _ = std::fs::remove_file(path);
        }

        let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
        let opts = ListenerOptions::new().name(name);
        let listener = opts.create_tokio()?;

        // This broadcast channel is used for sending messages to all connected clients, and so the sender
        // will be stored in the server while the receiver will be cloned and passed to each client handler.
        let (server_to_clients_send, server_to_clients_recv) =
            broadcast::channel::<String>(MESSAGE_CHANNEL_BUFFER);

        // This cancellation token allows us to cleanly stop the server and all the spawned
        // tasks without having to wait on all the pending tasks finalizing first
        let cancel_token = CancellationToken::new();

        // Create the server and start listening for incoming connections
        // in a separate task to avoid blocking the current task
        let server = Server {
            path: path.to_owned(),
            cancel_token: cancel_token.clone(),
            server_to_clients_send,
        };
        tokio::spawn(listen_incoming(
            listener,
            client_to_server_send,
            server_to_clients_recv,
            cancel_token,
        ));

        Ok(server)
    }

    /// Send a message over the IPC server to all the connected clients
    ///
    /// # Returns
    ///
    /// The number of clients that the message was sent to. Note that the number of messages
    /// sent may be less than the number of connected clients if some clients disconnect while
    /// the message is being sent.
    pub fn send(&self, message: String) -> Result<usize> {
        let sent = self.server_to_clients_send.send(message)?;
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

async fn listen_incoming(
    listener: LocalSocketListener,
    client_to_server_send: mpsc::Sender<Message>,
    server_to_clients_recv: broadcast::Receiver<String>,
    cancel_token: CancellationToken,
) {
    // We use a simple incrementing ID for each client
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
                        let client_id = next_client_id;
                        next_client_id += 1;

                        let future = handle_connection(
                            client_stream,
                            client_to_server_send.clone(),
                            // We resubscribe to the receiver here so this task can have it's own copy
                            // Note that this copy will only receive messages sent after this point,
                            // but that is okay, realistically we don't want any messages before we get a chance
                            // to send the connected message to the client, which is done inside [`handle_connection`]
                            server_to_clients_recv.resubscribe(),
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

async fn handle_connection(
    client_stream: impl AsyncRead + AsyncWrite + Unpin,
    client_to_server_send: mpsc::Sender<Message>,
    mut server_to_clients_recv: broadcast::Receiver<String>,
    cancel_token: CancellationToken,
    client_id: u32,
) -> Result<(), Box<dyn Error>> {
    client_to_server_send
        .send(Message {
            client_id,
            kind: MessageType::Connected,
            message: None,
        })
        .await?;

    let mut client_stream = crate::ipc::internal_ipc_codec(client_stream);

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                info!("Client {client_id} cancelled.");
                break;
            },

            // Forward messages to the IPC clients
            msg = server_to_clients_recv.recv() => {
                match msg {
                    Ok(msg) => {
                        client_stream.send(msg.into()).await?;
                    },
                    Err(e) => {
                        info!("Error reading message: {}", e);
                        break;
                    }
                }
            },

            // Forwards messages from the IPC clients to the server
            // Note that we also send connect and disconnect events so that
            // the server can keep track of multiple clients
            result = client_stream.next() => {
                match result {
                    Some(Err(e))  => {
                        info!("Error reading from client {client_id}: {e}");

                        client_to_server_send.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: None,
                        }).await?;
                        break;
                    },
                    None => {
                        info!("Client {client_id} disconnected.");

                        client_to_server_send.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: None,
                        }).await?;
                        break;
                    },
                    Some(Ok(bytes)) => {
                        let msg = std::str::from_utf8(&bytes)?;

                        client_to_server_send.send(Message {
                            client_id,
                            kind: MessageType::Message,
                            message: Some(msg.to_string()),
                        }).await?;
                    },

                }
            }
        }
    }

    Ok(())
}
