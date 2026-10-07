//! `bw-access mcp` over its stdio, against a real agent with a stub answerer on a temp socket.

#![cfg(unix)]

use std::{
    collections::BTreeMap,
    path::Path,
    process::Stdio,
    sync::{Arc, Mutex},
    time::Duration,
};

use agent_access::{
    protocol::{CredentialData, Purpose},
    AgentRequest, Answerer, BitwardenCredentialAgent, Outcome, RequestKind, Router,
};
use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::{
    io::{AsyncBufReadExt as _, AsyncWriteExt as _, BufReader, Lines},
    process::{Child, ChildStdin, ChildStdout},
};

const ENV_SOCKET_PATH: &str = "BITWARDEN_ACCESS_SOCK";

/// Grants logins at once; denies approvals slowly, so other requests overtake them.
#[derive(Default)]
struct Stub {
    seen: Mutex<Vec<RequestKind>>,
}

#[async_trait]
impl Answerer for Stub {
    async fn answer(&self, request: AgentRequest) -> Outcome {
        self.seen.lock().expect("lock").push(request.kind.clone());
        if let RequestKind::Credential { .. } = request.kind {
            return Outcome::Approved(Some(CredentialData {
                username: Some("me".into()),
                password: Some("hunter2".into()),
                ..Default::default()
            }));
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
        Outcome::Denied
    }
}

struct Server {
    child: Child,
    stdin: ChildStdin,
    stdout: Lines<BufReader<ChildStdout>>,
}

impl Server {
    fn start(socket: &Path) -> Self {
        let mut child = tokio::process::Command::new(env!("CARGO_BIN_EXE_bw-access"))
            .arg("mcp")
            .env(ENV_SOCKET_PATH, socket)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .expect("spawn bw-access mcp");
        let stdin = child.stdin.take().expect("stdin");
        let stdout = BufReader::new(child.stdout.take().expect("stdout")).lines();
        Self {
            child,
            stdin,
            stdout,
        }
    }

    async fn send(&mut self, message: Value) {
        let line = format!("{message}\n");
        self.stdin.write_all(line.as_bytes()).await.expect("write");
    }

    async fn receive(&mut self) -> Value {
        let line = tokio::time::timeout(Duration::from_secs(10), self.stdout.next_line())
            .await
            .expect("a reply in time")
            .expect("read")
            .expect("a line");
        serde_json::from_str(&line).expect("a JSON line")
    }

    async fn call(&mut self, id: u64, method: &str, params: Value) -> Value {
        let message = json!({ "jsonrpc": "2.0", "id": id, "method": method, "params": params });
        self.send(message).await;
        let reply = self.receive().await;
        assert_eq!(reply["id"], id, "{reply}");
        reply["result"].clone()
    }
}

#[tokio::test]
#[serial_test::serial]
async fn test_serves_the_tools_without_returning_secrets() {
    let path = std::env::temp_dir().join(format!("bw-access-mcp-{}.sock", std::process::id()));
    let stub = Arc::new(Stub::default());
    // SAFETY: env-var mutation is serialized by #[serial].
    unsafe { std::env::set_var(ENV_SOCKET_PATH, &path) };
    let mut agent = BitwardenCredentialAgent::new(Arc::new(Router::new(stub.clone())));
    agent.start().expect("the agent should bind its socket");
    unsafe { std::env::remove_var(ENV_SOCKET_PATH) };
    let mut server = Server::start(&path);

    let params = json!({ "protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {} });
    let result = server.call(1, "initialize", params).await;
    assert_eq!(result["protocolVersion"], "2025-06-18");
    let initialized = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });
    server.send(initialized).await;
    let result = server.call(2, "tools/list", json!({})).await;
    assert_eq!(result["tools"][0]["name"], "run_with_credential");
    assert_eq!(result["tools"][1]["name"], "ask_human");

    let script = r#"echo "$TOKEN""#;
    let arguments =
        json!({ "id": "x", "env": { "TOKEN": "password" }, "command": ["sh", "-c", script] });
    let params = json!({ "name": "run_with_credential", "arguments": arguments });
    let result = server.call(3, "tools/call", params).await;
    let text = result["content"][0]["text"].as_str().expect("text");
    assert!(
        text.contains("[redacted]") && !text.contains("hunter2"),
        "{text}"
    );
    let output: Value = serde_json::from_str(text).expect("JSON text");
    assert_eq!(
        output,
        json!({ "exitCode": 0, "stdout": "[redacted]\n", "stderr": "" })
    );
    assert_eq!(result["isError"], false);
    let Some(RequestKind::Credential { purpose, .. }) = stub.seen.lock().expect("lock").pop()
    else {
        panic!("expected a credential request");
    };
    assert_eq!(
        purpose,
        Some(Purpose {
            command: Some(format!("sh -c '{script}'")),
            env: BTreeMap::from([("TOKEN".into(), "password".into())]),
        })
    );

    let arguments = json!({ "title": "Deploy?" });
    let params = json!({ "name": "ask_human", "arguments": arguments });
    server
        .send(json!({ "jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": params }))
        .await;
    server
        .send(json!({ "jsonrpc": "2.0", "id": 5, "method": "ping" }))
        .await;
    assert_eq!(
        server.receive().await,
        json!({ "jsonrpc": "2.0", "id": 5, "result": {} })
    );
    let reply = server.receive().await;
    assert_eq!(reply["id"], 4);
    assert_eq!(
        reply["result"],
        json!({ "content": [{ "type": "text", "text": "no" }], "isError": false })
    );

    drop(server.stdin);
    let status = tokio::time::timeout(Duration::from_secs(10), server.child.wait())
        .await
        .expect("exits when stdin closes")
        .expect("wait");
    assert_eq!(status.code(), Some(0));
}
