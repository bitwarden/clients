//! Provides an orchestration between the underlying ssh agent server, the keystore
//! and the upstream approver of server requests.

use std::sync::Arc;

use anyhow::Result;
use tracing::{debug, info};

use crate::{
    approval::ApprovalRequester,
    authorization::{BitwardenAuthPolicy, LockState},
    server::SSHAgentServer,
    storage::keystore::KeyStore,
};

/// - contains the [`KeyStore`] of ssh keys
/// - manages the [`SSHAgentServer`]
/// - provides an Authentication policy for server requests
pub struct BitwardenSSHAgent<K, H>
where
    K: KeyStore,
    H: ApprovalRequester,
{
    /// store of ssh keys. shared with the authorization policy and server.
    keystore: Arc<K>,
    /// logic to authorize or deny underlying server requests
    auth_policy: Arc<BitwardenAuthPolicy<K, H>>,
    // the agent's server
    server: SSHAgentServer<K, BitwardenAuthPolicy<K, H>>,
}

impl<K, H> BitwardenSSHAgent<K, H>
where
    K: KeyStore + Send + Sync + 'static,
    H: ApprovalRequester + 'static,
{
    /// Creates a new [`BitwardenSSHAgent`]
    pub fn new(keystore: K, approval_handler: H) -> Self {
        let keystore = Arc::new(keystore);
        let auth_policy = Arc::new(BitwardenAuthPolicy::new(keystore.clone(), approval_handler));
        let server = SSHAgentServer::new(keystore.clone(), auth_policy.clone());

        Self {
            keystore,
            auth_policy,
            server,
        }
    }

    /// Starts the ssh agent server
    pub fn start_server(&mut self) -> Result<()> {
        debug!("Starting the server.");
        // TODO: PM-30756 Create platform-specific listeners and pass to start()
        // self.server.start(listeners)
        Ok(())
    }

    /// Stops the ssh agent server
    pub fn stop_server(&mut self) {
        debug!("Stopping the server.");
        self.server.stop()
    }

    /// # Returns
    ///
    /// `true` if the server is running, `false` if it is not.
    pub fn is_running(&self) -> bool {
        self.server.is_running()
    }

    /// Updates the keystore with the new keys and signals the auth policy to an unlocked state.
    pub fn set_keys(&self, _keys: Vec<K::KeyData>) -> Result<()> {
        debug!("Received new key data.");

        // TODO: set keys as part of PM-30755

        self.auth_policy.set_lock_state(LockState::Unlocked);

        debug!("New key data set.");

        Ok(())
    }

    /// Clears all keys from keystore
    pub fn clear_keys(&mut self) {
        debug!("Clearing all keys.");
        self.keystore.clear();
        info!("Cleared all keys.");
    }

    /// Sets the auth policy to a locked state
    pub fn lock(&self) {
        debug!("Locking.");
        self.auth_policy.set_lock_state(LockState::Locked);
        info!("Locked.");
    }

    /// Sets the auth policy to an unlocked state
    pub fn unlock(&self) {
        debug!("Unlocking.");
        self.auth_policy.set_lock_state(LockState::Unlocked);
        info!("Unlocked.");
    }
}
