//! IPC server for handling multiple client connections.

use std::{
    collections::HashMap,
    error::Error,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};

use anyhow::Result;
use futures::{SinkExt, StreamExt, TryFutureExt};
// Non-Unix uses interprocess local sockets
#[cfg(not(unix))]
use interprocess::local_socket::{tokio::prelude::*, GenericFilePath, ListenerOptions};
// Unix uses tokio's UnixListener to access peer credentials
#[cfg(unix)]
use tokio::net::UnixListener;
use tokio::{
    io::{AsyncRead, AsyncWrite},
    sync::{broadcast, mpsc},
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use super::MESSAGE_CHANNEL_BUFFER;

/// Message received from or sent to an IPC client.
#[derive(Debug)]
pub struct Message {
    /// Unique identifier for the client connection.
    pub client_id: u32,
    /// Type of message.
    pub kind: MessageType,
    /// Message payload (Some for MessageType::Message, None otherwise).
    pub message: Option<String>,
}

/// Type of IPC message.
#[derive(Debug)]
#[allow(missing_docs)]
pub enum MessageType {
    Connected,
    Disconnected,
    Message,
}

/// Per-client sender map, shared between the server and connection handlers.
type ClientSenders = Arc<Mutex<HashMap<u32, mpsc::Sender<String>>>>;

/// IPC server that listens for client connections.
pub struct Server {
    /// Path to the IPC socket.
    pub path: PathBuf,
    cancel_token: CancellationToken,
    server_to_clients_send: broadcast::Sender<String>,
    client_senders: ClientSenders,
}

impl Server {
    /// Create and start the IPC server without blocking.
    ///
    /// # Parameters
    ///
    /// - `name`: The endpoint name to listen on. This name uniquely identifies the IPC connection
    ///   and must be the same for both the server and client.
    /// - `client_to_server_send`: This [`mpsc::Sender<Message>`] will receive all the [`Message`]'s
    ///   that the clients send to this server.
    pub fn start(
        path: &Path,
        client_to_server_send: mpsc::Sender<Message>,
    ) -> Result<Self, Box<dyn Error>> {
        // If the unix socket file already exists, we get an error when trying to bind to it. So we
        // remove it first. Any processes that were using the old socket should remain
        // connected to it but any new connections will use the new socket.
        if !cfg!(windows) {
            let _ = std::fs::remove_file(path);
        }

        #[cfg(unix)]
        let listener = UnixListener::bind(path)?;

        #[cfg(not(unix))]
        let listener = {
            let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
            let opts = ListenerOptions::new().name(name);
            opts.create_tokio()?
        };

        // This broadcast channel is used for sending messages to all connected clients, and so the
        // sender will be stored in the server while the receiver will be cloned and passed
        // to each client handler.
        let (server_to_clients_send, server_to_clients_recv) =
            broadcast::channel::<String>(MESSAGE_CHANNEL_BUFFER);

        // This cancellation token allows us to cleanly stop the server and all the spawned
        // tasks without having to wait on all the pending tasks finalizing first
        let cancel_token = CancellationToken::new();

        let client_senders: ClientSenders = Arc::new(Mutex::new(HashMap::new()));

        // Create the server and start listening for incoming connections
        // in a separate task to avoid blocking the current task
        let server = Server {
            path: path.to_owned(),
            cancel_token: cancel_token.clone(),
            server_to_clients_send,
            client_senders: client_senders.clone(),
        };
        #[cfg(unix)]
        tokio::spawn(listen_incoming_unix(
            listener,
            client_to_server_send,
            server_to_clients_recv,
            cancel_token,
            client_senders,
        ));
        #[cfg(not(unix))]
        tokio::spawn(listen_incoming_non_unix(
            listener,
            client_to_server_send,
            server_to_clients_recv,
            cancel_token,
            client_senders,
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

    /// Send a message to a specific connected client by ID.
    ///
    /// Returns an error if the client is not connected or the channel is full.
    pub fn send_to(&self, client_id: u32, message: String) -> Result<()> {
        let senders = self
            .client_senders
            .lock()
            .expect("client_senders lock poisoned");
        let sender = senders
            .get(&client_id)
            .ok_or_else(|| anyhow::anyhow!("Client {client_id} is not connected"))?;
        sender
            .try_send(message)
            .map_err(|e| anyhow::anyhow!("Failed to send to client {client_id}: {e}"))
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

#[cfg(unix)]
async fn listen_incoming_unix(
    listener: UnixListener,
    client_to_server_send: mpsc::Sender<Message>,
    server_to_clients_recv: broadcast::Receiver<String>,
    cancel_token: CancellationToken,
    client_senders: ClientSenders,
) {
    // We use a simple incrementing ID for each client
    let mut next_client_id = 1_u32;

    loop {
        use crate::ssh_agent::peerinfo::gather::get_peer_info;

        tokio::select! {
            _ = cancel_token.cancelled() => {
                info!("IPC server cancelled.");
                break;
            },

            // A new client connection has been established
            msg = listener.accept() => {
                match msg {
                    Ok((client_stream, _addr)) => {
                        let client_id = next_client_id;
                        next_client_id += 1;

                        // Try to log peer credentials
                        match client_stream.peer_cred() {
                            Ok(peer) => {
                                if let Some(pid) = peer.pid() {
                                    let peer_info = match get_peer_info(pid as u32) {
                                        Ok(info) => info,
                                        Err(_) => crate::ssh_agent::peerinfo::models::PeerInfo::unknown(),
                                    };
                                    info!(client_id, pid, uid = peer.uid(), gid = peer.gid(), peer_info = ?peer_info, "IPC client connected (peer credentials)");
                                    match (peer_info.exe_hash(), option_env!("PROXY_HASH")) {
                                        (Some(exe_hash), Some(proxy_hash)) if exe_hash == proxy_hash => {
                                            info!(client_id, "Client is identified as a trusted proxy application.");
                                        },
                                        (Some(_), Some(_)) => {
                                            info!(client_id, "Client is identified as an untrusted proxy application.");
                                        },
                                        _ => {
                                            info!(client_id, "Unable to identify client.");
                                        }
                                    }
                                } else {
                                    info!(client_id, uid = peer.uid(), gid = peer.gid(), "IPC client connected (peer credentials, no pid)");
                                }
                            },
                            Err(e) => {
                                error!(client_id, error = %e, "Failed to get peer credentials");
                            }
                        }

                        let future = handle_connection(
                            client_stream,
                            client_to_server_send.clone(),
                            // We resubscribe to the receiver here so this task can have it's own copy
                            // Note that this copy will only receive messages sent after this point,
                            // but that is okay, realistically we don't want any messages before we get a chance
                            // to send the connected message to the client, which is done inside [`handle_connection`]
                            server_to_clients_recv.resubscribe(),
                            cancel_token.clone(),
                            client_id,
                            client_senders.clone(),
                        );
                        tokio::spawn(future.map_err(|e| {
                            error!(error = %e, "Error handling connection")
                        }));
                    },
                    Err(e) => {
                        error!(error = %e, "Error accepting connection");
                        break;
                    },
                }
            }
        }
    }
}

#[cfg(not(unix))]
async fn listen_incoming_non_unix(
    listener: interprocess::local_socket::LocalSocketListener,
    client_to_server_send: mpsc::Sender<Message>,
    server_to_clients_recv: broadcast::Receiver<String>,
    cancel_token: CancellationToken,
    client_senders: ClientSenders,
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
                            client_id,
                            client_senders.clone(),
                        );
                        tokio::spawn(future.map_err(|e| {
                            error!(error = %e, "Error handling connection")
                        }));
                    },
                    Err(e) => {
                        error!(error = %e, "Error accepting connection");
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
    client_senders: ClientSenders,
) -> Result<(), Box<dyn Error>> {
    // Create a per-client channel for targeted messages
    let (targeted_send, mut targeted_recv) = mpsc::channel::<String>(MESSAGE_CHANNEL_BUFFER);

    // Register this client's targeted sender
    {
        let mut senders = client_senders.lock().expect("client_senders lock poisoned");
        senders.insert(client_id, targeted_send);
    }

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
                info!(client_id, "Client cancelled.");
                break;
            },

            // Forward broadcast messages to the IPC clients
            msg = server_to_clients_recv.recv() => {
                match msg {
                    Ok(msg) => {
                        client_stream.send(msg.into()).await?;
                    },
                    Err(e) => {
                        error!(error = %e, "Error reading message");
                        break;
                    }
                }
            },

            // Forward targeted messages to this specific client
            msg = targeted_recv.recv() => {
                match msg {
                    Some(msg) => {
                        client_stream.send(msg.into()).await?;
                    },
                    None => {
                        info!(client_id, "Targeted channel closed.");
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
                        error!(client_id, error = %e, "Error reading from client");

                        client_to_server_send.send(Message {
                            client_id,
                            kind: MessageType::Disconnected,
                            message: None,
                        }).await?;
                        break;
                    },
                    None => {
                        info!(client_id, "Client disconnected.");

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

    // Deregister this client's targeted sender on disconnect
    {
        let mut senders = client_senders.lock().expect("client_senders lock poisoned");
        senders.remove(&client_id);
    }

    Ok(())
}
