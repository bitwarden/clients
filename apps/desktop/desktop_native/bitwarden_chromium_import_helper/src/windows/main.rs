use anyhow::{anyhow, Result};
use clap::Parser;
use scopeguard::defer;
use std::{
    ffi::OsString,
    os::windows::{ffi::OsStringExt as _, io::AsRawHandle},
    path::PathBuf,
    time::Duration,
};
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

use chromium_importer::chromium::{verify_signature, ADMIN_TO_USER_PIPE_NAME};

use super::{
    config::ENABLE_SERVER_SIGNATURE_VALIDATION,
    crypto::{
        decode_abe_key_blob, decode_base64, decrypt_with_dpapi_as_system,
        decrypt_with_dpapi_as_user, encode_base64,
    },
    log::init_logging,
};

#[derive(Parser)]
#[command(name = "bitwarden_chromium_import_helper")]
#[command(about = "Admin tool for ABE service management")]
struct Args {
    #[arg(long, help = "Base64 encoded encrypted data string")]
    encrypted: String,
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

fn resolve_process_executable_path(pid: u32) -> Result<PathBuf> {
    debug!("Resolving process executable path for PID {}", pid);

    // Open the process handle
    let hprocess = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }?;
    debug!("Opened process handle for PID {}", pid);

    // Close when no longer needed
    defer! {
        debug!("Closing process handle for PID {}", pid);
        unsafe {
            _ = CloseHandle(hprocess);
        }
    };

    let mut exe_name = vec![0u16; 32 * 1024];
    let mut exe_name_length = exe_name.len() as u32;
    unsafe {
        QueryFullProcessImageNameW(
            hprocess,
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

async fn open_and_validate_pipe_server(pipe_name: &'static str) -> Result<NamedPipeClient> {
    let client = open_pipe_client(pipe_name).await?;

    if ENABLE_SERVER_SIGNATURE_VALIDATION {
        let server_pid = get_named_pipe_server_pid(&client)?;
        debug!("Connected to pipe server PID {}", server_pid);

        // Validate the server end process signature
        let exe_path = resolve_process_executable_path(server_pid)?;

        debug!("Pipe server executable path: {}", exe_path.display());

        if !verify_signature(&exe_path)? {
            return Err(anyhow!("Pipe server signature is not valid"));
        }

        debug!("Pipe server signature verified for PID {}", server_pid);
    }

    Ok(client)
}

fn run() -> Result<String> {
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

    let system_decrypted = decrypt_with_dpapi_as_system(&encrypted)?;
    debug!(
        "Decrypted data with DPAPI as SYSTEM {} {:?}",
        system_decrypted.len(),
        system_decrypted
    );

    let user_decrypted = decrypt_with_dpapi_as_user(&system_decrypted, false)?;
    debug!(
        "Decrypted data with DPAPI as USER {} {:?}",
        user_decrypted.len(),
        user_decrypted
    );

    let key = decode_abe_key_blob(&user_decrypted)?;
    debug!("Decoded ABE key blob {} {:?}", key.len(), key);

    Ok(encode_base64(&key))
}

pub(crate) async fn main() {
    init_logging();

    let mut client = match open_and_validate_pipe_server(ADMIN_TO_USER_PIPE_NAME).await {
        Ok(client) => client,
        Err(e) => {
            error!(
                "Failed to open pipe {} to send result/error: {}",
                ADMIN_TO_USER_PIPE_NAME, e
            );
            return;
        }
    };

    match run() {
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
