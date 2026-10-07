//! One JSON line to the desktop app, one back.

use std::{
    fmt,
    time::{SystemTime, UNIX_EPOCH},
};

use agent_access::protocol::{
    ApprovalPrompt, CredentialData, CredentialQuery, Purpose, Request, Response, Status,
    PROTOCOL_VERSION,
};
use anyhow::{bail, Context as _, Result};
use tokio::io::{AsyncBufReadExt as _, AsyncWriteExt as _, BufReader};

const NOT_RUNNING: &str =
    "the Bitwarden desktop app must be running, with \"Allow apps and agents to request items\" on";

/// The desktop answered, but not with approved.
#[derive(Debug)]
pub struct Refused {
    pub status: Status,
    error: Option<String>,
}

impl fmt::Display for Refused {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match (self.status, &self.error) {
            (Status::Denied, _) => "the request was denied",
            (Status::NotFound, _) => "no matching item was found",
            (Status::Locked, _) => "the vault is locked",
            (Status::Timeout, _) => "the request timed out",
            (_, Some(error)) => error,
            _ => "the desktop app could not answer the request",
        })
    }
}

impl std::error::Error for Refused {}

/// Fails with [`Refused`] unless approved.
pub async fn credential(
    query: CredentialQuery,
    purpose: Option<Purpose>,
) -> Result<CredentialData> {
    let message = Request::CredentialRequest {
        request_id: request_id(),
        query,
        purpose,
    };
    match request(&message).await? {
        Response::CredentialResponse {
            status: Status::Approved,
            credential: Some(credential),
            ..
        } => Ok(credential),
        response => Err(refused(response)),
    }
}

/// `Ok(false)` when denied; other outcomes fail with [`Refused`].
pub async fn approve(prompt: ApprovalPrompt) -> Result<bool> {
    let message = Request::ApprovalRequest {
        request_id: request_id(),
        prompt,
    };
    match request(&message).await? {
        Response::ApprovalResponse {
            status: Status::Approved,
            ..
        } => Ok(true),
        Response::ApprovalResponse {
            status: Status::Denied,
            ..
        } => Ok(false),
        response => Err(refused(response)),
    }
}

fn refused(response: Response) -> anyhow::Error {
    let (status, error) = match response {
        Response::CredentialResponse { status, error, .. }
        | Response::ApprovalResponse { status, error, .. } => (status, error),
        Response::Error { status, error } => (status, Some(error)),
    };
    Refused { status, error }.into()
}

/// Unique enough to match a desktop log line to a call.
fn request_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| elapsed.subsec_nanos());
    format!("{:x}-{nanos:x}", std::process::id())
}

pub async fn request(request: &Request) -> Result<Response> {
    let mut line = serde_json::to_value(request)?;
    line["v"] = PROTOCOL_VERSION.into();
    let mut line = serde_json::to_vec(&line)?;
    line.push(b'\n');

    let mut stream = BufReader::new(connect().await?);
    stream.get_mut().write_all(&line).await?;

    let mut response = String::new();
    if stream.read_line(&mut response).await? == 0 {
        bail!("the desktop app closed the connection without answering");
    }
    serde_json::from_str(&response).context("could not parse the desktop app's response")
}

#[cfg(unix)]
async fn connect() -> Result<tokio::net::UnixStream> {
    let paths = agent_access::socket_paths()?;
    for path in &paths {
        if let Ok(stream) = tokio::net::UnixStream::connect(path).await {
            return Ok(stream);
        }
    }
    bail!(
        "could not connect to {} ({NOT_RUNNING})",
        paths[0].display()
    )
}

#[cfg(windows)]
async fn connect() -> Result<tokio::net::windows::named_pipe::NamedPipeClient> {
    const ERROR_PIPE_BUSY: i32 = 231;
    let name = agent_access::pipe_name()?;
    // Busy: another client took the free instance; the server opens the next one right away.
    for _ in 0..20 {
        match tokio::net::windows::named_pipe::ClientOptions::new().open(&name) {
            Err(error) if error.raw_os_error() == Some(ERROR_PIPE_BUSY) => {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
            result => {
                let pipe = result
                    .with_context(|| format!("could not connect to {name} ({NOT_RUNNING})"))?;
                agent_access::verify_pipe_server(&pipe)?;
                return Ok(pipe);
            }
        }
    }
    bail!("{name} stayed busy")
}
