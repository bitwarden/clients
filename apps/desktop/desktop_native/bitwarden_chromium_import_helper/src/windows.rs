mod windows_binary {
    use anyhow::{anyhow, Result};
    use base64::{engine::general_purpose, Engine as _};
    use clap::Parser;
    use scopeguard::defer;
    use std::{
        ffi::OsString,
        os::windows::{ffi::OsStringExt as _, io::AsRawHandle},
        path::{Path, PathBuf},
        ptr,
        time::Duration,
    };
    use sysinfo::System;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::windows::named_pipe::{ClientOptions, NamedPipeClient},
        time,
    };
    use tracing::{debug, error, level_filters::LevelFilter};
    use tracing_subscriber::{
        fmt, layer::SubscriberExt as _, util::SubscriberInitExt as _, EnvFilter, Layer as _,
    };
    use windows::{
        core::BOOL,
        Wdk::System::SystemServices::SE_DEBUG_PRIVILEGE,
        Win32::{
            Foundation::{
                CloseHandle, LocalFree, ERROR_PIPE_BUSY, HANDLE, HLOCAL, NTSTATUS, STATUS_SUCCESS,
            },
            Security::{
                self,
                Cryptography::{CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB},
                DuplicateToken, ImpersonateLoggedOnUser, RevertToSelf, TOKEN_DUPLICATE,
                TOKEN_QUERY,
            },
            System::{
                Pipes::GetNamedPipeServerProcessId,
                Threading::{
                    OpenProcess, OpenProcessToken, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                    PROCESS_QUERY_LIMITED_INFORMATION,
                },
            },
            UI::Shell::IsUserAnAdmin,
        },
    };

    use chromium_importer::chromium::{verify_signature, ADMIN_TO_USER_PIPE_NAME};

    #[derive(Parser)]
    #[command(name = "bitwarden_chromium_import_helper")]
    #[command(about = "Admin tool for ABE service management")]
    struct Args {
        /// Base64 encoded encrypted data to process
        #[arg(long, help = "Base64 encoded encrypted data string")]
        encrypted: String,
    }

    // Enable this to log to a file. The way this executable is used, it's not easy to debug and the stdout gets lost.
    // This is intended for development time only. All the logging is wrapped in `dbg_log!`` macro that compiles to
    // no-op when logging is disabled. This is needed to avoid any sensitive data being logged in production. Normally
    // all the logging code is present in the release build and could be enabled via RUST_LOG environment variable.
    // We don't want that!
    const ENABLE_DEVELOPER_LOGGING: bool = false;
    const LOG_FILENAME: &str = "c:\\path\\to\\log.txt"; // This is an example filename, replace it with you own

    // This should be enabled for production
    const ENABLE_SERVER_SIGNATURE_VALIDATION: bool = true;

    // List of SYSTEM process names to try to impersonate
    const SYSTEM_PROCESS_NAMES: [&str; 2] = ["services.exe", "winlogon.exe"];

    // Macro wrapper around debug! that compiles to no-op when ENABLE_DEVELOPER_LOGGING is false
    macro_rules! dbg_log {
        ($($arg:tt)*) => {
            if ENABLE_DEVELOPER_LOGGING {
                debug!($($arg)*);
            }
        };
    }

    async fn open_pipe_client(pipe_name: &'static str) -> Result<NamedPipeClient> {
        let max_attempts = 5;
        for _ in 0..max_attempts {
            match ClientOptions::new().open(pipe_name) {
                Ok(client) => {
                    dbg_log!("Successfully connected to the pipe!");
                    return Ok(client);
                }
                Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY.0 as i32) => {
                    dbg_log!("Pipe is busy, retrying in 50ms...");
                }
                Err(e) => {
                    dbg_log!("Failed to connect to pipe: {}", &e);
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

    async fn send_message_with_client(
        client: &mut NamedPipeClient,
        message: &str,
    ) -> Result<String> {
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
        dbg_log!("Resolving process executable path for PID {}", pid);

        // Open the process handle
        let hprocess = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }?;
        dbg_log!("Opened process handle for PID {}", pid);

        // Close when no longer needed
        defer! {
            dbg_log!("Closing process handle for PID {}", pid);
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
        dbg_log!(
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

    fn decrypt_data_base64(data_base64: &str, expect_appb: bool) -> Result<String> {
        dbg_log!("Decrypting data base64: {}", data_base64);

        let data = general_purpose::STANDARD.decode(data_base64).map_err(|e| {
            dbg_log!("Failed to decode base64: {} APPB: {}", e, expect_appb);
            e
        })?;

        let decrypted = decrypt_data(&data, expect_appb)?;
        let decrypted_base64 = general_purpose::STANDARD.encode(decrypted);

        Ok(decrypted_base64)
    }

    fn decrypt_data(data: &[u8], expect_appb: bool) -> Result<Vec<u8>> {
        if expect_appb && !data.starts_with(b"APPB") {
            dbg_log!("Decoded data does not start with 'APPB'");
            return Err(anyhow!("Decoded data does not start with 'APPB'"));
        }

        let data = if expect_appb { &data[4..] } else { data };

        let in_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut u8,
        };

        let mut out_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        let result = unsafe {
            CryptUnprotectData(
                &in_blob,
                None,
                None,
                None,
                None,
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut out_blob,
            )
        };

        if result.is_ok() && !out_blob.pbData.is_null() && out_blob.cbData > 0 {
            let decrypted = unsafe {
                std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec()
            };

            // Free the memory allocated by CryptUnprotectData
            unsafe { LocalFree(Some(HLOCAL(out_blob.pbData as *mut _))) };

            Ok(decrypted)
        } else {
            dbg_log!("CryptUnprotectData failed");
            Err(anyhow!("CryptUnprotectData failed"))
        }
    }

    //
    // Impersonate a SYSTEM process
    //

    fn start_impersonating() -> Result<HANDLE> {
        // Need to enable SE_DEBUG_PRIVILEGE to enumerate and open SYSTEM processes
        enable_debug_privilege()?;

        // Find a SYSTEM process and get its token. Not every SYSTEM process allows token duplication, so try several.
        let (token, pid, name) = find_system_process_with_token(get_system_pid_list())?;

        // Impersonate the SYSTEM process
        unsafe {
            ImpersonateLoggedOnUser(token)?;
        };
        dbg_log!("Impersonating system process '{}' (PID: {})", name, pid);

        Ok(token)
    }

    fn stop_impersonating(token: HANDLE) -> Result<()> {
        unsafe {
            RevertToSelf()?;
            CloseHandle(token)?;
        };
        Ok(())
    }

    fn find_system_process_with_token(
        pids: Vec<(u32, &'static str)>,
    ) -> Result<(HANDLE, u32, &'static str)> {
        for (pid, name) in pids {
            match get_system_token_from_pid(pid) {
                Err(_) => {
                    dbg_log!(
                        "Failed to open process handle '{}' (PID: {}), skipping",
                        name,
                        pid
                    );
                    continue;
                }
                Ok(system_handle) => {
                    return Ok((system_handle, pid, name));
                }
            }
        }
        Err(anyhow!("Failed to get system token from any process"))
    }

    fn get_system_token_from_pid(pid: u32) -> Result<HANDLE> {
        let handle = get_process_handle(pid)?;
        let token = get_system_token(handle)?;
        unsafe {
            CloseHandle(handle)?;
        };
        Ok(token)
    }

    fn get_system_token(handle: HANDLE) -> Result<HANDLE> {
        let token_handle = unsafe {
            let mut token_handle = HANDLE::default();
            OpenProcessToken(handle, TOKEN_DUPLICATE | TOKEN_QUERY, &mut token_handle)?;
            token_handle
        };

        let duplicate_token = unsafe {
            let mut duplicate_token = HANDLE::default();
            DuplicateToken(
                token_handle,
                Security::SECURITY_IMPERSONATION_LEVEL(2),
                &mut duplicate_token,
            )?;
            CloseHandle(token_handle)?;
            duplicate_token
        };

        Ok(duplicate_token)
    }

    fn get_system_pid_list() -> Vec<(u32, &'static str)> {
        let sys = System::new_all();
        SYSTEM_PROCESS_NAMES
            .iter()
            .flat_map(|&name| {
                sys.processes_by_exact_name(name.as_ref())
                    .map(move |process| (process.pid().as_u32(), name))
            })
            .collect()
    }

    fn get_process_handle(pid: u32) -> Result<HANDLE> {
        let hprocess = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }?;
        Ok(hprocess)
    }

    #[link(name = "ntdll")]
    unsafe extern "system" {
        unsafe fn RtlAdjustPrivilege(
            privilege: i32,
            enable: BOOL,
            current_thread: BOOL,
            previous_value: *mut BOOL,
        ) -> NTSTATUS;
    }

    fn enable_debug_privilege() -> Result<()> {
        let mut previous_value = BOOL(0);
        let status = unsafe {
            dbg_log!("Setting SE_DEBUG_PRIVILEGE to 1 via RtlAdjustPrivilege");
            RtlAdjustPrivilege(SE_DEBUG_PRIVILEGE, BOOL(1), BOOL(0), &mut previous_value)
        };

        match status {
            STATUS_SUCCESS => {
                dbg_log!(
                    "SE_DEBUG_PRIVILEGE set to 1, was {} before",
                    previous_value.as_bool()
                );
                Ok(())
            }
            _ => {
                dbg_log!("RtlAdjustPrivilege failed with status: 0x{:X}", status.0);
                Err(anyhow!("Failed to adjust privilege"))
            }
        }
    }

    //
    // Pipe
    //

    async fn open_and_validate_pipe_server(pipe_name: &'static str) -> Result<NamedPipeClient> {
        let client = open_pipe_client(pipe_name).await?;

        if ENABLE_SERVER_SIGNATURE_VALIDATION {
            let server_pid = get_named_pipe_server_pid(&client)?;
            dbg_log!("Connected to pipe server PID {}", server_pid);

            // Validate the server end process signature
            let exe_path = resolve_process_executable_path(server_pid)?;

            dbg_log!("Pipe server executable path: {}", exe_path.display());

            if !verify_signature(&exe_path)? {
                return Err(anyhow!("Pipe server signature is not valid"));
            }

            dbg_log!("Pipe server signature verified for PID {}", server_pid);
        }

        Ok(client)
    }

    fn run() -> Result<String> {
        dbg_log!("Starting bitwarden_chromium_import_helper.exe");

        let args = Args::try_parse()?;

        if !is_admin() {
            return Err(anyhow!("Expected to run with admin privileges"));
        }

        dbg_log!("Running as ADMINISTRATOR");

        // Impersonate a SYSTEM process to be able to decrypt data encrypted for the machine
        let system_decrypted_base64 = {
            let system_token = start_impersonating()?;
            defer! {
                dbg_log!("Stopping impersonation");
                _ = stop_impersonating(system_token);
            }
            let system_decrypted_base64 = decrypt_data_base64(&args.encrypted, true)?;
            dbg_log!("Decrypted data with system");
            system_decrypted_base64
        };

        // This is just to check that we're decrypting Chrome keys and not something else sent to us by a malicious actor.
        // Now that we're back from SYSTEM, we need to decrypt one more time just to verify.
        // Chrome keys are double encrypted: once at SYSTEM level and once at USER level.
        // When the decryption fails, it means that we're decrypting something unexpected.
        // We don't send this result back since the library will decrypt again at USER level.

        _ = decrypt_data_base64(&system_decrypted_base64, false).map_err(|e| {
            dbg_log!("User level decryption check failed: {}", e);
            e
        })?;

        dbg_log!("User level decryption check passed");

        Ok(system_decrypted_base64)
    }

    fn init_logging(log_path: &Path, file_level: LevelFilter) {
        // We only log to a file. It's impossible to see stdout/stderr when this exe is launched from ShellExecuteW.
        match std::fs::File::create(log_path) {
            Ok(file) => {
                let file_filter = EnvFilter::builder()
                    .with_default_directive(file_level.into())
                    .from_env_lossy();

                let file_layer = fmt::layer()
                    .with_writer(file)
                    .with_ansi(false)
                    .with_filter(file_filter);

                tracing_subscriber::registry().with(file_layer).init();
            }
            Err(error) => {
                error!(%error, ?log_path, "Could not create log file.");
            }
        }
    }

    pub(crate) async fn main() {
        if ENABLE_DEVELOPER_LOGGING {
            init_logging(LOG_FILENAME.as_ref(), LevelFilter::DEBUG);
        }

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
                dbg_log!("Sending response back to user");
                let _ = send_to_user(&mut client, &system_decrypted_base64).await;
            }
            Err(e) => {
                dbg_log!("Error: {}", e);
                send_error_to_user(&mut client, &format!("{}", e)).await;
            }
        }
    }
}

pub(crate) use windows_binary::*;
