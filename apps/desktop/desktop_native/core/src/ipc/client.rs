use std::time::Duration;

use interprocess::local_socket::{
    tokio::{prelude::*, Stream},
    GenericFilePath, ToFsName,
};
use log::{error, info};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    time::sleep,
};

pub async fn connect(
    send: tokio::sync::mpsc::Sender<String>,
    mut recv: tokio::sync::mpsc::Receiver<String>,
) {
    // Keep track of connection failures to make sure we don't leave the process as a zombie
    let mut connection_failures = 0;

    loop {
        match connect_inner(&send, &mut recv).await {
            Ok(()) => return,
            Err(e) => {
                connection_failures += 1;
                if connection_failures >= 20 {
                    error!("Failed to connect to IPC server after 20 attempts: {e}");
                    return;
                }

                error!("Failed to connect to IPC server: {e}");
            }
        }

        sleep(Duration::from_secs(5)).await;
    }
}

async fn connect_inner(
    send: &tokio::sync::mpsc::Sender<String>,
    recv: &mut tokio::sync::mpsc::Receiver<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let path = super::path("bitwarden");

    info!("Attempting to connect to {}", path.display());

    let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
    let mut conn = Stream::connect(name).await?;

    info!("Connected to {}", path.display());

    send.send("{\"command\":\"connected\"}".to_owned()).await?;

    let mut buffer = vec![0; 8192];

    // Listen to IPC messages
    loop {
        tokio::select! {
            // Send messages to the IPC server
            msg = recv.recv() => {
                match msg {
                    Some(msg) => {
                        conn.write_all(msg.as_bytes()).await?;
                    }
                    None => {
                        info!("Client channel closed");
                        break;
                    },
                }
            },

            // Read messages from the IPC server
            res = conn.read(&mut buffer[..]) => {
                match res {
                    Err(e) => {
                        error!("Error reading from IPC server: {e}");
                        send.send("{\"command\":\"disconnected\"}".to_owned()).await?;
                        break;
                    }
                    Ok(0) => {
                        info!("Connection closed");
                        send.send("{\"command\":\"disconnected\"}".to_owned()).await?;
                        break;
                    }
                    Ok(n) => {
                        let message = String::from_utf8_lossy(&buffer[..n]).to_string();
                        send.send(message).await?;
                    }
                }
            }
        }
    }

    Ok(())
}
