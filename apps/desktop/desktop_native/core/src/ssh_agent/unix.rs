use std::{
    collections::HashMap,
    sync::{Arc, RwLock},
};

use bitwarden_russh::ssh_agent;
use homedir::my_home;
use tokio::{net::UnixListener, sync::Mutex};
use tokio_util::sync::CancellationToken;

use super::BitwardenDesktopAgent;

impl BitwardenDesktopAgent {
    pub async fn start_server(
        auth_request_tx: tokio::sync::mpsc::Sender<(u32, String)>,
        auth_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Result<Self, anyhow::Error> {
        use std::path::PathBuf;

        let agent = BitwardenDesktopAgent {
            keystore: ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))),
            cancellation_token: CancellationToken::new(),
            show_ui_request_tx: auth_request_tx,
            get_ui_response_rx: auth_response_rx,
            request_id: Arc::new(tokio::sync::Mutex::new(0)),
        };
        let cloned_agent_state = agent.clone();
        tokio::spawn(async move {
            let ssh_path = match std::env::var("BITWARDEN_SSH_AUTH_SOCK") {
                Ok(path) => path,
                Err(_) => {
                    println!("[SSH Agent Native Module] BITWARDEN_SSH_AUTH_SOCK not set, using default path");

                    let ssh_agent_directory = match my_home() {
                        Ok(Some(home)) => home,
                        _ => PathBuf::from("/tmp/"),
                    };
                    ssh_agent_directory
                        .join(".bitwarden-ssh-agent.sock")
                        .to_str()
                        .expect("Path should be valid")
                        .to_owned()
                }
            };

            println!(
                "[SSH Agent Native Module] Starting SSH Agent server on {:?}",
                ssh_path
            );
            let sockname = std::path::Path::new(&ssh_path);
            let _ = std::fs::remove_file(sockname);
            match UnixListener::bind(sockname) {
                Ok(listener) => {
                    let wrapper = tokio_stream::wrappers::UnixListenerStream::new(listener);
                    let cloned_keystore = cloned_agent_state.keystore.clone();
                    let cloned_cancellation_token = cloned_agent_state.cancellation_token.clone();
                    let _ = ssh_agent::serve(
                        wrapper,
                        cloned_agent_state,
                        cloned_keystore,
                        cloned_cancellation_token,
                    )
                    .await;
                    println!("[SSH Agent Native Module] SSH Agent server exited");
                }
                Err(e) => {
                    eprintln!(
                        "[SSH Agent Native Module] Error while starting agent server: {}",
                        e
                    );
                }
            }
        });

        Ok(agent)
    }
}
