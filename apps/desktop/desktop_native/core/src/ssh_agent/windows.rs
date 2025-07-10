use bitwarden_russh::ssh_agent;
pub mod named_pipe_listener_stream;

use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU32},
        Arc, RwLock,
    },
};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use super::{BitwardenDesktopAgent, BitwardenSshKey, SshAgentUIRequest};

impl BitwardenDesktopAgent<BitwardenSshKey> {
    pub async fn start_server(
        auth_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
        auth_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Result<Self, anyhow::Error> {
        let agent_state = BitwardenDesktopAgent {
            keystore: ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))),
            show_ui_request_tx: auth_request_tx,
            get_ui_response_rx: auth_response_rx,
            cancellation_token: CancellationToken::new(),
            request_id: Arc::new(AtomicU32::new(0)),
            needs_unlock: Arc::new(AtomicBool::new(true)),
            is_running: Arc::new(AtomicBool::new(true)),
        };
        let stream = named_pipe_listener_stream::NamedPipeServerStream::new(
            agent_state.cancellation_token.clone(),
            agent_state.is_running.clone(),
        );

        let cloned_agent_state = agent_state.clone();
        tokio::spawn(async move {
            cloned_agent_state
                .is_running
                .store(true, std::sync::atomic::Ordering::Relaxed);
            let _ = ssh_agent::serve(
                stream,
                cloned_agent_state.clone(),
                cloned_agent_state.keystore.clone(),
                cloned_agent_state.cancellation_token.clone(),
            )
            .await;
            cloned_agent_state
                .is_running
                .store(false, std::sync::atomic::Ordering::Relaxed);
        });
        Ok(agent_state)
    }
}
