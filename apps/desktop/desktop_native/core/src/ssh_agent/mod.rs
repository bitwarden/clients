use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU32},
        Arc, RwLock,
    },
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use bitwarden_russh::{
    session_bind::SessionBindResult,
    ssh_agent::{self, SshKey},
};
use tracing::{error, info};

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "unix.rs")]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
mod platform_ssh_agent;

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod peercred_unix_listener_stream;

pub mod peerinfo;
mod request_parser;

#[derive(Clone)]
pub struct BitwardenDesktopAgent {
    keystore: ssh_agent::KeyStore<BitwardenSshKey>,
    cancellation_token: CancellationToken,
    show_ui_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
    get_ui_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    request_id: Arc<AtomicU32>,
    /// before first unlock, or after account switching, listing keys should require an unlock to get a list of public keys
    needs_unlock: Arc<AtomicBool>,
    is_running: Arc<AtomicBool>,
}

pub struct SshAgentUIRequest {
    pub request_id: u32,
    pub cipher_id: Option<String>,
    pub process_name: String,
    pub is_list: bool,
    pub namespace: Option<String>,
    pub is_forwarding: bool,
}

#[derive(Clone)]
pub struct BitwardenSshKey {
    pub private_key: Option<ssh_key::private::PrivateKey>,
    pub name: String,
    pub cipher_uuid: String,
}

impl SshKey for BitwardenSshKey {
    fn name(&self) -> &str {
        &self.name
    }

    fn public_key_bytes(&self) -> Vec<u8> {
        if let Some(ref private_key) = self.private_key {
            private_key
                .public_key()
                .to_bytes()
                .expect("Cipher private key is always correctly parsed")
        } else {
            Vec::new()
        }
    }

    fn private_key(&self) -> Option<Box<dyn ssh_key::SigningKey>> {
        if let Some(ref private_key) = self.private_key {
            Some(Box::new(private_key.clone()))
        } else {
            None
        }
    }
}

impl ssh_agent::Agent<peerinfo::models::PeerInfo, BitwardenSshKey> for BitwardenDesktopAgent {
    async fn confirm(
        &self,
        ssh_key: BitwardenSshKey,
        data: &[u8],
        info: &peerinfo::models::PeerInfo,
    ) -> bool {
        if !self.is_running() {
            error!("Agent is not running, but tried to call confirm");
            return false;
        }

        let request_id = self.get_request_id();
        let request_data = match request_parser::parse_request(data) {
            Ok(data) => data,
            Err(e) => {
                error!(error = %e, "Error while parsing request");
                return false;
            }
        };
        let namespace = match request_data {
            request_parser::SshAgentSignRequest::SshSigRequest(ref req) => {
                Some(req.namespace.clone())
            }
            _ => None,
        };

        info!(
            is_forwarding = %info.is_forwarding(),
            namespace = ?namespace.as_ref(),
            host_key = %STANDARD.encode(info.host_key()),
            "Confirming request from application: {}",
            info.process_name(),
        );

        let mut rx_channel = self.get_ui_response_rx.lock().await.resubscribe();
        self.show_ui_request_tx
            .send(SshAgentUIRequest {
                request_id,
                cipher_id: Some(ssh_key.cipher_uuid.clone()),
                process_name: info.process_name().to_string(),
                is_list: false,
                namespace,
                is_forwarding: info.is_forwarding(),
            })
            .await
            .expect("Should send request to ui");
        while let Ok((id, response)) = rx_channel.recv().await {
            if id == request_id {
                return response;
            }
        }
        false
    }

    async fn can_list(&self, info: &peerinfo::models::PeerInfo) -> bool {
        if !self.needs_unlock.load(std::sync::atomic::Ordering::Relaxed) {
            return true;
        }

        let request_id = self.get_request_id();

        let mut rx_channel = self.get_ui_response_rx.lock().await.resubscribe();
        let message = SshAgentUIRequest {
            request_id,
            cipher_id: None,
            process_name: info.process_name().to_string(),
            is_list: true,
            namespace: None,
            is_forwarding: info.is_forwarding(),
        };
        self.show_ui_request_tx
            .send(message)
            .await
            .expect("Should send request to ui");
        while let Ok((id, response)) = rx_channel.recv().await {
            if id == request_id {
                return response;
            }
        }
        false
    }

    async fn set_sessionbind_info(
        &self,
        session_bind_info_result: &SessionBindResult,
        connection_info: &peerinfo::models::PeerInfo,
    ) {
        match session_bind_info_result {
            SessionBindResult::Success(session_bind_info) => {
                connection_info.set_forwarding(session_bind_info.is_forwarding);
                connection_info.set_host_key(session_bind_info.host_key.clone());
            }
            SessionBindResult::SignatureFailure => {
                error!("Session bind failure: Signature failure");
            }
        }
    }
}

impl BitwardenDesktopAgent {
    /// Create a new `BitwardenDesktopAgent` from the provided auth channel handles.
    pub fn new(
        auth_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
        auth_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Self {
        Self {
            keystore: ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))),
            cancellation_token: CancellationToken::new(),
            show_ui_request_tx: auth_request_tx,
            get_ui_response_rx: auth_response_rx,
            request_id: Arc::new(AtomicU32::new(0)),
            needs_unlock: Arc::new(AtomicBool::new(true)),
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn stop(&self) {
        if !self.is_running() {
            error!("Tried to stop agent while it is not running");
            return;
        }

        self.is_running
            .store(false, std::sync::atomic::Ordering::Relaxed);
        self.keystore
            .0
            .write()
            .expect("RwLock is not poisoned")
            .clear();
    }

    pub fn set_keys(
        &mut self,
        new_keys: Vec<(String, String, String)>,
    ) -> Result<(), anyhow::Error> {
        if !self.is_running() {
            return Err(anyhow::anyhow!(
                "[BitwardenDesktopAgent] Tried to set keys while agent is not running"
            ));
        }

        let keystore = &mut self.keystore;
        keystore.0.write().expect("RwLock is not poisoned").clear();

        self.needs_unlock
            .store(true, std::sync::atomic::Ordering::Relaxed);

        for (key, name, cipher_id) in new_keys.iter() {
            match parse_key_safe(key) {
                Ok(private_key) => {
                    let public_key_bytes = private_key
                        .public_key()
                        .to_bytes()
                        .expect("Cipher private key is always correctly parsed");
                    keystore.0.write().expect("RwLock is not poisoned").insert(
                        public_key_bytes,
                        BitwardenSshKey {
                            private_key: Some(private_key),
                            name: name.clone(),
                            cipher_uuid: cipher_id.clone(),
                        },
                    );
                }
                Err(e) => {
                    error!(error=%e, "Error while parsing key");
                }
            }
        }

        Ok(())
    }

    pub fn lock(&mut self) -> Result<(), anyhow::Error> {
        if !self.is_running() {
            return Err(anyhow::anyhow!(
                "[BitwardenDesktopAgent] Tried to lock agent, but it is not running"
            ));
        }

        let keystore = &mut self.keystore;
        keystore
            .0
            .write()
            .expect("RwLock is not poisoned")
            .iter_mut()
            .for_each(|(_public_key, key)| {
                key.private_key = None;
            });
        Ok(())
    }

    pub fn clear_keys(&mut self) -> Result<(), anyhow::Error> {
        let keystore = &mut self.keystore;
        keystore.0.write().expect("RwLock is not poisoned").clear();
        self.needs_unlock
            .store(true, std::sync::atomic::Ordering::Relaxed);

        Ok(())
    }

    fn get_request_id(&self) -> u32 {
        if !self.is_running() {
            error!("Agent is not running, but tried to get request id");
            return 0;
        }

        self.request_id
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(std::sync::atomic::Ordering::Relaxed)
    }
}

fn parse_key_safe(pem: &str) -> Result<ssh_key::private::PrivateKey, anyhow::Error> {
    match ssh_key::private::PrivateKey::from_openssh(pem) {
        Ok(key) => match key.public_key().to_bytes() {
            Ok(_) => Ok(key),
            Err(e) => Err(anyhow::Error::msg(format!(
                "Failed to parse public key: {e}"
            ))),
        },
        Err(e) => Err(anyhow::Error::msg(format!("Failed to parse key: {e}"))),
    }
}
