use std::sync::Arc;

use russh_keys::key::KeyPair;
use futures::future::Future;
use async_trait::async_trait;
use tokio::{net::UnixListener, sync::Mutex};
use std::sync::RwLock;
use std::collections::HashMap;
use homedir::my_home;

use russh_keys::key;

use ssh_encoding::Encode;

pub mod ssh_agent;
pub mod msg;

static KEYSTORE: std::sync::LazyLock<ssh_agent::KeyStore> = std::sync::LazyLock::new(|| ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))));

#[derive(Clone)]
struct SecureAgent {
    tx: tokio::sync::mpsc::Sender<String>,
    rx: Arc<Mutex<tokio::sync::mpsc::Receiver<bool>>>
}

#[async_trait]
impl ssh_agent::Agent for SecureAgent {
    async fn confirm(&self, _pk: Arc<(KeyPair, String, String)>) -> bool {
        let keyPair = _pk.0.clone();
        let name = _pk.1.clone();
        let uuid = _pk.2.clone();
        println!("Sign request for keypair {:?} with name {:?} and uuid {:?}", keyPair, name, uuid);

        self.tx.send(uuid.clone()).await.unwrap();
        let res = self.rx.lock().await.recv().await.unwrap();
        println!("confirm rx recv {:?}", res);
        res
    }

    async fn confirm_request(&self, _msg: ssh_agent::MessageType) -> bool {
        true
    }
}

pub async fn start_server(tx: tokio::sync::mpsc::Sender<String>, rx: Arc<Mutex<tokio::sync::mpsc::Receiver<bool>>>) {
    // todo cleanup
    let sockname = my_home().unwrap().unwrap();
    let sockname = sockname.to_str().unwrap();
    let sockname = sockname.to_owned() + "/.bitwarden-ssh-agent.sock";
    let sockname = std::path::Path::new(&sockname);

    std::fs::remove_file(sockname).unwrap_or_default();
    match UnixListener::bind(sockname) {
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
            println!("SSH Agent server started on {:?}", sockname);
        }
        Err(e) => {
            eprintln!("Error while starting agent server: {}", e);
        }
    }
}

pub async fn set_keys(new_keys:  Vec<(String, String, String)>) {
    (&KEYSTORE).0.write().unwrap().clear();

    for (key, name, uuid) in new_keys.iter() {
        let private_key = ssh_key::private::PrivateKey::from_openssh(key).unwrap();
        let key_pair = key::KeyPair::try_from(&private_key).unwrap();

        let mut blob = Vec::new();
        private_key.public_key().key_data().encode(&mut blob).unwrap();

        let keys = &KEYSTORE;
        keys.0.write().unwrap().insert(blob, (Arc::new((key_pair, name.clone(), uuid.clone())), Vec::new()));
    }
}
