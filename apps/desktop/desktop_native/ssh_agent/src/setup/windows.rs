//! Detection and disabling of the built-in Windows OpenSSH agent service.
//!
//! SSH clients on Windows always connect to the well-known
//! `\\.\pipe\openssh-ssh-agent` named pipe, so the only thing standing between
//! them and Bitwarden is the built-in `ssh-agent` service owning that pipe.

use std::{os::windows::process::CommandExt, process::Command};

use anyhow::{anyhow, Result};
use tracing::info;

/// Name of the built-in OpenSSH Authentication Agent service.
const SSH_AGENT_SERVICE: &str = "ssh-agent";

/// Keeps the helper processes from flashing a console window.
/// <https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags>
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Exit code the query script uses to report a running service.
const EXIT_SERVICE_RUNNING: i32 = 1;

/// Reports whether the built-in service is out of the way.
///
/// # Errors
///
/// Returns an error if the query helper cannot be run or reports an unexpected result.
pub fn is_configured() -> Result<bool> {
    // The exit code carries the answer; `Status -eq 'Running'` compares a .NET enum,
    // so it is not affected by the system language.
    let status = run_powershell(&format!(
        "if ((Get-Service {SSH_AGENT_SERVICE} -ErrorAction SilentlyContinue).Status -eq 'Running') \
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

/// Stops the built-in service and prevents it from starting again.
///
/// Both operations require administrator rights, which the app does not have, so
/// the work is delegated to an elevated child process. The user sees a UAC prompt
/// and cancelling it surfaces as an error.
///
/// # Errors
///
/// Returns an error if the elevated process cannot be started, is declined, or fails.
pub fn apply_configuration() -> Result<()> {
    // Single-quoted and free of `$` so it survives being nested inside the outer
    // script that elevates it.
    let elevated_script = format!(
        "Stop-Service {SSH_AGENT_SERVICE} -Force -ErrorAction Stop; \
         Set-Service {SSH_AGENT_SERVICE} -StartupType Disabled -ErrorAction Stop"
    );

    let status = run_powershell(&format!(
        "$process = Start-Process powershell -Verb RunAs -Wait -PassThru -WindowStyle Hidden \
         -ArgumentList '-NoProfile','-Command','{elevated_script}'; exit $process.ExitCode"
    ))?;

    if status != Some(0) {
        return Err(anyhow!(
            "Could not disable the {SSH_AGENT_SERVICE} service (exit code {status:?})"
        ));
    }

    info!(service = SSH_AGENT_SERVICE, "service stopped and disabled");

    Ok(())
}

fn run_powershell(script: &str) -> Result<Option<i32>> {
    let output = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| anyhow!("Could not run powershell: {e}"))?;

    Ok(output.status.code())
}
