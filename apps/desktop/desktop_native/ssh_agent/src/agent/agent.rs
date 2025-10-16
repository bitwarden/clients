use std::sync::{Arc, Mutex};

use futures::Stream;
use tokio_util::sync::CancellationToken;

use crate::{
    agent::ui_requester::{UiRequester},
    memory::UnlockedSshItem,
    protocol::{
        self,
        key_store::Agent,
        protocol::serve_listener,
        types::PublicKeyWithName,
    },
    transport::peer_info::PeerInfo,
};

#[derive(Clone)]
pub struct BitwardenDesktopAgent {
    cancellation_token: CancellationToken,
    key_store: Arc<Mutex<crate::memory::KeyStore>>,
    ui_requester: UiRequester,
}

impl BitwardenDesktopAgent {
    pub fn new(ui_requester: UiRequester) -> Self {
        Self {
            cancellation_token: CancellationToken::new(),
            key_store: Arc::new(Mutex::new(crate::memory::KeyStore::new())),
            ui_requester,
        }
    }

    pub async fn serve<S, L>(&self, listener: L)
    where
        S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Send + Sync + Unpin + 'static,
        L: Stream<Item = tokio::io::Result<(S, PeerInfo)>> + Unpin,
    {
        serve_listener(listener, self.cancellation_token.clone(), self)
            .await
            .unwrap();
    }

    pub fn stop(&self) {
        self.cancellation_token.cancel();
    }

    pub fn set_keys(&self, keys: Vec<UnlockedSshItem>) {
        self.key_store
            .lock()
            .expect("Failed to lock key store")
            .set_unlocked(keys);
    }

    pub fn lock(&self) {
        self.key_store
            .lock()
            .expect("Failed to lock key store")
            .lock();
    }

    pub fn is_running(&self) -> bool {
        !self.cancellation_token.is_cancelled()
    }
}

impl Agent for &BitwardenDesktopAgent {
    async fn list_keys(&self) -> Result<Vec<PublicKeyWithName>, anyhow::Error> {
        Ok(self
            .key_store
            .lock()
            .expect("Failed to lock key store")
            .list_keys())
    }

    async fn find_ssh_item(
        &self,
        public_key: &protocol::types::PublicKey,
    ) -> Result<Option<UnlockedSshItem>, anyhow::Error> {
        Ok(self
            .key_store
            .lock()
            .expect("Failed to lock key store")
            .get_unlocked_keypair(public_key))
    }

    async fn request_can_list(
        &self,
        connection_info: &protocol::connection::ConnectionInfo,
    ) -> Result<bool, anyhow::Error> {
        Ok(self.ui_requester.request_list(connection_info).await)
    }

    async fn request_can_sign(
        &self,
        public_key: &protocol::types::PublicKey,
        connection_info: &protocol::connection::ConnectionInfo,
    ) -> Result<bool, anyhow::Error> {
        let id = self
            .key_store
            .lock()
            .expect("Failed to lock key store")
            .get_cipher_id(public_key);
        if let Some(cipher_id) = id {
            return Ok(self
                .ui_requester
                .request_sign(connection_info, cipher_id, "unknown".to_string())
                .await);
        } else {
            Ok(false)
        }
    }
}
