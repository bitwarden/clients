use std::sync::Arc;

use russh_keys::key::KeyPair;
use futures::future::Future;
use async_trait::async_trait;
use tokio::{net::UnixListener, sync::Mutex};
use std::sync::RwLock;
use std::collections::HashMap;

use russh_keys::key;

use ssh_encoding::Encode;

pub mod ssh_agent;
pub mod msg;

const SOCKNAME: &str = "/Users/quexten/bitwarden-agent";
static KEYSTORE: std::sync::LazyLock<ssh_agent::KeyStore> = std::sync::LazyLock::new(|| ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))));

#[derive(Clone)]
struct SecureAgent {
    tx: tokio::sync::mpsc::Sender<()>,
    rx: Arc<Mutex<tokio::sync::mpsc::Receiver<bool>>>
}

#[async_trait]
impl ssh_agent::Agent for SecureAgent {
    fn confirm(self, _pk: Arc<KeyPair>) -> Box<dyn Future<Output = (Self, bool)> + Unpin + Send> {
        Box::new(futures::future::ready((self, true)))
    }

    async fn confirm_request(&self, _msg: ssh_agent::MessageType) -> bool {
        match _msg {
            ssh_agent::MessageType::RequestKeys => {
                return true
            }
            _ => {
                self.tx.send(()).await.unwrap();
                let res = self.rx.lock().await.recv().await.unwrap();
                println!("confirm_request rx recv {:?}", res);
                return res;
            }
        }
    }
}

pub async fn start_server(tx: tokio::sync::mpsc::Sender<()>, rx: Arc<Mutex<tokio::sync::mpsc::Receiver<bool>>>) {
    std::fs::remove_file(SOCKNAME).unwrap_or_default();
    match UnixListener::bind(SOCKNAME) {
        Ok(listener) => {
            let wrapper = tokio_stream::wrappers::UnixListenerStream::new(listener);
            ssh_agent::serve(
                wrapper,
                SecureAgent {
                    tx,
                    rx
                },
                KEYSTORE.clone()
            )
            .await
            .unwrap();
        }
        Err(e) => {
            eprintln!("Error while starting agent server: {}", e);
        }
    }
}

pub async fn set_keys(new_keys:  Vec<String>) {
    for key in new_keys.iter() {
        let private_key = ssh_key::private::PrivateKey::from_openssh(key).unwrap();
        let key_pair = key::KeyPair::try_from(&private_key).unwrap();

        let mut blob = Vec::new();
        private_key.public_key().key_data().encode(&mut blob).unwrap();

        let keys = &KEYSTORE;
        keys.0.write().unwrap().insert(blob, (Arc::new(key_pair), Vec::new()));
    }
}
