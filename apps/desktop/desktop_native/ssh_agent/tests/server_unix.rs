#![cfg(unix)]

use std::{os::unix::fs::PermissionsExt, path::PathBuf};

use serial_test::serial;
use tokio::net::UnixStream;

mod common;
use common::{always_approving_agent, init_tracing};

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

    agent.start_server().unwrap();

    assert!(std::fs::exists(test_socket_path()).unwrap());
    agent.stop_server();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_client_can_connect() {
    setup();
    let mut agent = always_approving_agent();
    agent.start_server().unwrap();

    // The socket is bound synchronously before start_server() returns,
    // so no sleep is needed — the OS queues the connection until accepted.
    let result = UnixStream::connect(test_socket_path()).await;

    assert!(
        result.is_ok(),
        "client connection to unix socket should succeed"
    );
    agent.stop_server();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_stop_clears_running_state() {
    setup();
    let mut agent = always_approving_agent();
    agent.start_server().unwrap();

    agent.stop_server();

    assert!(!agent.is_running());
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_socket_has_user_only_permissions() {
    setup();
    let mut agent = always_approving_agent();
    agent.start_server().unwrap();

    let permissions = std::fs::metadata(test_socket_path())
        .unwrap()
        .permissions()
        .mode();
    // Socket files have type bits 0o140000; combined with 0o600 permissions (which we set
    // explicitly) yields 0o140600
    assert_eq!(permissions, 0o140_600);

    agent.stop_server();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_server_can_restart() {
    setup();
    let mut agent = always_approving_agent();

    agent.start_server().unwrap();
    agent.stop_server();
    agent.start_server().unwrap();

    assert!(agent.is_running());
    assert!(std::fs::exists(test_socket_path()).unwrap());
    agent.stop_server();
}
