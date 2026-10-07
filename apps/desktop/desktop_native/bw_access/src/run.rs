//! `run`: the command gets the credential in its environment; its output loses every secret.

use std::process::{ExitStatus, Stdio};

use anyhow::{Context as _, Result};
use tokio::io::{AsyncRead, AsyncReadExt as _, AsyncWrite, AsyncWriteExt as _};

use crate::redact::Redactor;

/// Returns the exit code to pass on: the command's, or 128 + signal on unix.
pub async fn run(
    command: &[String],
    env: Vec<(String, String)>,
    secrets: &[String],
) -> Result<i32> {
    let (program, args) = command.split_first().context("no command to run")?;
    let mut child = tokio::process::Command::new(program)
        .args(args)
        .envs(env)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("could not start '{program}'"))?;
    let stdout = child.stdout.take().context("no stdout pipe")?;
    let stderr = child.stderr.take().context("no stderr pipe")?;

    // Ctrl-C reaches the command too; outlive it so its last output is still scrubbed.
    tokio::spawn(async { while tokio::signal::ctrl_c().await.is_ok() {} });

    let (status, _, _) = tokio::join!(
        child.wait(),
        pump(stdout, tokio::io::stdout(), Redactor::new(secrets.to_vec())),
        pump(stderr, tokio::io::stderr(), Redactor::new(secrets.to_vec())),
    );
    Ok(exit_code(status?))
}

async fn pump(
    mut from: impl AsyncRead + Unpin,
    mut to: impl AsyncWrite + Unpin,
    mut redactor: Redactor,
) -> std::io::Result<()> {
    let mut buffer = [0; 8192];
    loop {
        let read = from.read(&mut buffer).await?;
        let scrubbed = match read {
            0 => redactor.finish(),
            read => redactor.push(&buffer[..read]),
        };
        to.write_all(&scrubbed).await?;
        to.flush().await?;
        if read == 0 {
            return Ok(());
        }
    }
}

fn exit_code(status: ExitStatus) -> i32 {
    #[cfg(unix)]
    if let Some(signal) = std::os::unix::process::ExitStatusExt::signal(&status) {
        return 128 + signal;
    }
    status.code().unwrap_or(crate::EXIT_ERROR)
}
