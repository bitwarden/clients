//! Script runner napi wrapper:
//! - Exposes the generic script runner to Electron.
//!
//! SECURITY: Callers in Electron's main process are responsible for enforcing
//! an allow-list at the IPC boundary. This NAPI surface accepts an arbitrary
//! `program` and `args` and must never be exposed to the renderer directly.

#[napi]
pub mod script_runner {
    use desktop_core::script_runner::{self, ScriptError};
    use tracing::error;

    /// A single command to execute. `program` is passed verbatim to the OS;
    /// `args` are passed as argv with no shell interpolation.
    #[napi(object)]
    pub struct ScriptCommand {
        pub program: String,
        pub args: Vec<String>,
        pub cwd: Option<String>,
        pub timeout_secs: Option<u32>,
    }

    /// Result of running a command.
    #[napi(object)]
    pub struct ScriptResult {
        pub exit_code: i32,
        pub stdout: String,
        pub stderr: String,
    }

    fn map_error(e: ScriptError) -> napi::Error {
        error!(error = %e, "script_runner error");
        napi::Error::from_reason(e.to_string())
    }

    /// Run a single command and return its result.
    #[napi]
    pub async fn run(command: ScriptCommand) -> napi::Result<ScriptResult> {
        let result = script_runner::run_script(
            command.program,
            command.args,
            command.cwd,
            command.timeout_secs.map(u64::from),
        )
        .await
        .map_err(map_error)?;

        Ok(ScriptResult {
            exit_code: result.exit_code,
            stdout: result.stdout,
            stderr: result.stderr,
        })
    }

    /// Run a batch of commands sequentially. Stops at the first non-zero exit
    /// and returns the partial result set up to and including the failing command.
    #[napi]
    pub async fn run_batch(commands: Vec<ScriptCommand>) -> napi::Result<Vec<ScriptResult>> {
        let mut results = Vec::with_capacity(commands.len());
        for command in commands {
            let result = script_runner::run_script(
                command.program,
                command.args,
                command.cwd,
                command.timeout_secs.map(u64::from),
            )
            .await
            .map_err(map_error)?;

            let exit_code = result.exit_code;
            results.push(ScriptResult {
                exit_code,
                stdout: result.stdout,
                stderr: result.stderr,
            });

            if exit_code != 0 {
                break;
            }
        }
        Ok(results)
    }
}
