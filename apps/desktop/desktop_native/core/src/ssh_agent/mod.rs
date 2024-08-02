use std::sync::Arc;

use russh_keys::key::KeyPair;
use ssh_key::private::KeypairData;
use tokio::{net::UnixListener, sync::Mutex};
use std::sync::RwLock;
use std::collections::HashMap;
use homedir::my_home;

use russh_keys::{key, PublicKeyBase64};

use ssh_encoding::Encode;

pub mod ssh_agent;
pub mod msg;

static KEYSTORE: std::sync::LazyLock<ssh_agent::KeyStore> = std::sync::LazyLock::new(|| ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))));

#[derive(Clone)]
struct SecureAgent {
    tx: tokio::sync::mpsc::Sender<String>,
    rx: Arc<Mutex<tokio::sync::mpsc::Receiver<bool>>>
}

impl ssh_agent::Agent for SecureAgent {
    async fn confirm(&self, _pk: Arc<(KeyPair, String, String)>) -> bool {
        let key_pair = _pk.0.clone();
        let name = _pk.1.clone();
        let uuid = _pk.2.clone();
        println!("Sign request for keypair {:?} with name {:?} and uuid {:?}", key_pair, name, uuid);

        self.tx.send(uuid.clone()).await.unwrap();
        let res = self.rx.lock().await.recv().await.unwrap();
        println!("confirm rx recv {:?}", res);
        res
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
        println!("Adding key {:?}", key);
        let key_pair = russh_keys::decode_secret_key(&key, None).unwrap();
        let pubkey = key_pair.clone_public_key().unwrap();
        let keys = &KEYSTORE;
        keys.0.write().unwrap().insert(pubkey.public_key_bytes(), (Arc::new((key_pair, name.clone(), uuid.clone())), Vec::new()));
    }
}
