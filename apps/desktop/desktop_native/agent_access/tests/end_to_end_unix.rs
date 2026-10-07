//! End to end over a real Unix socket: start, request, response, stop.

#![cfg(unix)]

use std::{path::PathBuf, sync::Arc};

use agent_access::{
    protocol::{CredentialData, CredentialQuery},
    AgentRequest, Answerer, BitwardenCredentialAgent, Outcome, RequestKind, Router,
};
use async_trait::async_trait;
use tokio::{
    io::{AsyncBufReadExt as _, AsyncWriteExt as _, BufReader},
    net::UnixStream,
};

const ENV_SOCKET_PATH: &str = "BITWARDEN_ACCESS_SOCK";

struct Stub(fn(AgentRequest) -> Outcome);

#[async_trait]
impl Answerer for Stub {
    async fn answer(&self, request: AgentRequest) -> Outcome {
        (self.0)(request)
    }
}

/// The returned agent must be kept alive.
fn start_agent(
    name: &str,
    answer: fn(AgentRequest) -> Outcome,
) -> (BitwardenCredentialAgent, PathBuf) {
    let path =
        std::env::temp_dir().join(format!("bw-access-e2e-{name}-{}.sock", std::process::id()));
    // SAFETY: env-var mutation is serialized by #[serial].
    unsafe { std::env::set_var(ENV_SOCKET_PATH, &path) };
    let mut agent = BitwardenCredentialAgent::new(Arc::new(Router::new(Arc::new(Stub(answer)))));
    agent.start().expect("the agent should bind its socket");
    unsafe { std::env::remove_var(ENV_SOCKET_PATH) };

    (agent, path)
}

async fn round_trip(path: &PathBuf, request: &str) -> String {
    let mut stream = BufReader::new(UnixStream::connect(path).await.expect("connect"));
    stream
        .get_mut()
        .write_all(format!("{request}\n").as_bytes())
        .await
        .expect("write");

    let mut response = String::new();
    stream.read_line(&mut response).await.expect("read");
    response.trim().to_owned()
}

const GITHUB: &str = r#"{"v":1,"type":"credential-request","requestId":"r1","query":{"domain":"github.com"},"purpose":{"command":"gh pr create"}}"#;

fn granted(_: AgentRequest) -> Outcome {
    Outcome::Approved(Some(CredentialData {
        username: Some("me".into()),
        password: Some("hunter2".into()),
        credential_id: Some("cipher-id".into()),
        ..Default::default()
    }))
}

#[tokio::test]
#[serial_test::serial]
async fn test_serves_a_granted_credential() {
    let (_agent, path) = start_agent("granted", granted);

    let response = round_trip(&path, GITHUB).await;

    assert_eq!(
        response,
        r#"{"v":1,"type":"credential-response","requestId":"r1","status":"approved","credential":{"username":"me","password":"hunter2","credentialId":"cipher-id"}}"#
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_forwards_query_purpose_and_requester() {
    fn check(request: AgentRequest) -> Outcome {
        let RequestKind::Credential { query, purpose } = request.kind else {
            return Outcome::Error;
        };
        assert_eq!(query, CredentialQuery::Domain("github.com".into()));
        assert_eq!(
            purpose.and_then(|p| p.command).as_deref(),
            Some("gh pr create")
        );
        assert_eq!(request.requester.chain[0].pid, std::process::id());
        Outcome::NotFound
    }
    let (_agent, path) = start_agent("forwards", check);

    let response = round_trip(&path, GITHUB).await;

    assert_eq!(
        response,
        r#"{"v":1,"type":"credential-response","requestId":"r1","status":"notFound"}"#
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_answers_an_approval_request() {
    let (_agent, path) = start_agent("approval", |_| Outcome::Approved(None));

    let response = round_trip(
        &path,
        r#"{"v":1,"type":"approval-request","requestId":"a1","prompt":{"title":"Deploy?"}}"#,
    )
    .await;

    assert_eq!(
        response,
        r#"{"v":1,"type":"approval-response","requestId":"a1","status":"approved"}"#
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_approved_without_credential_is_an_error() {
    let (_agent, path) = start_agent("empty", |_| Outcome::Approved(None));

    let response = round_trip(&path, GITHUB).await;

    assert!(response.contains(r#""status":"error""#), "got: {response}");
}

#[tokio::test]
#[serial_test::serial]
async fn test_malformed_request_gets_a_fixed_error() {
    let (_agent, path) = start_agent("malformed", granted);

    let response = round_trip(&path, "not json").await;

    assert_eq!(
        response,
        r#"{"v":1,"type":"error","status":"error","error":"malformed request"}"#
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_stop_closes_the_socket_to_new_clients() {
    let (mut agent, path) = start_agent("stop", granted);

    agent.stop();
    assert!(!agent.is_running());

    // Connect, write or read fails, and in no case does a response come back.
    let Ok(stream) = UnixStream::connect(&path).await else {
        return;
    };
    let mut stream = BufReader::new(stream);
    let exchange = async {
        stream
            .get_mut()
            .write_all(format!("{GITHUB}\n").as_bytes())
            .await?;
        let mut response = String::new();
        let read = stream.read_line(&mut response).await?;
        Ok::<_, std::io::Error>((read, response))
    };

    match tokio::time::timeout(std::time::Duration::from_millis(500), exchange).await {
        Err(_) | Ok(Err(_)) => {}
        Ok(Ok((read, response))) => assert_eq!(read, 0, "a stopped agent answered: {response}"),
    }
}

#[tokio::test]
#[serial_test::serial]
async fn test_start_is_idempotent() {
    let (mut agent, _path) = start_agent("idempotent", granted);

    agent.start().expect("starting twice should be a no-op");

    assert!(agent.is_running());
}
