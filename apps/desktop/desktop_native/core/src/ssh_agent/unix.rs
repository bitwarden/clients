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
use tracing::{error, info};

use crate::ssh_agent::peercred_unix_listener_stream::PeercredUnixListenerStream;

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
                    info!("BITWARDEN_SSH_AUTH_SOCK not set, using default path");

                    let ssh_agent_directory = match my_home() {
                        Ok(Some(home)) => home,
                        _ => {
                            info!("Could not determine home directory");
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

            info!(socket = %ssh_path, "Starting SSH Agent server");
            let sockname = std::path::Path::new(&ssh_path);
            if let Err(e) = std::fs::remove_file(sockname) {
                error!(error = %e, socket = %ssh_path, "Could not remove existing socket file");
                if e.kind() != std::io::ErrorKind::NotFound {
                    return;
                }
            }

            match UnixListener::bind(sockname) {
                Ok(listener) => {
                    // Only the current user should be able to access the socket
                    if let Err(e) = fs::set_permissions(sockname, fs::Permissions::from_mode(0o600))
                    {
                        error!(error = %e, socket = ?sockname, "Could not set socket permissions");
                        return;
                    }

                    let stream = PeercredUnixListenerStream::new(listener);

                    let cloned_keystore = cloned_agent_state.keystore.clone();
                    let cloned_cancellation_token = cloned_agent_state.cancellation_token.clone();
                    cloned_agent_state
                        .is_running
                        .store(true, std::sync::atomic::Ordering::Relaxed);
                    let _ = ssh_agent::serve(
                        stream,
                        cloned_agent_state.clone(),
                        cloned_keystore,
                        cloned_cancellation_token,
                    )
                    .await;
                    cloned_agent_state
                        .is_running
                        .store(false, std::sync::atomic::Ordering::Relaxed);
                    info!("SSH Agent server exited");
                }
                Err(e) => {
                    error!(error = %e, socket = %ssh_path, "Unable to start start agent server");
                }
            }
        });

        Ok(agent)
    }
}
