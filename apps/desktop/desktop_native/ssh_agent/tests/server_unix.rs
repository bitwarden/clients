#![cfg(unix)]

use std::{os::unix::fs::PermissionsExt, path::PathBuf};

use serial_test::serial;
use tokio::{io::AsyncWriteExt, net::UnixStream};

mod common;
use common::{
    agent_with_keys, always_approving_agent, framed_request_identities, init_tracing,
    parse_first_key_name, read_framed_response, test_ed25519_key,
};

fn test_socket_path() -> PathBuf {
    std::env::temp_dir().join("bw-ssh-agent-test.sock")
}

fn set_socket_path() {
    // SAFETY: tests are serialized with #[serial]
    unsafe {
        std::env::set_var("BITWARDEN_SSH_AUTH_SOCK", test_socket_path());
    }
}

fn setup() {
    init_tracing();
    set_socket_path();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_start_creates_socket() {
    setup();
    let mut agent = always_approving_agent();

    agent.start().unwrap();

    assert!(std::fs::exists(test_socket_path()).unwrap());
    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_client_can_connect() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    // The socket is bound synchronously before start_server() returns,
    // so no sleep is needed — the OS queues the connection until accepted.
    let result = UnixStream::connect(test_socket_path()).await;

    assert!(
        result.is_ok(),
        "client connection to unix socket should succeed"
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
async fn test_socket_has_user_only_permissions() {
    setup();
    let mut agent = always_approving_agent();
    agent.start().unwrap();

    let permissions = std::fs::metadata(test_socket_path())
        .unwrap()
        .permissions()
        .mode();
    // Socket files have type bits 0o140000; combined with 0o600 permissions (which we set
    // explicitly) yields 0o140600
    assert_eq!(permissions, 0o140_600);

    agent.stop();
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
    assert!(std::fs::exists(test_socket_path()).unwrap());
    agent.stop();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_stop_clears_keys() {
    setup();
    let mut agent = agent_with_keys(vec![test_ed25519_key()]);
    agent.start().unwrap();

    // Verify a key is visible before stop
    let mut stream = UnixStream::connect(test_socket_path()).await.unwrap();
    stream
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut stream).await;
    assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);

    // Stop clears keys; restart to re-open the socket for a new connection
    agent.stop();
    agent.start().unwrap();

    // New connection sees an empty keystore
    let mut stream2 = UnixStream::connect(test_socket_path()).await.unwrap();
    stream2
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response2 = read_framed_response(&mut stream2).await;
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

    let mut stream = UnixStream::connect(test_socket_path()).await.unwrap();
    stream
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut stream).await;

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

    let mut stream = UnixStream::connect(test_socket_path()).await.unwrap();
    stream
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut stream).await;

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
    let mut stream = UnixStream::connect(test_socket_path()).await.unwrap();
    stream
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response = read_framed_response(&mut stream).await;
    assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 0);

    // Add a key
    agent.replace(vec![test_ed25519_key()]).unwrap();

    // New connection sees the key
    let mut stream2 = UnixStream::connect(test_socket_path()).await.unwrap();
    stream2
        .write_all(&framed_request_identities())
        .await
        .unwrap();
    let response2 = read_framed_response(&mut stream2).await;
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
        let mut stream = UnixStream::connect(test_socket_path()).await.unwrap();
        stream
            .write_all(&framed_request_identities())
            .await
            .unwrap();
        let response = read_framed_response(&mut stream).await;
        assert_eq!(u32::from_be_bytes(response[1..5].try_into().unwrap()), 1);
    }

    agent.stop();
}
