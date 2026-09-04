//! End-to-end coverage over a real Unix socket: agent start, request, response, stop.

#![cfg(unix)]

use std::path::PathBuf;

use async_trait::async_trait;
use credential_agent::{
    BitwardenCredentialAgent, Credential, CredentialOutcome, CredentialProvider, CredentialRequest,
    ProviderError,
};
use tokio::{
    io::{AsyncBufReadExt as _, AsyncWriteExt as _, BufReader},
    net::UnixStream,
};

const ENV_BITWARDEN_CREDENTIAL_SOCK: &str = "BITWARDEN_CREDENTIAL_SOCK";

/// Records what the agent forwarded, and answers with a fixed outcome.
struct StubProvider {
    outcome: fn(CredentialRequest) -> Result<CredentialOutcome, ProviderError>,
}

#[async_trait]
impl CredentialProvider for StubProvider {
    async fn request_credential(
        &self,
        request: CredentialRequest,
    ) -> Result<CredentialOutcome, ProviderError> {
        (self.outcome)(request)
    }
}

fn temp_socket_path(name: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "bw-credential-agent-{name}-{}.sock",
        std::process::id()
    ))
}

/// Starts an agent on a private socket path. The returned agent must be kept alive.
fn start_agent(
    name: &str,
    outcome: fn(CredentialRequest) -> Result<CredentialOutcome, ProviderError>,
) -> (BitwardenCredentialAgent<StubProvider>, PathBuf) {
    let path = temp_socket_path(name);
    // SAFETY: env-var mutation is serialized by #[serial].
    unsafe { std::env::set_var(ENV_BITWARDEN_CREDENTIAL_SOCK, &path) };

    let mut agent = BitwardenCredentialAgent::new(StubProvider { outcome });
    agent.start().expect("the agent should bind its socket");

    unsafe { std::env::remove_var(ENV_BITWARDEN_CREDENTIAL_SOCK) };

    (agent, path)
}

async fn round_trip(path: &PathBuf, request: &str) -> String {
    let stream = UnixStream::connect(path)
        .await
        .expect("the agent should accept a connection");
    let mut stream = BufReader::new(stream);

    stream
        .get_mut()
        .write_all(format!("{request}\n").as_bytes())
        .await
        .expect("the request should be written");

    let mut response = String::new();
    stream
        .read_line(&mut response)
        .await
        .expect("the agent should answer");

    response
}

fn granted(_request: CredentialRequest) -> Result<CredentialOutcome, ProviderError> {
    Ok(CredentialOutcome::Granted(Box::new(Credential {
        cipher_id: "cipher-id".to_string(),
        name: "GitHub".to_string(),
        username: Some("me".to_string()),
        password: Some("hunter2".to_string()),
        totp: None,
    })))
}

#[tokio::test]
#[serial_test::serial]
async fn test_serves_a_granted_credential_over_the_socket() {
    let (_agent, path) = start_agent("granted", granted);

    let response = round_trip(
        &path,
        r#"{"version":1,"action":"getCredential","uri":"https://github.com"}"#,
    )
    .await;

    assert!(response.contains(r#""status":"ok""#), "got: {response}");
    assert!(response.contains("hunter2"), "got: {response}");
}

#[tokio::test]
#[serial_test::serial]
async fn test_forwards_the_query_and_peer_to_the_provider() {
    fn assert_request(request: CredentialRequest) -> Result<CredentialOutcome, ProviderError> {
        assert_eq!(request.query.name.as_deref(), Some("GitHub"));
        assert_eq!(request.peer.pid, Some(std::process::id()));
        Ok(CredentialOutcome::NotFound)
    }

    let (_agent, path) = start_agent("forwards", assert_request);

    let response = round_trip(
        &path,
        r#"{"version":1,"action":"getCredential","name":"GitHub"}"#,
    )
    .await;

    assert!(
        response.contains(r#""status":"notFound""#),
        "got: {response}"
    );
}

#[tokio::test]
#[serial_test::serial]
async fn test_denied_request_returns_no_credential() {
    let (_agent, path) = start_agent("denied", |_| Ok(CredentialOutcome::Denied));

    let response = round_trip(
        &path,
        r#"{"version":1,"action":"getCredential","name":"GitHub"}"#,
    )
    .await;

    assert_eq!(response.trim(), r#"{"status":"denied"}"#);
}

#[tokio::test]
#[serial_test::serial]
async fn test_stop_closes_the_socket_to_new_clients() {
    let (mut agent, path) = start_agent("stop", granted);

    agent.stop();
    assert!(!agent.is_running());

    // The listener task is cancelled, so a fresh client is never served: the connect,
    // the write, or the read fails, and in no case does a response come back.
    let Ok(stream) = UnixStream::connect(&path).await else {
        return;
    };
    let mut stream = BufReader::new(stream);

    let exchange = async {
        stream
            .get_mut()
            .write_all(b"{\"version\":1,\"action\":\"getCredential\",\"name\":\"GitHub\"}\n")
            .await?;

        let mut response = String::new();
        let read = stream.read_line(&mut response).await?;

        Ok::<_, std::io::Error>((read, response))
    };

    let outcome = tokio::time::timeout(std::time::Duration::from_millis(500), exchange).await;

    match outcome {
        // Timed out, or the socket errored: either way, nothing was served.
        Err(_) | Ok(Err(_)) => {}
        Ok(Ok((read, response))) => {
            assert_eq!(read, 0, "a stopped agent must not answer, got: {response}")
        }
    }
}

#[tokio::test]
#[serial_test::serial]
async fn test_start_is_idempotent() {
    let (mut agent, _path) = start_agent("idempotent", granted);

    agent.start().expect("starting twice should be a no-op");

    assert!(agent.is_running());
}
