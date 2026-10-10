use std::{
    ffi::OsString,
    os::windows::{ffi::OsStringExt as _, io::AsRawHandle},
    path::PathBuf,
    time::Duration,
};

use anyhow::{anyhow, Result};
use chromium_importer::chromium::{verify_signature, ADMIN_TO_USER_PIPE_NAME};
use clap::Parser;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::windows::named_pipe::{ClientOptions, NamedPipeClient},
    time,
};
use tracing::{debug, error};
use windows::Win32::{
    Foundation::{CloseHandle, ERROR_PIPE_BUSY, HANDLE},
    System::{
        Pipes::GetNamedPipeServerProcessId,
        Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
    },
    UI::Shell::IsUserAnAdmin,
};

use super::{
    crypto::{decode_abe_key_blob, decode_base64, decrypt_app_bound_dpapi_layers, encode_base64},
    log::init_logging,
};

#[derive(Parser)]
#[command(name = "bitwarden_chromium_import_helper")]
#[command(about = "Admin tool for ABE service management")]
struct Args {
    #[arg(long, help = "Base64 encoded encrypted data string")]
    encrypted: String,
}

struct OwnedProcessHandle(HANDLE);

impl OwnedProcessHandle {
    fn open(pid: u32) -> Result<Self> {
        let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }?;
        Ok(Self(handle))
    }

    fn raw(&self) -> HANDLE {
        self.0
    }
}

impl Drop for OwnedProcessHandle {
    fn drop(&mut self) {
        unsafe {
            _ = CloseHandle(self.0);
        }
    }
}

async fn open_pipe_client(pipe_name: &'static str) -> Result<NamedPipeClient> {
    let max_attempts = 5;
    for _ in 0..max_attempts {
        match ClientOptions::new().open(pipe_name) {
            Ok(client) => {
                debug!("Successfully connected to the pipe!");
                return Ok(client);
            }
            Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY.0 as i32) => {
                debug!("Pipe is busy, retrying in 50ms...");
            }
            Err(e) => {
                debug!("Failed to connect to pipe: {}", &e);
                return Err(e.into());
            }
        }

        time::sleep(Duration::from_millis(50)).await;
    }

    Err(anyhow!(
        "Failed to connect to pipe after {} attempts",
        max_attempts
    ))
}

async fn send_message_with_client(client: &mut NamedPipeClient, message: &str) -> Result<String> {
    client.write_all(message.as_bytes()).await?;

    // Try to receive a response for this message
    let mut buffer = vec![0u8; 64 * 1024];
    match client.read(&mut buffer).await {
        Ok(0) => Err(anyhow!(
            "Server closed the connection (0 bytes read) on message"
        )),
        Ok(bytes_received) => {
            let response = String::from_utf8_lossy(&buffer[..bytes_received]);
            Ok(response.to_string())
        }
        Err(e) => Err(anyhow!("Failed to receive response for message: {}", e)),
    }
}

fn get_named_pipe_server_pid(client: &NamedPipeClient) -> Result<u32> {
    let handle = HANDLE(client.as_raw_handle() as _);
    let mut pid: u32 = 0;
    unsafe { GetNamedPipeServerProcessId(handle, &mut pid) }?;
    Ok(pid)
}

fn resolve_process_executable_path(process: &OwnedProcessHandle, pid: u32) -> Result<PathBuf> {
    debug!("Resolving process executable path for PID {}", pid);

    let mut exe_name = vec![0u16; 32 * 1024];
    let mut exe_name_length = exe_name.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            process.raw(),
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(exe_name.as_mut_ptr()),
            &mut exe_name_length,
        )
    }?;
    debug!(
        "QueryFullProcessImageNameW returned {} bytes",
        exe_name_length
    );

    exe_name.truncate(exe_name_length as usize);
    Ok(PathBuf::from(OsString::from_wide(&exe_name)))
}

async fn send_error_to_user(client: &mut NamedPipeClient, error_message: &str) {
    _ = send_to_user(client, &format!("!{}", error_message)).await
}

async fn send_to_user(client: &mut NamedPipeClient, message: &str) -> Result<()> {
    let _ = send_message_with_client(client, message).await?;
    Ok(())
}

fn is_admin() -> bool {
    unsafe { IsUserAnAdmin().as_bool() }
}

async fn open_and_validate_pipe_server(
    pipe_name: &'static str,
) -> Result<(NamedPipeClient, OwnedProcessHandle)> {
    let client = open_pipe_client(pipe_name).await?;

    let server_pid = get_named_pipe_server_pid(&client)?;
    debug!("Connected to pipe server PID {}", server_pid);

    // Keep this exact process object alive through signature validation and token duplication.
    // Reopening the PID later could target a different process if the server exits and Windows
    // reuses its PID.
    let server_process = OwnedProcessHandle::open(server_pid)?;

    // Validate the server end process signature
    let exe_path = resolve_process_executable_path(&server_process, server_pid)?;

    debug!("Pipe server executable path: {}", exe_path.display());

    if !verify_signature(&exe_path)? {
        return Err(anyhow!("Pipe server signature is not valid"));
    }

    debug!("Pipe server signature verified for PID {}", server_pid);

    Ok((client, server_process))
}

fn run(user_process: &OwnedProcessHandle) -> Result<String> {
    debug!("Starting bitwarden_chromium_import_helper.exe");

    let args = Args::try_parse()?;

    if !is_admin() {
        return Err(anyhow!("Expected to run with admin privileges"));
    }

    debug!("Running as ADMINISTRATOR");

    let encrypted = decode_base64(&args.encrypted)?;
    debug!(
        "Decoded encrypted data [{}] {:?}",
        encrypted.len(),
        encrypted
    );

    let user_decrypted = decrypt_app_bound_dpapi_layers(&encrypted, user_process.raw())?;
    debug!(
        "Decrypted data with DPAPI as original user {} {:?}",
        user_decrypted.len(),
        user_decrypted
    );

    let key = decode_abe_key_blob(&user_decrypted)?;
    debug!("Decoded ABE key blob {} {:?}", key.len(), key);

    Ok(encode_base64(&key))
}

pub(crate) async fn main() {
    init_logging();

    let (mut client, user_process) =
        match open_and_validate_pipe_server(ADMIN_TO_USER_PIPE_NAME).await {
            Ok(validated_pipe) => validated_pipe,
            Err(e) => {
                error!(
                    "Failed to open pipe {} to send result/error: {}",
                    ADMIN_TO_USER_PIPE_NAME, e
                );
                return;
            }
        };

    match run(&user_process) {
        Ok(system_decrypted_base64) => {
            debug!("Sending response back to user");
            let _ = send_to_user(&mut client, &system_decrypted_base64).await;
        }
        Err(e) => {
            debug!("Error: {}", e);
            send_error_to_user(&mut client, &format!("{}", e)).await;
        }
    }
}
