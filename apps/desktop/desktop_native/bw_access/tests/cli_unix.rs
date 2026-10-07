//! The built `bw-access` against a real agent with a stub answerer, over a temp socket.

#![cfg(unix)]

use std::{
    collections::BTreeMap,
    path::PathBuf,
    process::{Output, Stdio},
    sync::{Arc, Mutex},
};

use agent_access::{
    protocol::{ApprovalPrompt, CredentialData, CredentialQuery, Purpose},
    AgentRequest, Answerer, BitwardenCredentialAgent, Outcome, RequestKind, Router,
};
use async_trait::async_trait;
use tokio::io::AsyncWriteExt as _;

const ENV_SOCKET_PATH: &str = "BITWARDEN_ACCESS_SOCK";

struct Stub {
    answer: fn() -> Outcome,
    seen: Mutex<Option<RequestKind>>,
}

#[async_trait]
impl Answerer for Stub {
    async fn answer(&self, request: AgentRequest) -> Outcome {
        *self.seen.lock().expect("lock") = Some(request.kind);
        (self.answer)()
    }
}

struct Desktop {
    _agent: BitwardenCredentialAgent,
    stub: Arc<Stub>,
    path: PathBuf,
}

impl Desktop {
    fn start(name: &str, answer: fn() -> Outcome) -> Self {
        let path =
            std::env::temp_dir().join(format!("bw-access-cli-{name}-{}.sock", std::process::id()));
        let stub = Arc::new(Stub {
            answer,
            seen: Mutex::new(None),
        });
        // SAFETY: env-var mutation is serialized by #[serial].
        unsafe { std::env::set_var(ENV_SOCKET_PATH, &path) };
        let mut agent = BitwardenCredentialAgent::new(Arc::new(Router::new(stub.clone())));
        agent.start().expect("the agent should bind its socket");
        unsafe { std::env::remove_var(ENV_SOCKET_PATH) };
        Self {
            _agent: agent,
            stub,
            path,
        }
    }

    async fn bw_access(&self, args: &[&str], stdin: &str) -> Output {
        let mut child = tokio::process::Command::new(env!("CARGO_BIN_EXE_bw-access"))
            .args(args)
            .env(ENV_SOCKET_PATH, &self.path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn bw-access");
        let mut input = child.stdin.take().expect("stdin");
        input
            .write_all(stdin.as_bytes())
            .await
            .expect("write stdin");
        drop(input);
        child.wait_with_output().await.expect("wait")
    }

    fn seen(&self) -> RequestKind {
        self.stub
            .seen
            .lock()
            .expect("lock")
            .take()
            .expect("a request")
    }
}

fn granted() -> Outcome {
    Outcome::Approved(Some(CredentialData {
        username: Some("me".into()),
        password: Some("hunter2".into()),
        totp: Some("123456".into()),
        ..Default::default()
    }))
}

fn stdout(output: &Output) -> &str {
    std::str::from_utf8(&output.stdout).expect("utf-8")
}

fn credential_request(kind: RequestKind) -> (CredentialQuery, Option<Purpose>) {
    let RequestKind::Credential { query, purpose } = kind else {
        panic!("expected a credential request, got {kind:?}");
    };
    (query, purpose)
}

#[tokio::test]
#[serial_test::serial]
async fn test_get_prints_the_field() {
    let desktop = Desktop::start("get", granted);

    let output = desktop
        .bw_access(
            &["get", "--domain", "github.com", "--field", "password"],
            "",
        )
        .await;

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(stdout(&output), "hunter2\n");
    let (query, purpose) = credential_request(desktop.seen());
    assert_eq!(query, CredentialQuery::Domain("github.com".into()));
    assert_eq!(purpose, None);
}

#[tokio::test]
#[serial_test::serial]
async fn test_run_injects_the_secret_and_scrubs_it() {
    let desktop = Desktop::start("run", granted);
    let script = r#"echo "$TOKEN"; exit 7"#;

    let output = desktop
        .bw_access(
            &[
                "run",
                "--id",
                "x",
                "--env",
                "TOKEN=password",
                "--",
                "sh",
                "-c",
                script,
            ],
            "",
        )
        .await;

    assert_eq!(output.status.code(), Some(7));
    assert_eq!(stdout(&output), "[redacted]\n");
    let (_, purpose) = credential_request(desktop.seen());
    assert_eq!(
        purpose,
        Some(Purpose {
            command: Some(format!("sh -c '{script}'")),
            env: BTreeMap::from([("TOKEN".into(), "password".into())]),
        })
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_denied_exits_2_with_nothing_on_stdout() {
    let desktop = Desktop::start("denied", || Outcome::Denied);

    let output = desktop.bw_access(&["get", "--search", "GitHub"], "").await;

    assert_eq!(output.status.code(), Some(2));
    assert_eq!(stdout(&output), "");
}

#[tokio::test]
#[serial_test::serial]
async fn test_git_credential_get_answers_git() {
    let desktop = Desktop::start("git", granted);

    let output = desktop
        .bw_access(
            &["git-credential", "get"],
            "protocol=https\nhost=github.com:443\n\n",
        )
        .await;

    assert_eq!(output.status.code(), Some(0));
    assert_eq!(stdout(&output), "username=me\npassword=hunter2\n");
    let (query, purpose) = credential_request(desktop.seen());
    assert_eq!(query, CredentialQuery::Domain("github.com".into()));
    assert_eq!(
        purpose.and_then(|purpose| purpose.command).as_deref(),
        Some("git credential for https://github.com:443")
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_ask_prints_no_when_denied() {
    let desktop = Desktop::start("ask", || Outcome::Denied);

    let output = desktop
        .bw_access(&["ask", "Deploy?", "--body", "3 to add"], "")
        .await;

    assert_eq!(output.status.code(), Some(2));
    assert_eq!(stdout(&output), "no\n");
    let RequestKind::Approval { prompt } = desktop.seen() else {
        panic!("expected an approval request");
    };
    assert_eq!(
        prompt,
        ApprovalPrompt {
            title: "Deploy?".into(),
            body: Some("3 to add".into()),
        }
    );
}
