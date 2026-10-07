//! Hand-rolled argument parsing.

use std::collections::BTreeMap;

use agent_access::protocol::{ApprovalPrompt, CredentialData, CredentialQuery};
use anyhow::{anyhow, bail, ensure, Context as _, Result};

pub const USAGE: &str = "\
Usage:
  bw-access get <query> [--field json|username|password|totp]
  bw-access run <query> --env VAR=field [--env ...] -- <command> [args...]
  bw-access git-credential get|store|erase
  bw-access ask <title> [--body <text>]
  bw-access mcp

Asks the running Bitwarden desktop app for a login, or for a yes/no decision. Each request waits
for you to approve it there.

  <query>  --domain <domain> | --id <item id> | --search <name>
  run      sets each VAR to a field (username, password, totp) and redacts secrets from the
           command's output
  ask      prints yes or no
  mcp      serves run and ask as MCP tools over stdio, e.g.
           claude mcp add bitwarden -- /path/to/bw-access mcp

Exit codes: 0 approved, 2 denied, 3 not found, 4 error";

#[derive(Debug, PartialEq)]
pub enum Command {
    Help,
    Get {
        query: CredentialQuery,
        field: Field,
    },
    Run {
        query: CredentialQuery,
        env: BTreeMap<String, Field>,
        command: Vec<String>,
    },
    GitCredential {
        get: bool,
    },
    Ask(ApprovalPrompt),
    Mcp,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Field {
    Json,
    Username,
    Password,
    Totp,
}

impl Field {
    pub fn parse(name: &str) -> Result<Self> {
        Ok(match name {
            "json" => Self::Json,
            "username" => Self::Username,
            "password" => Self::Password,
            "totp" => Self::Totp,
            other => bail!("unknown field '{other}'"),
        })
    }

    pub fn name(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Username => "username",
            Self::Password => "password",
            Self::Totp => "totp",
        }
    }

    pub fn value(self, credential: &CredentialData) -> Result<String> {
        let value = match self {
            Self::Json => return Ok(serde_json::to_string(credential)?),
            Self::Username => &credential.username,
            Self::Password => &credential.password,
            Self::Totp => &credential.totp,
        };
        value
            .clone()
            .with_context(|| format!("the item has no {}", self.name()))
    }
}

pub fn parse(args: impl IntoIterator<Item = String>) -> Result<Command> {
    let mut args = args.into_iter();
    let subcommand = args.next().context("missing command")?;
    let mut query = None;
    let mut field = Field::Json;
    let mut env = BTreeMap::new();
    let mut command = Vec::new();
    let mut positional = None;
    let mut body = None;

    while let Some(arg) = args.next() {
        let mut value = || args.next().ok_or_else(|| anyhow!("{arg} needs a value"));
        let new_query = match (subcommand.as_str(), arg.as_str()) {
            (_, "-h" | "--help") => return Ok(Command::Help),
            ("get" | "run", "--domain") => CredentialQuery::Domain(value()?),
            ("get" | "run", "--id") => CredentialQuery::Id(value()?),
            ("get" | "run", "--search") => CredentialQuery::Search(value()?),
            ("get", "--field") => {
                field = Field::parse(&value()?)?;
                continue;
            }
            ("run", "--env") => {
                let (var, field) = parse_env(&value()?)?;
                env.insert(var, field);
                continue;
            }
            ("run", "--") => {
                command.extend(args);
                break;
            }
            ("ask", "--body") => {
                body = Some(value()?);
                continue;
            }
            ("git-credential" | "ask", text) if positional.is_none() && !text.starts_with('-') => {
                positional = Some(arg);
                continue;
            }
            (_, other) => bail!("unexpected argument '{other}'"),
        };
        ensure!(
            query.replace(new_query).is_none(),
            "use only one of --domain, --id or --search"
        );
    }

    let query = query.context("one of --domain, --id or --search is required");
    Ok(match subcommand.as_str() {
        "-h" | "--help" | "help" => Command::Help,
        "get" => Command::Get {
            query: query?,
            field,
        },
        "run" => {
            ensure!(!env.is_empty(), "run needs at least one --env VAR=field");
            ensure!(!command.is_empty(), "run needs a command after --");
            Command::Run {
                query: query?,
                env,
                command,
            }
        }
        "git-credential" => match positional.as_deref() {
            Some("get") => Command::GitCredential { get: true },
            Some("store" | "erase") => Command::GitCredential { get: false },
            _ => bail!("git-credential needs get, store or erase"),
        },
        "ask" => Command::Ask(ApprovalPrompt {
            title: positional.context("ask needs a title")?,
            body,
        }),
        "mcp" => Command::Mcp,
        other => bail!("unknown command '{other}'"),
    })
}

fn parse_env(spec: &str) -> Result<(String, Field)> {
    let (var, field) = spec
        .split_once('=')
        .filter(|(var, _)| !var.is_empty())
        .with_context(|| format!("--env expects VAR=field, got '{spec}'"))?;
    let field = Field::parse(field)?;
    ensure!(
        field != Field::Json,
        "--env fields are username, password or totp"
    );
    Ok((var.to_owned(), field))
}

/// Display only: the desktop shows it as the command to run.
pub fn shell_join(argv: &[String]) -> String {
    let quote = |arg: &String| {
        let plain = |c: char| c.is_ascii_alphanumeric() || "-_./:=@%+,".contains(c);
        if !arg.is_empty() && arg.chars().all(plain) {
            arg.clone()
        } else {
            format!("'{}'", arg.replace('\'', r"'\''"))
        }
    };
    argv.iter().map(quote).collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_str(args: &str) -> Result<Command> {
        parse(args.split(' ').map(str::to_owned))
    }

    #[test]
    fn test_parses_get() {
        assert_eq!(
            parse_str("get --domain github.com").unwrap(),
            Command::Get {
                query: CredentialQuery::Domain("github.com".into()),
                field: Field::Json,
            }
        );
        assert_eq!(
            parse_str("get --search GitHub --field totp").unwrap(),
            Command::Get {
                query: CredentialQuery::Search("GitHub".into()),
                field: Field::Totp,
            }
        );
    }

    #[test]
    fn test_parses_run_leaving_the_command_alone() {
        assert_eq!(
            parse_str("run --id x --env A=password --env B=username -- gh --help --id y").unwrap(),
            Command::Run {
                query: CredentialQuery::Id("x".into()),
                env: BTreeMap::from([("A".into(), Field::Password), ("B".into(), Field::Username)]),
                command: ["gh", "--help", "--id", "y"].map(String::from).to_vec(),
            }
        );
    }

    #[test]
    fn test_parses_git_credential_ask_and_mcp() {
        assert_eq!(
            parse_str("git-credential get").unwrap(),
            Command::GitCredential { get: true }
        );
        assert_eq!(
            parse_str("git-credential erase").unwrap(),
            Command::GitCredential { get: false }
        );
        assert_eq!(
            parse(["ask", "Deploy?", "--body", "3 to add"].map(String::from)).unwrap(),
            Command::Ask(ApprovalPrompt {
                title: "Deploy?".into(),
                body: Some("3 to add".into()),
            })
        );
        assert_eq!(parse_str("mcp").unwrap(), Command::Mcp);
    }

    #[test]
    fn test_help_anywhere_before_the_command() {
        for args in ["--help", "-h", "get --domain x -h", "ask --help"] {
            assert_eq!(parse_str(args).unwrap(), Command::Help, "for {args}");
        }
    }

    #[test]
    fn test_rejects_bad_arguments() {
        for args in [
            "get",
            "get --domain",
            "get --domain a --id b",
            "get --field secret --domain a",
            "get --env A=password --domain a",
            "run --domain a -- ls",
            "run --domain a --env A=password",
            "run --domain a --env A=json -- ls",
            "run --domain a --env =password -- ls",
            "git-credential",
            "git-credential fill",
            "ask",
            "ask a b",
            "mcp --stdio",
            "nope",
        ] {
            assert!(parse_str(args).is_err(), "accepted {args}");
        }
    }

    #[test]
    fn test_shell_join_quotes_only_when_needed() {
        let argv = ["sh", "-c", "echo \"$T\"", "it's", ""].map(String::from);

        assert_eq!(shell_join(&argv), r#"sh -c 'echo "$T"' 'it'\''s' ''"#);
    }

    #[test]
    fn test_field_value_errors_when_missing() {
        let credential = CredentialData {
            password: Some("p".into()),
            ..Default::default()
        };

        assert_eq!(Field::Password.value(&credential).unwrap(), "p");
        assert!(Field::Totp.value(&credential).is_err());
        assert_eq!(
            Field::Json.value(&credential).unwrap(),
            r#"{"password":"p"}"#
        );
    }
}
