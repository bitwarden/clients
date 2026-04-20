//! Generic script runner.
//!
//! SECURITY: This module executes arbitrary external programs. It MUST NOT be exposed
//! broadly through IPC. Every IPC caller is responsible for enforcing its own
//! allow-list of `program` and `args` at the boundary — see
//! `apps/desktop/src/platform/main/git-signing.main.ts` for the pattern.
//!
//! The runner never invokes a shell (`sh -c`, `cmd /C`, etc.). Arguments are passed
//! as argv to avoid quoting and injection issues.

use std::process::Stdio;
use std::time::Duration;

use thiserror::Error;
use tokio::process::Command;
use tokio::time::timeout;
use tracing::{debug, error};

/// Default timeout applied when the caller does not pass one.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Result of running a single script / command.
#[derive(Debug, Clone)]
pub struct ScriptResult {
    /// Child process exit code. `-1` when the child was terminated by a signal.
    pub exit_code: i32,
    /// Captured stdout as UTF-8 (lossy).
    pub stdout: String,
    /// Captured stderr as UTF-8 (lossy).
    pub stderr: String,
}

/// Error returned from [`run_script`].
#[derive(Debug, Error)]
pub enum ScriptError {
    /// Failed to spawn the child process (e.g. program not on PATH).
    #[error("failed to spawn child process: {0}")]
    Spawn(std::io::Error),
    /// I/O error while waiting on / communicating with the child.
    #[error("i/o error while running child process: {0}")]
    Io(std::io::Error),
    /// The child did not exit within the supplied timeout.
    #[error("child process timed out")]
    Timeout,
}

/// Run an external program and capture its stdout/stderr.
///
/// `program` is passed directly to the OS — it is not looked up via a shell.
/// `args` are passed as argv (no shell interpolation).
pub async fn run_script(
    program: String,
    args: Vec<String>,
    cwd: Option<String>,
    timeout_secs: Option<u64>,
) -> Result<ScriptResult, ScriptError> {
    let mut cmd = Command::new(&program);
    cmd.args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }

    // Avoid a console window flashing up on Windows when the child is a console app.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    debug!(program = %program, arg_count = args.len(), "spawning child process");

    let child = cmd.spawn().map_err(|e| {
        error!(program = %program, error = %e, "failed to spawn child");
        ScriptError::Spawn(e)
    })?;

    let duration = Duration::from_secs(timeout_secs.unwrap_or(DEFAULT_TIMEOUT.as_secs()));

    let output = match timeout(duration, child.wait_with_output()).await {
        Ok(Ok(o)) => o,
        Ok(Err(e)) => return Err(ScriptError::Io(e)),
        Err(_) => {
            error!(program = %program, "child process timed out");
            return Err(ScriptError::Timeout);
        }
    };

    let exit_code = output.status.code().unwrap_or(-1);
    let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    debug!(program = %program, exit_code, "child process exited");

    Ok(ScriptResult {
        exit_code,
        stdout,
        stderr,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn echo_program() -> (String, Vec<String>) {
        // Use `sh -c` in tests only — the production runner never does this.
        // On Windows, use cmd /C.
        #[cfg(windows)]
        {
            (
                "cmd".to_string(),
                vec!["/C".to_string(), "echo".to_string()],
            )
        }
        #[cfg(not(windows))]
        {
            ("/bin/echo".to_string(), vec![])
        }
    }

    #[tokio::test]
    async fn returns_stdout_on_success() {
        let (program, mut args) = echo_program();
        args.push("hello world".to_string());

        let result = run_script(program, args, None, Some(5)).await.expect("ok");

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("hello world"));
    }

    #[tokio::test]
    async fn argv_passes_shell_metacharacters_verbatim() {
        // The runner must NOT invoke a shell. The child should see the literal arg.
        let (program, mut args) = echo_program();
        let tricky = "key::ssh-ed25519 AAAAC3Nz+/abc'\"$(pwd)";
        args.push(tricky.to_string());

        let result = run_script(program, args, None, Some(5)).await.expect("ok");

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains(tricky), "got: {}", result.stdout);
    }

    #[tokio::test]
    async fn returns_nonzero_exit_on_failure() {
        // `false` / `cmd /C exit 1`
        #[cfg(windows)]
        let (program, args) = (
            "cmd".to_string(),
            vec!["/C".to_string(), "exit".to_string(), "1".to_string()],
        );
        #[cfg(not(windows))]
        let (program, args) = ("/bin/false".to_string(), vec![]);

        let result = run_script(program, args, None, Some(5)).await.expect("ok");

        assert_ne!(result.exit_code, 0);
    }

    #[tokio::test]
    async fn spawn_error_for_missing_program() {
        let err = run_script(
            "/nonexistent/definitely-not-a-real-binary".to_string(),
            vec![],
            None,
            Some(5),
        )
        .await
        .expect_err("should fail to spawn");

        matches!(err, ScriptError::Spawn(_));
    }

    #[tokio::test]
    async fn times_out_on_long_running_child() {
        #[cfg(windows)]
        let (program, args) = (
            "cmd".to_string(),
            vec![
                "/C".to_string(),
                "ping".to_string(),
                "-n".to_string(),
                "5".to_string(),
                "127.0.0.1".to_string(),
            ],
        );
        #[cfg(not(windows))]
        let (program, args) = ("/bin/sleep".to_string(), vec!["5".to_string()]);

        let err = run_script(program, args, None, Some(1))
            .await
            .expect_err("should time out");

        matches!(err, ScriptError::Timeout);
    }
}
