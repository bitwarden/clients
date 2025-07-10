use std::path::PathBuf;

use futures::{SinkExt, StreamExt};
use interprocess::local_socket::{
    tokio::{prelude::*, Stream},
    GenericFilePath, ToFsName,
};
use log::{error, info};

pub async fn connect(
    path: PathBuf,
    send: tokio::sync::mpsc::Sender<String>,
    mut recv: tokio::sync::mpsc::Receiver<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Attempting to connect to {}", path.display());

    let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
    let conn = Stream::connect(name).await?;

    let mut conn = crate::ipc::internal_ipc_codec(conn);

    info!("Connected to {}", path.display());

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
                        error!("Error reading from IPC server: {e}");
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
