//! `run`: the command gets the credential in its environment; its output loses every secret.

use std::{
    collections::BTreeMap,
    io,
    pin::Pin,
    process::{ExitStatus, Stdio},
    task::{Context, Poll},
};

use agent_access::protocol::{CredentialData, Purpose};
use anyhow::{Context as _, Result};
use tokio::{
    io::{AsyncRead, AsyncReadExt as _, AsyncWrite, AsyncWriteExt as _},
    process::Child,
};

use crate::{
    cli::{self, Field},
    redact::Redactor,
};

pub const CAPTURE_LIMIT: usize = 1 << 20;

type Env = Vec<(String, String)>;

pub struct Captured {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub fn purpose(command: &[String], env: &BTreeMap<String, Field>) -> Purpose {
    Purpose {
        command: Some(cli::shell_join(command)),
        env: env
            .iter()
            .map(|(var, field)| (var.clone(), field.name().to_owned()))
            .collect(),
    }
}

/// The command's environment, and every secret to scrub from its output.
pub fn inject(
    env: BTreeMap<String, Field>,
    credential: CredentialData,
) -> Result<(Env, Vec<String>)> {
    let env = env
        .into_iter()
        .map(|(var, field)| Ok((var, field.value(&credential)?)))
        .collect::<Result<Vec<_>>>()?;
    let secrets = [credential.password, credential.totp]
        .into_iter()
        .flatten()
        .chain(env.iter().map(|(_, value)| value.clone()))
        .collect();
    Ok((env, secrets))
}

/// Returns the exit code to pass on: the command's, or 128 + signal on unix.
pub async fn stream(command: &[String], env: Env, secrets: &[String]) -> Result<i32> {
    let child = spawn(command, env, Stdio::inherit())?;
    // Ctrl-C reaches the command too; outlive it so its last output is still scrubbed.
    tokio::spawn(async { while tokio::signal::ctrl_c().await.is_ok() {} });
    scrub(child, secrets, tokio::io::stdout(), tokio::io::stderr()).await
}

/// No stdin; each stream is cut at [`CAPTURE_LIMIT`].
pub async fn capture(command: &[String], env: Env, secrets: &[String]) -> Result<Captured> {
    let child = spawn(command, env, Stdio::null())?;
    let (mut stdout, mut stderr) = (Capped::default(), Capped::default());
    let exit_code = scrub(child, secrets, &mut stdout, &mut stderr).await?;
    Ok(Captured {
        exit_code,
        stdout: stdout.text(),
        stderr: stderr.text(),
    })
}

fn spawn(command: &[String], env: Env, stdin: Stdio) -> Result<Child> {
    let (program, args) = command.split_first().context("no command to run")?;
    tokio::process::Command::new(program)
        .args(args)
        .envs(env)
        .stdin(stdin)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        // `mcp` drops the calls still running when its stdin closes.
        .kill_on_drop(true)
        .spawn()
        .with_context(|| format!("could not start '{program}'"))
}

async fn scrub(
    mut child: Child,
    secrets: &[String],
    stdout: impl AsyncWrite + Unpin,
    stderr: impl AsyncWrite + Unpin,
) -> Result<i32> {
    let from_stdout = child.stdout.take().context("no stdout pipe")?;
    let from_stderr = child.stderr.take().context("no stderr pipe")?;
    let (status, _, _) = tokio::join!(
        child.wait(),
        pump(from_stdout, stdout, Redactor::new(secrets.to_vec())),
        pump(from_stderr, stderr, Redactor::new(secrets.to_vec())),
    );
    Ok(exit_code(status?))
}

async fn pump(
    mut from: impl AsyncRead + Unpin,
    mut to: impl AsyncWrite + Unpin,
    mut redactor: Redactor,
) -> io::Result<()> {
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

/// Drops what is past the limit, still reading so the command never blocks on a full pipe.
#[derive(Default)]
struct Capped {
    kept: Vec<u8>,
    truncated: bool,
}

impl Capped {
    fn text(self) -> String {
        let mut text = String::from_utf8_lossy(&self.kept).into_owned();
        if self.truncated {
            text.push_str("\n[truncated after 1 MiB]");
        }
        text
    }
}

impl AsyncWrite for Capped {
    fn poll_write(
        self: Pin<&mut Self>,
        _: &mut Context<'_>,
        chunk: &[u8],
    ) -> Poll<io::Result<usize>> {
        let this = self.get_mut();
        let room = CAPTURE_LIMIT - this.kept.len();
        this.truncated |= chunk.len() > room;
        this.kept.extend_from_slice(&chunk[..chunk.len().min(room)]);
        Poll::Ready(Ok(chunk.len()))
    }

    fn poll_flush(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(unix)]
    #[tokio::test]
    async fn test_capture_scrubs_both_streams() {
        let command = ["sh", "-c", r#"echo "$T"; echo "x$T" >&2; exit 3"#].map(String::from);
        let env = vec![("T".to_owned(), "hunter2".to_owned())];

        let captured = capture(&command, env, &["hunter2".to_owned()])
            .await
            .unwrap();

        assert_eq!(captured.exit_code, 3);
        assert_eq!(captured.stdout, "[redacted]\n");
        assert_eq!(captured.stderr, "x[redacted]\n");
    }

    #[tokio::test]
    async fn test_capped_keeps_the_first_mebibyte() {
        let mut capped = Capped::default();

        capped
            .write_all(&vec![b'a'; CAPTURE_LIMIT - 1])
            .await
            .unwrap();
        capped.write_all(b"bc").await.unwrap();

        let text = capped.text();
        assert!(text.ends_with("ab\n[truncated after 1 MiB]"));
        assert_eq!(
            text.len(),
            CAPTURE_LIMIT + "\n[truncated after 1 MiB]".len()
        );
    }

    #[test]
    fn test_inject_scrubs_every_released_value() {
        let credential = CredentialData {
            username: Some("me".into()),
            password: Some("hunter2".into()),
            totp: Some("123456".into()),
            ..Default::default()
        };
        let env = BTreeMap::from([("U".to_owned(), Field::Username)]);

        let (env, secrets) = inject(env, credential).unwrap();

        assert_eq!(env, [("U".to_owned(), "me".to_owned())]);
        assert_eq!(secrets, ["hunter2", "123456", "me"]);
    }
}
