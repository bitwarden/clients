//! Detection of the built-in Windows OpenSSH agent service.
//!
//! SSH clients on Windows always connect to the well-known
//! `\\.\pipe\openssh-ssh-agent` named pipe, so the only thing standing between
//! them and Bitwarden is the built-in `ssh-agent` service owning that pipe.

use std::{os::windows::process::CommandExt, path::PathBuf, process::Command};

use anyhow::{anyhow, Result};

/// Name of the built-in OpenSSH Authentication Agent service.
const SSH_AGENT_SERVICE: &str = "ssh-agent";

/// Keeps the helper processes from flashing a console window.
/// <https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags>
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Exit code the query script uses to report a running service.
const EXIT_SERVICE_RUNNING: i32 = 1;

/// Location of `powershell.exe` below the Windows directory.
const POWERSHELL_RELATIVE_PATH: &str = r"System32\WindowsPowerShell\v1.0\powershell.exe";

/// Fallback used when `SystemRoot` is not set in the environment.
const DEFAULT_WINDOWS_DIR: &str = r"C:\Windows";

/// Reports whether the built-in service is out of the way.
///
/// # Errors
///
/// Returns an error if the query helper cannot be run or reports an unexpected result.
pub fn is_configured() -> Result<bool> {
    // The exit code carries the answer; `Status` and `StartType` are .NET enums,
    // so the comparisons are not affected by the system language.
    //
    // A stopped service that is still allowed to start counts as not configured:
    // it would grab the named pipe again at the next boot.
    let status = run_powershell(&format!(
        "$service = Get-Service {SSH_AGENT_SERVICE} -ErrorAction SilentlyContinue; \
         if ($null -ne $service -and \
         ($service.Status -eq 'Running' -or $service.StartType -ne 'Disabled')) \
         {{ exit {EXIT_SERVICE_RUNNING} }} else {{ exit 0 }}"
    ))?;

    match status {
        Some(0) => Ok(true),
        Some(EXIT_SERVICE_RUNNING) => Ok(false),
        other => Err(anyhow!(
            "Could not determine the state of the {SSH_AGENT_SERVICE} service (exit code {other:?})"
        )),
    }
}

/// Runs a script with the system `powershell.exe` rather than the first one on PATH.
fn run_powershell(script: &str) -> Result<Option<i32>> {
    let windows_dir = std::env::var("SystemRoot").unwrap_or_else(|_| DEFAULT_WINDOWS_DIR.into());

    let output = Command::new(PathBuf::from(windows_dir).join(POWERSHELL_RELATIVE_PATH))
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| anyhow!("Could not run powershell: {e}"))?;

    Ok(output.status.code())
}
