//! `bw-access mcp`: the CLI's requests as MCP tools, newline-delimited JSON-RPC 2.0 on stdio.
//! Tool results never carry a secret value. stdout is the protocol; logs go to stderr.

use std::collections::BTreeMap;

use agent_access::protocol::{ApprovalPrompt, CredentialQuery, Status};
use anyhow::Result;
use serde_json::{json, Value};
use tokio::{
    io::{AsyncBufReadExt as _, AsyncRead, AsyncWrite, AsyncWriteExt as _, BufReader},
    task::JoinSet,
};

use crate::{
    cli::Field,
    client::{self, Refused},
    run,
};

/// Newest first. Later revisions drop `initialize`; their clients fall back to it on -32601.
const VERSIONS: [&str; 4] = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS: &str = "\
These tools reach the user's Bitwarden vault through the Bitwarden desktop app, which must be \
running. Each call opens a dialog there and waits, up to a minute, for the user to approve or deny \
it. Secret values never come back to you: run_with_credential puts a login into a command's \
environment and returns the command's output with those values replaced by [redacted]. Use \
ask_human for a yes/no decision from the user before a risky step.";

const PARSE_ERROR: i64 = -32700;
const INVALID_REQUEST: i64 = -32600;
const METHOD_NOT_FOUND: i64 = -32601;
const INVALID_PARAMS: i64 = -32602;

enum Call {
    Run {
        query: CredentialQuery,
        env: BTreeMap<String, Field>,
        command: Vec<String>,
    },
    Ask(ApprovalPrompt),
}

/// Until stdin closes. Each tool call runs on its own task, so a pending approval blocks nothing.
pub async fn serve(
    input: impl AsyncRead + Unpin,
    mut output: impl AsyncWrite + Unpin,
) -> Result<()> {
    let mut lines = BufReader::new(input).lines();
    let mut calls = JoinSet::new();
    loop {
        let reply = tokio::select! {
            line = lines.next_line() => match line? {
                Some(line) => dispatch(&line, &mut calls),
                None => break,
            },
            Some(done) = calls.join_next() => done.ok(),
        };
        if let Some(reply) = reply {
            write(&mut output, &reply).await?;
        }
    }
    // Kills the commands still running.
    calls.shutdown().await;
    Ok(())
}

/// The reply to send now, if any; a tool call replies through `calls` when done.
fn dispatch(line: &str, calls: &mut JoinSet<Value>) -> Option<Value> {
    if line.trim().is_empty() {
        return None;
    }
    let Ok(message) = serde_json::from_str::<Value>(line) else {
        return Some(error(Value::Null, PARSE_ERROR, "Parse error"));
    };
    let id = message.get("id").cloned();
    let Some(method) = message["method"].as_str() else {
        // Responses are dropped: this server sends no requests.
        let response = message.get("result").is_some() || message.get("error").is_some();
        return (!response)
            .then(|| error(id.unwrap_or_default(), INVALID_REQUEST, "Invalid Request"));
    };
    // Notifications get no reply: initialized, cancelled, and any other.
    let id = id?;
    let params = &message["params"];
    let result = match method {
        "initialize" => initialize(params),
        "ping" => json!({}),
        "tools/list" => json!({ "tools": tools() }),
        "tools/call" => {
            let call = match params["name"].as_str() {
                Some("run_with_credential") => parse_run(&params["arguments"]),
                Some("ask_human") => parse_ask(&params["arguments"]),
                _ => return Some(error(id, INVALID_PARAMS, "Unknown tool")),
            };
            match call {
                Ok(call) => {
                    calls.spawn(async move { success(id, call.answer().await) });
                    return None;
                }
                // A tool result, so the model can correct itself.
                Err(problem) => tool_result(&problem, true),
            }
        }
        _ => return Some(error(id, METHOD_NOT_FOUND, "Method not found")),
    };
    Some(success(id, result))
}

fn initialize(params: &Value) -> Value {
    let requested = params["protocolVersion"].as_str();
    let version = requested
        .filter(|version| VERSIONS.contains(version))
        .unwrap_or(VERSIONS[0]);
    json!({
        "protocolVersion": version,
        "capabilities": { "tools": {} },
        "serverInfo": { "name": "bitwarden-access", "version": env!("CARGO_PKG_VERSION") },
        "instructions": INSTRUCTIONS,
    })
}

// No top-level oneOf: the Claude API rejects it in tool schemas.
fn tools() -> Value {
    json!([
        {
            "name": "run_with_credential",
            "description": "Run a command with a login from the user's Bitwarden vault in its \
                environment. Returns JSON {exitCode, stdout, stderr}, with the login's secrets \
                replaced by [redacted]. Give exactly one of domain, id or search.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "domain": {
                        "type": "string",
                        "description": "Website of the login, e.g. github.com"
                    },
                    "id": { "type": "string", "description": "Vault item id" },
                    "search": {
                        "type": "string",
                        "description": "Text to find the item by, e.g. its name"
                    },
                    "env": {
                        "type": "object",
                        "description": "Environment variable name -> login field to set it to",
                        "additionalProperties": { "enum": ["username", "password", "totp"] },
                        "minProperties": 1
                    },
                    "command": {
                        "type": "array",
                        "items": { "type": "string" },
                        "minItems": 1,
                        "description": "Program and arguments, run with no shell and no stdin; \
                            use [\"sh\", \"-c\", \"...\"] to expand variables"
                    }
                },
                "required": ["env", "command"],
                "additionalProperties": false
            }
        },
        {
            "name": "ask_human",
            "description": "Ask the user a yes/no question in the Bitwarden desktop app. Returns \
                yes or no.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "The question, e.g. Run terraform apply on prod?"
                    },
                    "body": { "type": "string", "description": "Details to help the user decide" }
                },
                "required": ["title"],
                "additionalProperties": false
            }
        }
    ])
}

fn parse_run(arguments: &Value) -> Result<Call, String> {
    let queries: Vec<_> = [
        (
            "domain",
            CredentialQuery::Domain as fn(String) -> CredentialQuery,
        ),
        ("id", CredentialQuery::Id),
        ("search", CredentialQuery::Search),
    ]
    .into_iter()
    .filter_map(|(key, query)| {
        let value = arguments[key]
            .as_str()
            .filter(|value| !value.trim().is_empty())?;
        Some(query(value.to_owned()))
    })
    .collect();
    let [query] =
        <[_; 1]>::try_from(queries).map_err(|_| "give exactly one of domain, id or search")?;
    let env = arguments["env"]
        .as_object()
        .filter(|env| !env.is_empty())
        .ok_or("env needs at least one variable")?
        .iter()
        .map(|(var, field)| {
            if var.is_empty() || var.contains(['=', '\0']) {
                return Err(format!("{var:?} is not a valid variable name"));
            }
            match field.as_str().map(Field::parse) {
                Some(Ok(field)) if field != Field::Json => Ok((var.clone(), field)),
                _ => Err(format!("env.{var} must be username, password or totp")),
            }
        })
        .collect::<Result<_, _>>()?;
    let command = arguments["command"]
        .as_array()
        .filter(|command| !command.is_empty())
        .and_then(|command| {
            command
                .iter()
                .map(|arg| Some(arg.as_str()?.to_owned()))
                .collect()
        })
        .ok_or("command must be a non-empty array of strings")?;
    Ok(Call::Run {
        query,
        env,
        command,
    })
}

fn parse_ask(arguments: &Value) -> Result<Call, String> {
    let title = arguments["title"]
        .as_str()
        .filter(|title| !title.trim().is_empty())
        .ok_or("title is required")?;
    let body = match &arguments["body"] {
        Value::Null => None,
        body => Some(body.as_str().ok_or("body must be a string")?.to_owned()),
    };
    Ok(Call::Ask(ApprovalPrompt {
        title: title.to_owned(),
        body,
    }))
}

impl Call {
    async fn answer(self) -> Value {
        match self {
            Self::Ask(prompt) => match client::approve(prompt).await {
                Ok(approved) => tool_result(if approved { "yes" } else { "no" }, false),
                Err(error) => tool_result(&refusal(&error), true),
            },
            Self::Run {
                query,
                env,
                command,
            } => match run_with_credential(query, env, &command).await {
                Ok(run::Captured {
                    exit_code,
                    stdout,
                    stderr,
                }) => {
                    let text = json!({ "exitCode": exit_code, "stdout": stdout, "stderr": stderr });
                    tool_result(&text.to_string(), exit_code != 0)
                }
                Err(problem) => tool_result(&problem, true),
            },
        }
    }
}

async fn run_with_credential(
    query: CredentialQuery,
    env: BTreeMap<String, Field>,
    command: &[String],
) -> Result<run::Captured, String> {
    let purpose = run::purpose(command, &env);
    let credential = client::credential(query, Some(purpose))
        .await
        .map_err(|error| refusal(&error))?;
    let (env, secrets) = run::inject(env, credential).map_err(|error| format!("{error:#}"))?;
    run::capture(command, env, &secrets)
        .await
        .map_err(|error| format!("{error:#}"))
}

/// Fixed wording: no vault data, no socket path. The detail goes to stderr.
fn refusal(error: &anyhow::Error) -> String {
    crate::report(&format!("{error:#}"));
    match error
        .downcast_ref::<Refused>()
        .map(|refused| refused.status)
    {
        Some(Status::Denied) => "The user denied the request.",
        Some(Status::NotFound) => "No matching item was found in the vault.",
        Some(Status::Locked) => "The vault is locked; ask the user to unlock Bitwarden.",
        Some(Status::Timeout) => "The user did not answer in time.",
        Some(_) => "The Bitwarden desktop app could not answer the request.",
        None => {
            "Could not reach the Bitwarden desktop app. It must be running, with \"Allow apps and \
             agents to request items\" on."
        }
    }
    .to_owned()
}

fn tool_result(text: &str, is_error: bool) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": is_error })
}

fn success(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

fn error(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

async fn write(output: &mut (impl AsyncWrite + Unpin), message: &Value) -> std::io::Result<()> {
    let mut line = serde_json::to_vec(message)?;
    line.push(b'\n');
    output.write_all(&line).await?;
    output.flush().await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn send(message: Value) -> Option<Value> {
        dispatch(&message.to_string(), &mut JoinSet::new())
    }

    fn request(method: &str, params: Value) -> Value {
        let message = json!({ "jsonrpc": "2.0", "id": 7, "method": method, "params": params });
        send(message).expect("a reply")
    }

    #[test]
    fn test_initialize_echoes_a_supported_version() {
        for (requested, agreed) in [
            (json!("2024-11-05"), "2024-11-05"),
            (json!("2025-06-18"), "2025-06-18"),
            (json!("2026-07-28"), "2025-11-25"),
            (Value::Null, "2025-11-25"),
        ] {
            let params = json!({ "protocolVersion": requested, "capabilities": {} });

            let reply = request("initialize", params);

            assert_eq!(reply["result"]["protocolVersion"], agreed);
        }
        let result = &request("initialize", json!({}))["result"];
        assert_eq!(result["serverInfo"]["name"], "bitwarden-access");
        assert_eq!(result["capabilities"], json!({ "tools": {} }));
        assert!(result["instructions"].as_str().is_some());
    }

    #[test]
    fn test_answers_ping_and_lists_the_tools() {
        assert_eq!(
            request("ping", Value::Null),
            json!({ "jsonrpc": "2.0", "id": 7, "result": {} })
        );
        let tools = request("tools/list", json!({}))["result"]["tools"].clone();
        let names: Vec<_> = tools
            .as_array()
            .unwrap()
            .iter()
            .map(|tool| &tool["name"])
            .collect();
        assert_eq!(names, ["run_with_credential", "ask_human"]);
    }

    #[test]
    fn test_rejects_unknown_methods_and_bad_json() {
        assert_eq!(
            request("resources/list", json!({}))["error"]["code"],
            METHOD_NOT_FOUND
        );
        let parse_error = json!({ "code": -32700, "message": "Parse error" });
        assert_eq!(
            dispatch("{nope", &mut JoinSet::new()),
            Some(json!({ "jsonrpc": "2.0", "id": null, "error": parse_error }))
        );
        assert_eq!(
            send(json!({ "id": 1 })).unwrap()["error"]["code"],
            INVALID_REQUEST
        );
    }

    #[test]
    fn test_notifications_and_responses_get_no_reply() {
        for method in [
            "notifications/initialized",
            "notifications/cancelled",
            "x/y",
            "ping",
        ] {
            assert_eq!(
                send(json!({ "jsonrpc": "2.0", "method": method })),
                None,
                "{method}"
            );
        }
        assert_eq!(
            send(json!({ "jsonrpc": "2.0", "id": 1, "result": {} })),
            None
        );
        assert_eq!(dispatch(" ", &mut JoinSet::new()), None);
    }

    #[test]
    fn test_bad_tool_arguments_are_tool_errors() {
        let run_with = |key: &str, value: Value| {
            let mut arguments =
                json!({ "domain": "a", "env": { "T": "password" }, "command": ["ls"] });
            arguments[key] = value;
            ("run_with_credential", arguments)
        };
        for (name, arguments) in [
            run_with("domain", Value::Null),
            run_with("id", json!("b")),
            run_with("domain", json!(" ")),
            run_with("env", json!({})),
            run_with("env", json!({ "T": "json" })),
            run_with("env", json!({ "A=B": "password" })),
            run_with("command", json!([])),
            run_with("command", json!(["ls", 1])),
            ("run_with_credential", Value::Null),
            ("ask_human", json!({})),
            ("ask_human", json!({ "title": "Deploy?", "body": 3 })),
        ] {
            let reply = request(
                "tools/call",
                json!({ "name": name, "arguments": arguments }),
            );

            assert_eq!(reply["result"]["isError"], true, "{arguments}");
        }
        let reply = request("tools/call", json!({ "name": "rm", "arguments": {} }));
        assert_eq!(reply["error"]["code"], INVALID_PARAMS);
    }

    #[test]
    fn test_parses_run_with_credential() {
        let arguments = json!({
            "search": "GitHub",
            "env": { "GH_TOKEN": "password", "GH_USER": "username" },
            "command": ["gh", "pr", "list"],
        });

        let Ok(Call::Run {
            query,
            env,
            command,
        }) = parse_run(&arguments)
        else {
            panic!("expected a run");
        };

        assert_eq!(query, CredentialQuery::Search("GitHub".into()));
        assert_eq!(env["GH_TOKEN"], Field::Password);
        assert_eq!(env["GH_USER"], Field::Username);
        assert_eq!(command, ["gh", "pr", "list"]);
    }
}
