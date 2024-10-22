use std::sync::Arc;

use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use bitwarden_russh::ssh_agent::{self, Key};

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "unix.rs")]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
mod platform_ssh_agent;

pub mod generator;
pub mod importer;

#[derive(Clone)]
pub struct BitwardenDesktopAgent {
    keystore: ssh_agent::KeyStore,
    cancellation_token: CancellationToken,
    show_ui_request_tx: tokio::sync::mpsc::Sender<(u32, String)>,
    get_ui_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    request_id: Arc<Mutex<u32>>,
}

impl BitwardenDesktopAgent {
    async fn get_request_id(&self) -> u32 {
        let mut request_id = self.request_id.lock().await;
        *request_id += 1;
        *request_id
    }
}

impl ssh_agent::Agent for BitwardenDesktopAgent {
    async fn confirm(&self, ssh_key: Key) -> bool {
        let request_id = self.get_request_id().await;

        let mut rx_channel = self.get_ui_response_rx.lock().await.resubscribe();
        self.show_ui_request_tx
            .send((request_id, ssh_key.cipher_uuid.clone()))
            .await
            .expect("Should send request to ui");
        while let Ok((id, response)) = rx_channel.recv().await {
            if id == request_id {
                return response;
            }
        }
        false
    }
}

impl BitwardenDesktopAgent {
    pub fn stop(&self) {
        self.cancellation_token.cancel();
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
        let keystore = &mut self.keystore;
        keystore.0.write().expect("RwLock is not poisoned").clear();

        for (key, name, cipher_id) in new_keys.iter() {
            match parse_key_safe(&key) {
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
