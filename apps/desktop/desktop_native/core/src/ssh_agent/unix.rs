use std::{
    collections::HashMap,
    fs,
    os::unix::fs::PermissionsExt,
    sync::{
        atomic::{AtomicBool, AtomicU32},
        Arc, RwLock,
    },
};

use bitwarden_russh::ssh_agent;
use homedir::my_home;
use tokio::{net::UnixListener, sync::Mutex};
use tokio_util::sync::CancellationToken;

use crate::ssh_agent::{
    agent::protocol, peercred_unix_listener_stream::PeercredUnixListenerStream,
};

use super::{BitwardenDesktopAgent, BitwardenSshKey, SshAgentUIRequest};

impl BitwardenDesktopAgent<BitwardenSshKey> {
    pub fn start_server(
        auth_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
        auth_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Result<Self, anyhow::Error> {
        let agent = BitwardenDesktopAgent {
            keystore: ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))),
            cancellation_token: CancellationToken::new(),
            show_ui_request_tx: auth_request_tx,
            get_ui_response_rx: auth_response_rx,
            request_id: Arc::new(AtomicU32::new(0)),
            needs_unlock: Arc::new(AtomicBool::new(true)),
            is_running: Arc::new(AtomicBool::new(false)),
        };
        let cloned_agent_state = agent.clone();
        tokio::spawn(async move {
            let ssh_path = match std::env::var("BITWARDEN_SSH_AUTH_SOCK") {
                Ok(path) => path,
                Err(_) => {
                    println!("[SSH Agent Native Module] BITWARDEN_SSH_AUTH_SOCK not set, using default path");

                    let ssh_agent_directory = match my_home() {
                        Ok(Some(home)) => home,
                        _ => {
                            println!(
                                "[SSH Agent Native Module] Could not determine home directory"
                            );
                            return;
                        }
                    };

                    let is_flatpak = std::env::var("container") == Ok("flatpak".to_string());
                    if !is_flatpak {
                        ssh_agent_directory
                            .join(".bitwarden-ssh-agent.sock")
                            .to_str()
                            .expect("Path should be valid")
                            .to_owned()
                    } else {
                        ssh_agent_directory
                            .join(".var/app/com.bitwarden.desktop/data/.bitwarden-ssh-agent.sock")
                            .to_str()
                            .expect("Path should be valid")
                            .to_owned()
                    }
                }
            };

            println!("[SSH Agent Native Module] Starting SSH Agent server on {ssh_path:?}");
            let sockname = std::path::Path::new(&ssh_path);
            if let Err(e) = std::fs::remove_file(sockname) {
                println!("[SSH Agent Native Module] Could not remove existing socket file: {e}");
                if e.kind() != std::io::ErrorKind::NotFound {
                    return;
                }
            }

            match UnixListener::bind(sockname) {
                Ok(listener) => {
                    // Only the current user should be able to access the socket
                    if let Err(e) = fs::set_permissions(sockname, fs::Permissions::from_mode(0o600))
                    {
                        println!("[SSH Agent Native Module] Could not set socket permissions: {e}");
                        return;
                    }

                    let stream = PeercredUnixListenerStream::new(listener);

                    let cloned_keystore = cloned_agent_state.keystore.clone();
                    let cloned_cancellation_token = cloned_agent_state.cancellation_token.clone();
                    cloned_agent_state
                        .is_running
                        .store(true, std::sync::atomic::Ordering::Relaxed);
                    protocol::serve_listener(stream, cloned_cancellation_token, cloned_agent_state)
                        .await
                        .unwrap();
                    // let _ = ssh_agent::serve(
                    //     stream,
                    //     cloned_agent_state.clone(),
                    //     cloned_keystore,
                    //     cloned_cancellation_token,
                    // )
                    // .await;
                    // cloned_agent_state
                    //     .is_running
                    //     .store(false, std::sync::atomic::Ordering::Relaxed);
                    println!("[SSH Agent Native Module] SSH Agent server exited");
                }
                Err(e) => {
                    eprintln!("[SSH Agent Native Module] Error while starting agent server: {e}");
                }
            }
        });

        Ok(agent)
    }
}

#[cfg(test)]
mod tests {

    use super::*;
    use std::{sync::Arc, thread::sleep};
    use tokio::sync::{broadcast, mpsc, Mutex};

    /// Note: Run this test with --no-capture to see the results in real-time
    #[tokio::test]
    #[ignore]
    async fn manual_test_ssh_agent_unix() {
        let (auth_request_tx, mut auth_request_rx) = mpsc::channel::<SshAgentUIRequest>(8);
        let (auth_response_tx, auth_response_rx) = broadcast::channel::<(u32, bool)>(8);
        let auth_response_rx = Arc::new(Mutex::new(auth_response_rx));

        let _auth_handler = tokio::spawn(async move {
            while let Some(req) = auth_request_rx.recv().await {
                println!("[TEST] Received auth request: {:?}", req);
                let _ = auth_response_tx.send((0, true));
            }
        });

        let mut agent =
            BitwardenDesktopAgent::start_server(auth_request_tx, auth_response_rx.clone()).unwrap();

        tokio::time::sleep(std::time::Duration::from_secs(20)).await;
    }
}
