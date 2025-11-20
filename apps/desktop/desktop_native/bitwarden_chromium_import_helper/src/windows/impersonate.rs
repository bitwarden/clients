use anyhow::{anyhow, Result};
use sysinfo::System;
use tracing::debug;
use windows::{
    core::BOOL,
    Wdk::System::SystemServices::SE_DEBUG_PRIVILEGE,
    Win32::{
        Foundation::{CloseHandle, HANDLE, NTSTATUS, STATUS_SUCCESS},
        Security::{
            self, DuplicateToken, ImpersonateLoggedOnUser, RevertToSelf, TOKEN_DUPLICATE,
            TOKEN_QUERY,
        },
        System::Threading::{OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION},
    },
};

use super::config::SYSTEM_PROCESS_NAMES;

#[link(name = "ntdll")]
unsafe extern "system" {
    unsafe fn RtlAdjustPrivilege(
        privilege: i32,
        enable: BOOL,
        current_thread: BOOL,
        previous_value: *mut BOOL,
    ) -> NTSTATUS;
}

pub(crate) fn start_impersonating() -> Result<HANDLE> {
    // Need to enable SE_DEBUG_PRIVILEGE to enumerate and open SYSTEM processes
    enable_debug_privilege()?;

    // Find a SYSTEM process and get its token. Not every SYSTEM process allows token duplication,
    // so try several.
    let (token, pid, name) = find_system_process_with_token(get_system_pid_list())?;

    // Impersonate the SYSTEM process
    unsafe {
        ImpersonateLoggedOnUser(token)?;
    };
    debug!("Impersonating system process '{}' (PID: {})", name, pid);

    Ok(token)
}

pub(crate) fn stop_impersonating(token: HANDLE) -> Result<()> {
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
                debug!(
                    "Failed to open process handle '{}' (PID: {}), skipping",
                    name, pid
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

fn enable_debug_privilege() -> Result<()> {
    let mut previous_value = BOOL(0);
    let status = unsafe {
        debug!("Setting SE_DEBUG_PRIVILEGE to 1 via RtlAdjustPrivilege");
        RtlAdjustPrivilege(SE_DEBUG_PRIVILEGE, BOOL(1), BOOL(0), &mut previous_value)
    };

    match status {
        STATUS_SUCCESS => {
            debug!(
                "SE_DEBUG_PRIVILEGE set to 1, was {} before",
                previous_value.as_bool()
            );
            Ok(())
        }
        _ => {
            debug!("RtlAdjustPrivilege failed with status: 0x{:X}", status.0);
            Err(anyhow!("Failed to adjust privilege"))
        }
    }
}
