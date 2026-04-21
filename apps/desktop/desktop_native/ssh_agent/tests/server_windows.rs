#![cfg(windows)]

use serial_test::serial;
use tokio::net::windows::named_pipe::ClientOptions;

mod common;
use common::{always_approving_agent, init_tracing};

const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

fn setup() {
    init_tracing();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_start_creates_pipe() {
    setup();
    let mut agent = always_approving_agent();

    agent.start_server().unwrap();

    // The pipe is created synchronously before start_server() returns,
    // so no sleep is needed — the OS accepts the connection immediately.
    let result = ClientOptions::new().open(PIPE_NAME);
    assert!(
        result.is_ok(),
        "client connection to named pipe should succeed"
    );
    agent.stop_server();
}

#[serial]
#[tokio::test(flavor = "multi_thread")]
async fn test_client_can_connect() {
    setup();
    let mut agent = always_approving_agent();
    agent.start_server().unwrap();

    let result = ClientOptions::new().open(PIPE_NAME);

    assert!(
        result.is_ok(),
        "client connection to named pipe should succeed"
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
async fn test_server_can_restart() {
    setup();
    let mut agent = always_approving_agent();

    agent.start_server().unwrap();
    agent.stop_server();
    agent.start_server().unwrap();

    assert!(agent.is_running());
    assert!(ClientOptions::new().open(PIPE_NAME).is_ok());
    agent.stop_server();
}
