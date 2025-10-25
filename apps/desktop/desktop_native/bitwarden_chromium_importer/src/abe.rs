use anyhow::{anyhow, Result};
use log::debug;
use std::{ffi::OsStr, os::windows::ffi::OsStrExt};
use tokio::{
    io::{self, AsyncReadExt, AsyncWriteExt},
    net::windows::named_pipe::{NamedPipeServer, ServerOptions},
    sync::mpsc::channel,
    task::JoinHandle,
    time::{timeout, Duration},
};
use windows::{
    core::PCWSTR,
    Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_HIDE},
};

use crate::abe_config;

const WAIT_FOR_ADMIN_MESSAGE_TIMEOUT_SECS: u64 = 30;

pub fn start_tokio_named_pipe_server<F>(
    pipe_name: &'static str,
    process_message: F,
) -> Result<JoinHandle<Result<(), io::Error>>>
where
    F: Fn(&str) -> String + Send + Sync + Clone + 'static,
{
    debug!("Starting Tokio named pipe server on: {}", pipe_name);

    // The first server needs to be constructed early so that clients can be correctly
    // connected. Otherwise calling .wait will cause the client to error.
    // Here we also make use of `first_pipe_instance`, which will ensure that
    // there are no other servers up and running already.
    let mut server = ServerOptions::new()
        .first_pipe_instance(true)
        .create(pipe_name)?;

    debug!("Named pipe server created and listening...");

    // Spawn the server loop.
    let server_task = tokio::spawn(async move {
        loop {
            // Wait for a client to connect.
            match server.connect().await {
                Ok(_) => {
                    debug!("Client connected to named pipe");
                    let connected_client = server;

                    // Construct the next server to be connected before sending the one
                    // we already have off to a task. This ensures that the server
                    // isn't closed (after it's done in the task) before a new one is
                    // available. Otherwise the client might error with
                    // `io::ErrorKind::NotFound`.
                    server = ServerOptions::new().create(pipe_name)?;

                    // Handle the connected client in a separate task
                    let process_message_clone = process_message.clone();
                    let _client_task = tokio::spawn(async move {
                        if let Err(e) = handle_client(connected_client, process_message_clone).await
                        {
                            debug!("Error handling client: {}", e);
                        }
                    });
                }
                Err(e) => {
                    debug!("Failed to connect to client: {}", e);
                    continue;
                }
            }
        }
    });

    Ok(server_task)
}

async fn handle_client<F>(mut client: NamedPipeServer, process_message: F) -> Result<()>
where
    F: Fn(&str) -> String,
{
    debug!("Handling new client connection");

    loop {
        // Read a message from the client
        let mut buffer = vec![0u8; 64 * 1024];
        match client.read(&mut buffer).await {
            Ok(0) => {
                debug!("Client disconnected (0 bytes read)");
                return Ok(());
            }
            Ok(bytes_read) => {
                let message = String::from_utf8_lossy(&buffer[..bytes_read]);
                let preview = message.chars().take(16).collect::<String>();
                debug!(
                    "Received from client: '{}...' ({} bytes)",
                    preview, bytes_read,
                );

                let response = process_message(&message);
                match client.write_all(response.as_bytes()).await {
                    Ok(_) => {
                        debug!("Sent response to client ({} bytes)", response.len());
                    }
                    Err(e) => {
                        return Err(anyhow!("Failed to send response to client: {}", e));
                    }
                }
            }
            Err(e) => {
                return Err(anyhow!("Failed to read from client: {}", e));
            }
        }
    }
}

pub async fn decrypt_with_admin_exe(admin_exe: &str, encrypted: &str) -> Result<String> {
    let (tx, mut rx) = channel::<String>(1);

    debug!(
        "Starting named pipe server at '{}'...",
        abe_config::ADMIN_TO_USER_PIPE_NAME
    );

    let server = match start_tokio_named_pipe_server(
        abe_config::ADMIN_TO_USER_PIPE_NAME,
        move |message: &str| {
            let _ = tx.try_send(message.to_string());
            "ok".to_string()
        },
    ) {
        Ok(server) => server,
        Err(e) => return Err(anyhow!("Failed to start named pipe server: {}", e)),
    };

    debug!("Launching '{}' as ADMINISTRATOR...", admin_exe);
    decrypt_with_admin_exe_internal(admin_exe, encrypted);

    debug!("Waiting for message from {}...", admin_exe);
    let message = match timeout(
        Duration::from_secs(WAIT_FOR_ADMIN_MESSAGE_TIMEOUT_SECS),
        rx.recv(),
    )
    .await
    {
        Ok(Some(msg)) => msg,
        Ok(None) => return Err(anyhow!("Channel closed without message from {}", admin_exe)),
        Err(_) => return Err(anyhow!("Timeout waiting for message from {}", admin_exe)),
    };

    debug!("Shutting down the pipe server...");
    server.abort();

    Ok(message)
}

fn decrypt_with_admin_exe_internal(admin_exe: &str, encrypted: &str) {
    // Convert strings to wide strings for Windows API
    let exe_wide = OsStr::new(admin_exe)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<u16>>();
    let runas_wide = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<u16>>();
    let parameters = OsStr::new(&format!(r#"--encrypted "{}""#, encrypted))
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<u16>>();

    unsafe {
        ShellExecuteW(
            None,
            PCWSTR(runas_wide.as_ptr()),
            PCWSTR(exe_wide.as_ptr()),
            PCWSTR(parameters.as_ptr()),
            None,
            SW_HIDE,
        );
    }
}
