use anyhow::{anyhow, Result};
use base64::{engine::general_purpose, Engine as _};
use clap::Parser;
use env_logger::Target;
use log::debug;
use std::{
    ffi::{OsStr, OsString},
    fs::OpenOptions,
    os::windows::ffi::OsStringExt as _,
    path::PathBuf,
    ptr,
    time::Duration,
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::windows::named_pipe::ClientOptions,
    time,
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
            DuplicateToken, ImpersonateLoggedOnUser, RevertToSelf, TOKEN_DUPLICATE, TOKEN_QUERY,
        },
        System::{
            ProcessStatus::{EnumProcesses, K32GetProcessImageFileNameW},
            Threading::{
                OpenProcess, OpenProcessToken, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
            },
        },
        UI::Shell::IsUserAnAdmin,
    },
};

use bitwarden_chromium_importer::abe_config;

#[derive(Parser)]
#[command(name = "admin")]
#[command(about = "Admin tool for ABE service management")]
struct Args {
    /// Base64 encoded encrypted data to process
    #[arg(long, help = "Base64 encoded encrypted data string")]
    encrypted: String,
}

// Enable this to log to a file. Debugging a system level service in any other way is not easy.
const NEED_LOGGING: bool = true;
const LOG_FILENAME: &str = "c:\\temp\\bitwarden-abe-admin-log.txt";

async fn send_message_to_pipe_server(pipe_name: &'static str, message: &str) -> Result<String> {
    // TODO: Don't loop forever, but retry a few times
    let mut client = loop {
        match ClientOptions::new().open(pipe_name) {
            Ok(client) => {
                debug!("Successfully connected to the pipe!");
                break client;
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
    }; // Send multiple messages to the server

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
        Err(e) => {
            return Err(anyhow!("Failed to receive response for message: {}", e));
        }
    }
}

async fn send_error_to_user(error_message: &str) {
    _ = send_to_user(&format!("!{}", error_message)).await
}

async fn send_to_user(message: &str) {
    _ = send_message_to_pipe_server(abe_config::ADMIN_TO_USER_PIPE_NAME, &message).await
}

fn is_admin() -> bool {
    unsafe { IsUserAnAdmin().as_bool() }
}

fn decrypt_data_base64(data_base64: &str, expect_appb: bool) -> Result<String> {
    debug!("Decrypting data base64: {}", data_base64);

    let data = general_purpose::STANDARD.decode(data_base64).map_err(|e| {
        debug!("Failed to decode base64: {} APPB: {}", e, expect_appb);
        e
    })?;

    let decrypted = decrypt_data(&data, expect_appb)?;
    let decrypted_base64 = general_purpose::STANDARD.encode(decrypted);

    Ok(decrypted_base64)
}

fn decrypt_data(data: &[u8], expect_appb: bool) -> Result<Vec<u8>> {
    if expect_appb && !data.starts_with(b"APPB") {
        debug!("Decoded data does not start with 'APPB'");
        return Err(anyhow!("Decoded data does not start with 'APPB'"));
    }

    let data = if expect_appb { &data[4..] } else { data };

    let mut in_blob = CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };

    let mut out_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    let result = unsafe {
        CryptUnprotectData(
            &mut in_blob,
            Some(ptr::null_mut()),
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
        debug!("CryptUnprotectData failed");
        Err(anyhow!("CryptUnprotectData failed"))
    }
}

//
// Impersonate a SYSTEM process
//

struct ImpersonateGuard {
    sys_token_handle: HANDLE,
}

impl Drop for ImpersonateGuard {
    fn drop(&mut self) {
        _ = Self::stop();
        _ = self.close_sys_handle();
    }
}

impl ImpersonateGuard {
    pub fn start(pid: Option<u32>, sys_handle: Option<HANDLE>) -> Result<(Self, u32)> {
        Self::enable_privilege()?;
        let pid = if let Some(pid) = pid {
            pid
        } else if let Some(pid) = Self::get_system_pid_list()?.next() {
            pid
        } else {
            return Err(anyhow!("Cannot find system process"));
        };
        let sys_token = if let Some(handle) = sys_handle {
            handle
        } else {
            let system_handle = Self::get_process_handle(pid)?;
            let sys_token = Self::get_system_token(system_handle)?;
            unsafe {
                CloseHandle(system_handle)?;
            };

            sys_token
        };
        unsafe {
            ImpersonateLoggedOnUser(sys_token)?;
        };
        Ok((
            Self {
                sys_token_handle: sys_token,
            },
            pid,
        ))
    }

    pub fn stop() -> Result<()> {
        unsafe {
            RevertToSelf()?;
        };
        Ok(())
    }

    /// stop impersonate and return sys token handle
    pub fn _stop_sys_handle(self) -> Result<HANDLE> {
        unsafe { RevertToSelf() }?;
        Ok(self.sys_token_handle)
    }

    pub fn close_sys_handle(&self) -> Result<()> {
        unsafe { CloseHandle(self.sys_token_handle) }?;
        Ok(())
    }

    fn enable_privilege() -> Result<()> {
        let mut previous_value = BOOL(0);
        let status = unsafe {
            RtlAdjustPrivilege(SE_DEBUG_PRIVILEGE, BOOL(1), BOOL(0), &mut previous_value)
        };
        if status != STATUS_SUCCESS {
            return Err(anyhow!("Failed to adjust privilege"));
        }
        Ok(())
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

    fn process_name_is<F>(pid: u32, name_is: F) -> Result<bool>
    where
        F: FnOnce(&OsStr) -> bool,
    {
        let hprocess = Self::get_process_handle(pid)?;

        let image_file_name = {
            let mut lpimagefilename = vec![0; 260];
            let length =
                unsafe { K32GetProcessImageFileNameW(hprocess, &mut lpimagefilename) } as usize;
            unsafe {
                CloseHandle(hprocess)?;
            };
            lpimagefilename.truncate(length);
            lpimagefilename
        };

        let fp = OsString::from_wide(&image_file_name);
        PathBuf::from(fp)
            .file_name()
            .map(name_is)
            .ok_or_else(|| anyhow::anyhow!("Failed to get process name"))
    }

    // https://learn.microsoft.com/en-us/windows/win32/psapi/enumerating-all-processes
    fn get_system_pid_list() -> Result<impl Iterator<Item = u32>> {
        let cap = 1024;
        let mut lpidprocess = Vec::with_capacity(cap);
        let mut lpcbneeded = 0;

        unsafe {
            EnumProcesses(lpidprocess.as_mut_ptr(), cap as u32 * 4, &mut lpcbneeded)?;
            let c_processes = lpcbneeded as usize / size_of::<u32>();
            lpidprocess.set_len(c_processes);
        };

        let filter = lpidprocess.into_iter().filter(|&v| {
            v != 0
                && Self::process_name_is(v, |n| n == "lsass.exe" || n == "winlogon.exe")
                    .unwrap_or(false)
        });
        Ok(filter)
    }

    fn get_process_handle(pid: u32) -> Result<HANDLE> {
        let hprocess =
            unsafe { OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid) }?;
        Ok(hprocess)
    }
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

macro_rules! debug_and_send_error {
    ($($arg:tt)*) => {
        {
            let error_message = format!($($arg)*);
            debug!("{}", error_message);
            send_error_to_user(&error_message).await;
        }
    };
}

#[tokio::main]
async fn main() {
    if NEED_LOGGING {
        colog::default_builder()
            .filter_level(log::STATIC_MAX_LEVEL) // Controlled by the feature flags in Cargo.toml
            .target(Target::Pipe(Box::new(
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(LOG_FILENAME)
                    .expect("Can't open the log file"),
            )))
            .init();
    }

    debug!("Starting admin");

    let args = match Args::try_parse() {
        Ok(args) => args,
        Err(e) => {
            debug_and_send_error!("Failed to parse command line arguments: {}", e);
            return;
        }
    };

    if !is_admin() {
        debug_and_send_error!("Expected to run with admin privileges");
        return;
    }

    debug!("Running as admin");

    // Impersonate a SYSTEM process to be able to decrypt data encrypted for the machine
    let system_decrypted_base64 = {
        // TODO: Handle errors better and report back to the user!
        let (_guard, pid) = ImpersonateGuard::start(None, None).unwrap();
        debug!("Impersonating system process with PID {}", pid);

        let system_decrypted = decrypt_data_base64(&args.encrypted, true);
        debug!("Decrypted data with system: {:?}", system_decrypted);

        if let Err(e) = system_decrypted {
            debug_and_send_error!("Failed to decrypt data: {}", e);
            return;
        }

        system_decrypted.unwrap()
    };

    debug!("Sending response back to user");
    send_to_user(&system_decrypted_base64).await;

    return;
}
