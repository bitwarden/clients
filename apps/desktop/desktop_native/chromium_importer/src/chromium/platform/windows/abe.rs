use std::{ffi::OsStr, os::windows::ffi::OsStrExt};

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use tokio::{
    io::{self, AsyncReadExt, AsyncWriteExt},
    net::windows::named_pipe::{NamedPipeServer, ServerOptions},
    sync::mpsc::channel,
    task::JoinHandle,
    time::{timeout, Duration},
};
use tracing::debug;
use windows::{
    core::PCWSTR,
    Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_HIDE},
};

use super::abe_config;

const WAIT_FOR_ADMIN_MESSAGE_TIMEOUT_SECS: u64 = 30;

// app_bound_encrypted_key from Local State is a base64 of (APPB-prefixed) DPAPI
// blobs — typically a few hundred bytes. Cap at 4 KiB to keep the ShellExecuteW
// command line well under the ~32 KiB Windows limit and to bound the work done by
// the base64 validator for untrusted input.
const MAX_ENCRYPTED_LEN: usize = 4 * 1024;

/// Returns true only if `input` is canonical standard Base64 under the size cap.
///
/// SECURITY: This function is the input-validation boundary that prevents command
/// injection into the elevated helper process. `encrypted` is embedded verbatim into
/// the command line passed to `ShellExecuteW` with the `runas` verb, so any
/// character outside the Base64 alphabet (in particular `"`, `\`, space, `&`, `|`,
/// `;`, `<`, `>`, `^`) must be rejected here. `BASE64_STANDARD` from base64 v0.22
/// enforces a canonical alphabet and rejects whitespace and non-alphabet bytes; do
/// not swap in a tolerant engine (e.g. `STANDARD_NO_PAD`, `GeneralPurpose` with
/// `decode_allow_trailing_bits`) without re-evaluating this invariant.
fn is_base64(input: &str) -> bool {
    input.len() <= MAX_ENCRYPTED_LEN && BASE64_STANDARD.decode(input).is_ok()
}

struct AbortOnDrop(JoinHandle<Result<(), io::Error>>);

impl Drop for AbortOnDrop {
    fn drop(&mut self) {
        self.0.abort();
    }
}

fn start_tokio_named_pipe_server<F>(
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

pub(crate) async fn decrypt_with_admin_exe(admin_exe: &str, encrypted: &str) -> Result<String> {
    if !is_base64(encrypted) {
        return Err(anyhow!("Encrypted value is not base64 encoded"));
    }

    let (tx, mut rx) = channel::<String>(1);

    debug!(
        "Starting named pipe server at '{}'...",
        abe_config::ADMIN_TO_USER_PIPE_NAME
    );

    let _server_guard = AbortOnDrop(
        start_tokio_named_pipe_server(abe_config::ADMIN_TO_USER_PIPE_NAME, move |message: &str| {
            let _ = tx.try_send(message.to_string());
            "ok".to_string()
        })
        .map_err(|e| anyhow!("Failed to start named pipe server: {}", e))?,
    );

    debug!("Launching '{}' as ADMINISTRATOR...", admin_exe);
    decrypt_with_admin_exe_internal(admin_exe, encrypted)?;

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

    Ok(message)
}

fn decrypt_with_admin_exe_internal(admin_exe: &str, encrypted: &str) -> Result<()> {
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

    let hinstance = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(runas_wide.as_ptr()),
            PCWSTR(exe_wide.as_ptr()),
            PCWSTR(parameters.as_ptr()),
            None,
            SW_HIDE,
        )
    };
    if hinstance.0 as usize <= 32 {
        return Err(anyhow!(
            "ShellExecuteW failed to launch {}: code {}",
            admin_exe,
            hinstance.0 as usize
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_canonical_base64() {
        assert!(is_base64("QVBQQgEAAADQjJ3fARXREYx6AMBPwpfr"));
        assert!(is_base64(""));
    }

    #[test]
    fn rejects_shell_metacharacters() {
        for bad in [
            r#"abc"def"#,
            r"abc\def",
            "abc def",
            "abc&def",
            "abc|def",
            "abc;def",
            "abc<def",
            "abc>def",
            "abc^def",
            "abc\ndef",
            "abc\tdef",
        ] {
            assert!(!is_base64(bad), "expected rejection of: {bad:?}");
        }
    }

    #[test]
    fn rejects_oversized_input() {
        let oversized = "A".repeat(MAX_ENCRYPTED_LEN + 1);
        assert!(!is_base64(&oversized));
    }
}
