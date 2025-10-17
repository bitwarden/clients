#[cfg(target_os = "linux")]
use std::{fs, process::Command, sync::Arc};

#[cfg(target_os = "linux")]
use ssh_agent::{
    agent::{
        ui_requester::{UiRequestMessage, UiRequester},
        BitwardenDesktopAgent,
    },
    memory::UnlockedSshItem,
    protocol::types::{KeyPair, PrivateKey},
    transport::unix_listener_stream::UnixListenerStream,
};
#[cfg(target_os = "linux")]
use tokio::{
    sync::{broadcast, mpsc, Mutex},
    task,
};
#[cfg(target_os = "linux")]
use tracing::info;

#[cfg(target_os = "linux")]
#[tokio::test]
#[test_log::test]
async fn ssh_agent_auth() {
    let dir = homedir::my_home().unwrap().unwrap();
    let dir = dir.join(".cache");
    let dir = dir.join("ssh_agent_integration_test");
    let dir = dir.to_string_lossy().into_owned();

    fs::remove_dir_all(&dir).unwrap_or(());
    // Prepare test run directory
    fs::create_dir_all(&dir).unwrap();

    let config = format!(
        "Port 2222
HostKey {}/ssh_host_rsa_key
HostKey {}/ssh_host_ecdsa_key
HostKey {}/ssh_host_ed25519_key
AuthorizedKeysFile  {}/authorized_keys
",
        dir, dir, dir, dir
    );
    fs::write(format!("{}/sshd_config", dir), config).unwrap();

    let keys = make_keys(&dir);

    // Start ssh server
    let dir_clone = dir.clone();
    std::thread::spawn(move || {
        Command::new("/usr/bin/sshd")
            .args(["-f", &format!("{}/sshd_config", &dir_clone), "-D", "-e"])
            .status()
            .expect("failed to execute process");
    });
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    let ui_requester = mock_channels();
    let desktop_agent = BitwardenDesktopAgent::new(ui_requester);
    desktop_agent.set_keys(keys);

    let dir_clone = dir.clone();
    task::spawn(async move {
        info!(target: "ssh-agent", "Listening on {}", format!("{}/ssh-agent.sock", dir_clone));
        UnixListenerStream::listen(format!("{}/ssh-agent.sock", dir_clone), desktop_agent)
            .await
            .unwrap();
    });

    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Test listing keys
    let dir_clone = dir.clone();
    let jh1 = std::thread::spawn(move || {
        Command::new("ssh-add")
            .env("SSH_AUTH_SOCK", format!("{}/ssh-agent.sock", dir_clone))
            .args(["-L"])
            .status()
            .expect("failed to execute process");
    });
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    jh1.join().unwrap();

    // Test ssh connection
    let dir_clone = dir.clone();
    let jh1 = std::thread::spawn(move || {
        Command::new("ssh")
            .env("SSH_AUTH_SOCK", format!("{}/ssh-agent.sock", dir_clone))
            .args([
                "-o",
                "StrictHostKeyChecking=no",
                "-o",
                "UserKnownHostsFile=/dev/null",
                "-p",
                "2222",
                "localhost",
                "echo",
                "Success",
            ])
            .status()
            .expect("failed to execute process");
    });
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    jh1.join().unwrap();
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

    // Cleanup
    fs::remove_dir_all(dir).unwrap();
    std::process::exit(0);
}

#[cfg(target_os = "linux")]
fn make_keys(dir: &str) -> Vec<UnlockedSshItem> {
    Command::new("ssh-keygen")
        .args([
            "-f",
            &format!("{}/ssh_host_rsa_key", dir),
            "-N",
            "",
            "-t",
            "rsa",
        ])
        .status()
        .expect("failed to execute process");
    Command::new("ssh-keygen")
        .args([
            "-f",
            &format!("{}/ssh_host_ecdsa_key", dir),
            "-N",
            "",
            "-t",
            "ecdsa",
        ])
        .status()
        .expect("failed to execute process");
    Command::new("ssh-keygen")
        .args([
            "-f",
            &format!("{}/ssh_host_ed25519_key", dir),
            "-N",
            "",
            "-t",
            "ed25519",
        ])
        .status()
        .expect("failed to execute process");
    // // Make user key
    Command::new("ssh-keygen")
        .args([
            "-f",
            &format!("{}/id_ed25519", dir),
            "-N",
            "",
            "-t",
            "ed25519",
        ])
        .status()
        .expect("failed to execute process");
    Command::new("ssh-keygen")
        .args(["-f", &format!("{}/ssh_rsa", dir), "-N", "", "-t", "rsa"])
        .status()
        .expect("failed to execute process");
    let pubkey1 =
        fs::read_to_string(format!("{}/id_ed25519.pub", dir)).expect("failed to read public key");
    let pubkey2 =
        fs::read_to_string(format!("{}/ssh_rsa.pub", dir)).expect("failed to read public key");
    fs::write(
        format!("{}/authorized_keys", dir),
        format!("{}{}", pubkey1, pubkey2),
    )
    .expect("failed to write authorized_keys");
    let privkey1 = fs::read_to_string(format!("{}/id_ed25519", dir)).expect("key is valid");
    let key1 = KeyPair::new(
        PrivateKey::try_from(privkey1).expect("key is valid"),
        "ed25519-key".to_string(),
    );
    let privkey2 = fs::read_to_string(format!("{}/ssh_rsa", dir)).expect("key is valid");
    let key2 = KeyPair::new(
        PrivateKey::try_from(privkey2).expect("key is valid"),
        "rsa-key".to_string(),
    );
    let unlocked_items = vec![
        UnlockedSshItem::new(key1, "cipher1".to_string()),
        UnlockedSshItem::new(key2, "cipher2".to_string()),
    ];
    unlocked_items
}

#[cfg(target_os = "linux")]
fn mock_channels() -> UiRequester {
    let (show_ui_request_tx, mut show_ui_request_rx) = mpsc::channel::<UiRequestMessage>(10);

    // Create mock broadcast channel for responses
    let (response_tx, response_rx) = broadcast::channel::<(u32, bool)>(10);
    let get_ui_response_rx = Arc::new(Mutex::new(response_rx));

    // Spawn a task to automatically send back "true" responses
    let response_tx_clone = response_tx.clone();
    let _handle = task::spawn(async move {
        while let Some(req) = show_ui_request_rx.recv().await {
            info!("Mock UI requester received request: {:?}", req);
            let _ = response_tx_clone.send((req.id(), true));
        }
        info!("Mock UI requester task ending");
    });

    UiRequester::new(show_ui_request_tx, get_ui_response_rx)
}
