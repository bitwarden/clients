//! `credential_client` — asks the running Bitwarden desktop app for a login credential.
//!
//! ```text
//! credential_client --domain github.com
//! credential_client --search "GitHub" --field password
//! ```
//!
//! The desktop app prompts the user for approval according to its credential agent
//! setting, so a request may block until the user answers, and may be denied.

use std::io::Write as _;

use agent_access::protocol::{CredentialData, Response, Status, PROTOCOL_VERSION};
use anyhow::{anyhow, bail, Context as _, Result};
use serde_json::json;
use tokio::io::{AsyncBufReadExt as _, AsyncWriteExt as _, BufReader};

/// Exit codes, so callers can branch on the outcome without parsing stderr.
const EXIT_DENIED: i32 = 2;
const EXIT_NOT_FOUND: i32 = 3;
const EXIT_ERROR: i32 = 4;

const USAGE: &str = "\
Usage: credential_client (--domain <domain> | --id <id> | --search <text>) [--field <field>]

Requests a login credential from the running Bitwarden desktop app.

Options:
  --domain <domain>  Match against the item's login URIs
  --id <id>          The item's id
  --search <text>    Match against the item's name
  --field <field>    One of: json (default), username, password, totp
  -h, --help       Print this help

Exit codes: 0 granted, 2 denied, 3 not found, 4 error";

/// Which part of the credential to write to stdout.
enum Field {
    Json,
    Username,
    Password,
    Totp,
}

impl Field {
    fn parse(value: &str) -> Result<Self> {
        match value {
            "json" => Ok(Self::Json),
            "username" => Ok(Self::Username),
            "password" => Ok(Self::Password),
            "totp" => Ok(Self::Totp),
            other => Err(anyhow!("unknown field '{other}'")),
        }
    }
}

struct Args {
    query: serde_json::Value,
    field: Field,
}

fn parse_args() -> Result<Option<Args>> {
    let mut query = None;
    let mut field = Field::Json;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        let mut value = || args.next().ok_or_else(|| anyhow!("{arg} requires a value"));

        match arg.as_str() {
            "--domain" => query = Some(json!({ "domain": value()? })),
            "--id" => query = Some(json!({ "id": value()? })),
            "--search" => query = Some(json!({ "search": value()? })),
            "--field" => field = Field::parse(&value()?)?,
            "-h" | "--help" => return Ok(None),
            other => bail!("unknown argument '{other}'"),
        }
    }

    let Some(query) = query else {
        bail!("one of --domain, --id or --search is required");
    };

    Ok(Some(Args { query, field }))
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let args = match parse_args() {
        Ok(Some(args)) => args,
        Ok(None) => {
            print_line(USAGE);
            return;
        }
        Err(error) => fail(&format!("{error}\n\n{USAGE}")),
    };

    let response = match request(&args).await {
        Ok(response) => response,
        Err(error) => fail(&format!("{error:#}")),
    };

    match response {
        Response::CredentialResponse {
            status: Status::Approved,
            credential: Some(credential),
            ..
        } => print_credential(&credential, &args.field),
        Response::CredentialResponse {
            status: Status::Denied,
            ..
        } => exit_with(EXIT_DENIED, "the request was denied"),
        Response::CredentialResponse {
            status: Status::NotFound,
            ..
        } => exit_with(EXIT_NOT_FOUND, "no matching credential was found"),
        Response::CredentialResponse { status, error, .. } => {
            fail(&error.unwrap_or_else(|| format!("the request ended with status {status:?}")))
        }
        Response::ApprovalResponse { .. } => fail("unexpected response"),
        Response::Error { error, .. } => fail(&error),
    }
}

/// Sends one request over the agent transport and reads the single response line back.
async fn request(args: &Args) -> Result<Response> {
    let payload = json!({
        "v": PROTOCOL_VERSION,
        "type": "credential-request",
        "requestId": std::process::id().to_string(),
        "query": args.query,
    });

    let stream = connect().await?;
    let mut stream = BufReader::new(stream);

    let mut line = serde_json::to_vec(&payload)?;
    line.push(b'\n');
    stream.get_mut().write_all(&line).await?;
    stream.get_mut().flush().await?;

    let mut response = String::new();
    if stream.read_line(&mut response).await? == 0 {
        bail!("the desktop app closed the connection without responding");
    }

    serde_json::from_str(&response).context("could not parse the agent response")
}

#[cfg(unix)]
async fn connect() -> Result<tokio::net::UnixStream> {
    let path = agent_access::socket_path()?;

    tokio::net::UnixStream::connect(&path).await.with_context(|| {
        format!(
            "could not connect to {}; is the Bitwarden desktop app running with the credential agent enabled?",
            path.display()
        )
    })
}

#[cfg(windows)]
#[allow(clippy::unused_async, reason = "mirrors the unix signature")]
async fn connect() -> Result<tokio::net::windows::named_pipe::NamedPipeClient> {
    let name = agent_access::pipe_name();

    tokio::net::windows::named_pipe::ClientOptions::new()
        .open(name)
        .with_context(|| {
            format!(
                "could not connect to {name}; is the Bitwarden desktop app running with the credential agent enabled?"
            )
        })
}

fn print_credential(credential: &CredentialData, field: &Field) {
    let value = match field {
        Field::Json => serde_json::to_string(credential).unwrap_or_default(),
        Field::Username => credential.username.clone().unwrap_or_default(),
        Field::Password => credential.password.clone().unwrap_or_default(),
        Field::Totp => credential.totp.clone().unwrap_or_default(),
    };

    print_line(&value);
}

// `writeln!` rather than `println!`: the workspace denies the print macros, and this
// binary's whole purpose is writing its result to stdout.
fn print_line(text: &str) {
    let _ = writeln!(std::io::stdout(), "{text}");
}

fn exit_with(code: i32, message: &str) -> ! {
    let _ = writeln!(std::io::stderr(), "{message}");
    std::process::exit(code)
}

fn fail(message: &str) -> ! {
    exit_with(EXIT_ERROR, message)
}
