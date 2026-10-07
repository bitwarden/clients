//! `bw-access`: asks the running Bitwarden desktop app for a login, or for a yes/no decision.
//! Every request waits for the user to approve it there. See `cli::USAGE`.

mod cli;
mod client;
mod git;
mod mcp;
mod redact;
mod run;

use std::io::Write as _;

use agent_access::protocol::Status;
use anyhow::Result;
use cli::Command;
use client::Refused;

const EXIT_DENIED: i32 = 2;
const EXIT_NOT_FOUND: i32 = 3;
const EXIT_ERROR: i32 = 4;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let code = match cli::parse(std::env::args().skip(1)) {
        Ok(command) => execute(command).await.unwrap_or_else(|error| {
            report(&format!("{error:#}"));
            match error
                .downcast_ref::<Refused>()
                .map(|refused| refused.status)
            {
                Some(Status::Denied) => EXIT_DENIED,
                Some(Status::NotFound) => EXIT_NOT_FOUND,
                _ => EXIT_ERROR,
            }
        }),
        Err(error) => {
            report(&format!("{error} (see bw-access --help)"));
            EXIT_ERROR
        }
    };
    std::process::exit(code)
}

async fn execute(command: Command) -> Result<i32> {
    match command {
        Command::Help => print(&format!("{}\n", cli::USAGE))?,
        Command::Get { query, field } => {
            let credential = client::credential(query, None).await?;
            print(&format!("{}\n", field.value(&credential)?))?;
        }
        Command::Run {
            query,
            env,
            command,
        } => {
            let credential = client::credential(query, Some(run::purpose(&command, &env))).await?;
            let (env, secrets) = run::inject(env, credential)?;
            return run::stream(&command, env, &secrets).await;
        }
        Command::GitCredential { get } => {
            let attributes = git::read(std::io::stdin().lock())?;
            if get {
                let (query, purpose) = git::query(&attributes)?;
                let credential = client::credential(query, Some(purpose)).await?;
                print(&git::answer(&credential))?;
            }
        }
        Command::Ask(prompt) => {
            let approved = client::approve(prompt).await?;
            print(if approved { "yes\n" } else { "no\n" })?;
            if !approved {
                return Ok(EXIT_DENIED);
            }
        }
        Command::Mcp => mcp::serve(tokio::io::stdin(), tokio::io::stdout()).await?,
    }
    Ok(0)
}

// Not `print!`: the workspace denies the print macros.
fn print(text: &str) -> std::io::Result<()> {
    let mut stdout = std::io::stdout().lock();
    stdout.write_all(text.as_bytes())?;
    stdout.flush()
}

fn report(message: &str) {
    let _ = writeln!(std::io::stderr(), "bw-access: {message}");
}
