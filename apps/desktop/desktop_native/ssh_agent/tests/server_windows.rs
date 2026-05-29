#![cfg(windows)]

use serial_test::serial;
use tokio::{io::AsyncWriteExt, net::windows::named_pipe::ClientOptions};

mod common;
use common::{
    agent_with_keys, always_approving_agent, always_denying_agent, framed_request_identities,
    framed_sign_request, init_tracing, parse_first_key_name, parse_sign_response_algorithm,
    read_framed_response, test_ed25519_key, test_ed25519_key_blob, test_rsa_key, test_rsa_key_blob,
    unsupported_dsa_key_blob,
};

const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

fn setup() {
    init_tracing();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_start_creates_pipe() {
    setup();
    let mut agent = always_approving_agent();

    agent.start().unwrap();

    // The pipe is created synchronously before start() returns,
    // so no sleep is needed — the OS accepts the connection immediately.
    let result = ClientOptions::new().open(PIPE_NAME);
    assert!(
        result.is_ok(),
        "client connection to named pipe should succeed"
    );
    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_client_can_connect() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    let result = ClientOptions::new().open(PIPE_NAME);

    assert!(
        result.is_ok(),
        "client connection to named pipe should succeed"
    );
    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_stop_clears_running_state() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    agent.stop();

    assert!(!agent.is_running());
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_server_can_restart() {
    setup();
    let mut agent = always_approving_agent();

    agent.start().unwrap();
    agent.stop();
    agent.start().unwrap();

    assert!(agent.is_running());
    assert!(ClientOptions::new().open(PIPE_NAME).is_ok());
    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_stop_clears_keys() {
    setup();
    let mut agent = agent_with_keys(vec![test_ed25519_key()]);
    agent.start().unwrap();

    // Verify a key is visible before stop
    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;
    assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);

    // Stop clears keys; restart to re-open the pipe for a new connection
    agent.stop();
    agent.start().unwrap();

    // New connection sees an empty keystore
    let mut client2 = ClientOptions::new().open(PIPE_NAME).unwrap();
    client2
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response2 = read_framed_response(&mut client2).await;
    assert_eq!(
        u32::from_be_bytes(response2[1..5].try_into().unwrap()),
        0,
        "stop() must clear the keystore"
    );

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_list_keys_returns_empty_when_no_keys_set() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 12, "expected IDENTITIES_ANSWER type byte");
    assert_eq!(
        u32::from_be_bytes(response[1..5].try_into().unwrap()),
        0,
        "expected zero keys"
    );

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_list_keys_returns_keys_after_replace() {
    setup();
    let mut agent = agent_with_keys(vec![test_ed25519_key()]);
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 12, "expected IDENTITIES_ANSWER type byte");
    let count = u32::from_be_bytes(response[1..5].try_into().unwrap());
    assert_eq!(count, 1, "expected one key");
    assert_eq!(parse_first_key_name(&response), "Test Key");

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_list_keys_updates_after_replace() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    // Initially no keys
    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;
    assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 0);

    // Add a key
    agent.replace(vec![test_ed25519_key()]).unwrap();

    // New connection sees the key
    let mut client2 = ClientOptions::new().open(PIPE_NAME).unwrap();
    client2
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response2 = read_framed_response(&mut client2).await;
    assert_eq!(u32::from_be_bytes(response2[1..5].try_into().unwrap()), 1);
    assert_eq!(parse_first_key_name(&response2), "Test Key");

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_list_keys_multiple_connections_see_same_keys() {
    setup();
    let mut agent = agent_with_keys(vec![test_ed25519_key()]);
    agent.start().unwrap();

    for _ in 0..3 {
        let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
        client
            .write_all(&framed_request_identities())
            .await
            .unwrap();
        let response = read_framed_response(&mut client).await;
        assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);
    }

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_sign_request_returns_sign_response() {
    setup();
    let mut agent = agent_with_keys(vec![test_ed25519_key()]);
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_sign_request(
            &test_ed25519_key_blob(),
            b"test data",
            0,
        ))
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 14, "expected SIGN_RESPONSE type byte");

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_sign_request_denied_returns_failure() {
    setup();
    let mut agent = always_denying_agent();
    agent.replace(vec![test_ed25519_key()]).unwrap();
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_sign_request(
            &test_ed25519_key_blob(),
            b"test data",
            0,
        ))
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 5, "expected FAILURE type byte");

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_sign_request_unknown_key_returns_failure() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_sign_request(
            &test_ed25519_key_blob(),
            b"test data",
            0,
        ))
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 5, "expected FAILURE type byte");

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_sign_request_rsa_sha512_flag_produces_sha512_signature() {
    setup();
    let mut agent = agent_with_keys(vec![test_rsa_key()]);
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_sign_request(&test_rsa_key_blob(), b"test data", 4))
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 14, "expected SIGN_RESPONSE type byte");
    assert_eq!(
        parse_sign_response_algorithm(&response),
        "rsa-sha2-512",
        "expected SHA-512 algorithm when flags=4"
    );

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_sign_request_rsa_sha256_flag_produces_sha256_signature() {
    setup();
    let mut agent = agent_with_keys(vec![test_rsa_key()]);
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_sign_request(&test_rsa_key_blob(), b"test data", 2))
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 14, "expected SIGN_RESPONSE type byte");
    assert_eq!(
        parse_sign_response_algorithm(&response),
        "rsa-sha2-256",
        "expected SHA-256 algorithm when flags=2"
    );

    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_sign_request_unsupported_key_type_returns_failure() {
    setup();
    // Agent has valid keys loaded; the sign request references a DSA key, which is
    // unsupported and can never be stored, so the agent must return FAILURE.
    let mut agent = agent_with_keys(vec![test_ed25519_key()]);
    agent.start().unwrap();

    let mut client = ClientOptions::new().open(PIPE_NAME).unwrap();
    client
        .write_all(&framed_sign_request(
            &unsupported_dsa_key_blob(),
            b"test data",
            0,
        ))
        .await
        .unwrap();
    let response = read_framed_response(&mut client).await;

    assert_eq!(response[0], 5, "expected FAILURE for unsupported key type");

    agent.stop();
}
