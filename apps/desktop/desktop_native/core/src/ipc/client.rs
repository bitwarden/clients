//! IPC client for connecting to and communicating with the IPC server.

use std::path::PathBuf;

use futures::{SinkExt, StreamExt};
use interprocess::local_socket::{
    tokio::{prelude::*, Stream},
    GenericFilePath, ToFsName,
};
use tracing::{error, info};

use crate::ipc::announcement::ClientAnnouncement;

/// Connects to an IPC server and handles bidirectional message passing.
pub async fn connect(
    path: PathBuf,
    announce: ClientAnnouncement,
    send: tokio::sync::mpsc::Sender<String>,
    mut recv: tokio::sync::mpsc::Receiver<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    info!(?path, "Attempting to connect");

    let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
    let conn = Stream::connect(name).await?;

    let mut conn = crate::ipc::internal_ipc_codec(conn);
    conn.send(announce.to_string().into()).await?;

    info!(?path, "Connected");

    // This `connected` and the latter `disconnected` messages are the only ones that
    // are sent from the Rust IPC code and not just forwarded from the desktop app.
    // As it's only two, we hardcode the JSON values to avoid pulling in a JSON library.
    send.send("{\"command\":\"connected\"}".to_owned()).await?;

    // Listen to IPC messages
    loop {
        tokio::select! {
            // Forward messages to the IPC server
            msg = recv.recv() => {
                match msg {
                    Some(msg) => {
                        conn.send(msg.into()).await?;
                    }
                    None => {
                        info!("Client channel closed");
                        break;
                    },
                }
            },

            // Forward messages from the IPC server
            res = conn.next() => {
                match res {
                    Some(Err(e)) => {
                        error!(error = %e, "Error reading from IPC server");
                        break;
                    }
                     None => {
                        info!("Connection closed");
                        break;
                    }
                    Some(Ok(bytes)) => {
                        let message = String::from_utf8_lossy(&bytes).to_string();
                        send.send(message).await?;
                    }
                }
            }
        }
    }

    let _ = send.send("{\"command\":\"disconnected\"}".to_owned()).await;

    Ok(())
}

#[cfg(all(test, unix))]
mod tests {
    use tokio::sync::mpsc;

    use super::*;
    use crate::ipc::{
        server::{Message, MessageType, Server},
        MESSAGE_CHANNEL_BUFFER,
    };

    const RELAYED: &str = "relayed";

    async fn next(recv: &mut mpsc::Receiver<Message>) -> Message {
        recv.recv().await.expect("server channel closed")
    }

    #[tokio::test]
    async fn announces_on_connect() {
        let path = std::env::temp_dir().join(format!("bw-ipc-test-{}.sock", std::process::id()));
        let (server_send, mut server_recv) = mpsc::channel(MESSAGE_CHANNEL_BUFFER);
        let server = Server::start(vec![path.clone()], server_send).expect("server start");

        let (client_send, _client_recv) = mpsc::channel(MESSAGE_CHANNEL_BUFFER);
        let (relay_send, relay_recv) = mpsc::channel(MESSAGE_CHANNEL_BUFFER);

        // Queued before connecting, so it is ready to race the announcement.
        relay_send.send(RELAYED.to_owned()).await.expect("queue");
        let announcement = ClientAnnouncement::from_args(&[]);
        let expected = announcement.to_string();
        let client = connect(path.clone(), announcement, client_send, relay_recv);
        let checks = async {
            let connected = next(&mut server_recv).await;
            assert!(matches!(connected.kind, MessageType::Connected));
            assert_eq!(connected.message, Some(expected));

            let relayed = next(&mut server_recv).await;
            assert!(matches!(relayed.kind, MessageType::Message));
            assert_eq!(relayed.message.as_deref(), Some(RELAYED));
        };

        // The client's error type is not `Send`, so it runs alongside the checks, not spawned.
        tokio::select! {
            result = client => panic!("client exited early: {result:?}"),
            () = checks => {}
        }

        server.stop();
        let _ = std::fs::remove_file(path);
    }
}
