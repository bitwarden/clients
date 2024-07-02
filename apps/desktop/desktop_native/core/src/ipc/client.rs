use std::time::Duration;

use log::{error, info};
use parity_tokio_ipc::Endpoint;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    time::sleep,
};

pub async fn start(
    tx: tokio::sync::mpsc::Sender<String>,
    mut rx: tokio::sync::mpsc::Receiver<String>,
) {
    let path = super::path("bitwarden");

    loop {
        info!("Attempting to connect to {}", path.display());

        let mut conn = match Endpoint::connect(&path).await {
            Ok(c) => c,
            Err(e) => {
                info!("Failed to connect to {}: {e}", path.display());
                continue;
            }
        };

        info!("Connected to {}", path.display());

        tx.send("{\"command\":\"connected\"}".to_owned())
            .await
            .unwrap();

        let mut buffer = vec![0; 8192];

        // Listen to IPC messages
        loop {
            tokio::select! {
                // Send messages to the IPC server
                msg = rx.recv() => {
                    match msg {
                        Some(msg) => {
                            conn.write_all(msg.as_bytes()).await.unwrap();
                        }
                        None => break,
                    }
                },

                // Read messages from the IPC server
                res = conn.read(&mut buffer[..]) => {
                    match res {
                        Err(e) => {
                            error!("Error reading from IPC server: {e}");
                            tx.send("{\"command\":\"disconnected\"}".to_owned())
                                .await
                                .unwrap();
                            break;
                        }
                        Ok(0) => {
                            error!("Connection closed");
                            tx.send("{\"command\":\"disconnected\"}".to_owned())
                                .await
                                .unwrap();
                            break;
                        }
                        Ok(n) => {
                            let message = String::from_utf8_lossy(&buffer[..n]).to_string();
                            tx.send(message).await.unwrap();
                        }
                    }
                }
            }
        }

        sleep(Duration::from_secs(5)).await;
    }
}
