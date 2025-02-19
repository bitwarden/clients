use std::{path::PathBuf, sync::Mutex};

use futures::{SinkExt, StreamExt};
use interprocess::local_socket::{
    tokio::{prelude::*, Stream},
    GenericFilePath, ToFsName,
};
use log::{error, info};

pub struct Client {
    path: PathBuf,
    send: tokio::sync::mpsc::Sender<String>,
    // We're using recv to keep track of the connection state
    recv: Mutex<Option<tokio::sync::mpsc::Receiver<String>>>,
}

impl Client {
    pub fn new(
        path: PathBuf,
        send: tokio::sync::mpsc::Sender<String>,
        recv: tokio::sync::mpsc::Receiver<String>,
    ) -> Self {
        Self {
            path,
            send,
            recv: Mutex::new(Some(recv)),
        }
    }

    pub fn is_connected(&self) -> bool {
        self.recv.lock().unwrap().is_none()
    }

    pub async fn connect(&self) -> Result<(), Box<dyn std::error::Error>> {
        info!("Attempting to connect to {}", self.path.display());

        let name = self.path.as_os_str().to_fs_name::<GenericFilePath>()?;
        let conn = Stream::connect(name).await?;

        let mut conn = crate::ipc::internal_ipc_codec(conn);

        info!("Connected to {}", self.path.display());
        let Some(mut recv) = self.recv.lock().unwrap().take() else {
            return Err("Client already connected".into());
        };

        // This `connected` and the latter `disconnected` messages are the only ones that
        // are sent from the Rust IPC code and not just forwarded from the desktop app.
        // As it's only two, we hardcode the JSON values to avoid pulling in a JSON library.
        self.send
            .send("{\"command\":\"connected\"}".to_owned())
            .await?;

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
                            self.send.send(message).await?;
                        }
                    }
                }
            }
        }

        let _ = self
            .send
            .send("{\"command\":\"disconnected\"}".to_owned())
            .await;

        self.recv.lock().unwrap().replace(recv);

        Ok(())
    }
}
