use std::sync::{
    atomic::{AtomicBool, AtomicU32},
    Arc,
};

use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use bitwarden_russh::ssh_agent::{self, Key};

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "unix.rs")]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
mod platform_ssh_agent;

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod peercred_unix_listener_stream;

pub mod importer;
pub mod peerinfo;
mod request_parser;

#[derive(Clone)]
pub struct BitwardenDesktopAgent {
    keystore: ssh_agent::KeyStore,
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

impl ssh_agent::Agent<peerinfo::models::PeerInfo> for BitwardenDesktopAgent {
    async fn confirm(&self, ssh_key: Key, data: &[u8], info: &peerinfo::models::PeerInfo) -> bool {
        if !self.is_running() {
            println!("[BitwardenDesktopAgent] Agent is not running, but tried to call confirm");
            return false;
        }

        let request_id = self.get_request_id().await;
        let request_data = match request_parser::parse_request(data) {
            Ok(data) => data,
            Err(e) => {
                println!("[SSH Agent] Error while parsing request: {}", e);
                return false;
            }
        };
        let namespace = match request_data {
            request_parser::SshAgentSignRequest::SshSigRequest(ref req) => {
                Some(req.namespace.clone())
            }
            _ => None,
        };

        println!(
            "[SSH Agent] Confirming request from application: {}, is_forwarding: {}, namespace: {}",
            info.process_name(),
            info.is_forwarding(),
            namespace.clone().unwrap_or_default(),
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

        let request_id = self.get_request_id().await;

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

    async fn set_is_forwarding(
        &self,
        is_forwarding: bool,
        connection_info: &peerinfo::models::PeerInfo,
    ) {
        // is_forwarding can only be added but never removed from a connection
        if is_forwarding {
            connection_info.set_forwarding(is_forwarding);
        }
    }
}

impl BitwardenDesktopAgent {
    pub fn stop(&self) {
        if !self.is_running() {
            println!("[BitwardenDesktopAgent] Tried to stop agent while it is not running");
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
                        Key {
                            private_key: Some(private_key),
                            name: name.clone(),
                            cipher_uuid: cipher_id.clone(),
                        },
                    );
                }
                Err(e) => {
                    eprintln!("[SSH Agent Native Module] Error while parsing key: {}", e);
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

    async fn get_request_id(&self) -> u32 {
        if !self.is_running() {
            println!("[BitwardenDesktopAgent] Agent is not running, but tried to get request id");
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
                "Failed to parse public key: {}",
                e
            ))),
        },
        Err(e) => Err(anyhow::Error::msg(format!("Failed to parse key: {}", e))),
    }
}
