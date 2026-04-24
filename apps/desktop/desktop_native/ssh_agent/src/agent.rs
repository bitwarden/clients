//! Provides an orchestration between the underlying ssh agent server, the keystore
//! and the upstream approver of server requests.

use std::sync::Arc;

use anyhow::Result;
use tracing::{debug, info};

use crate::{
    approval::ApprovalRequester, authorization::BitwardenAuthPolicy, server::SSHAgentServer,
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
        let server = SSHAgentServer::new(keystore.clone(), auth_policy);

        Self { keystore, server }
    }

    /// Starts the ssh agent server
    pub fn start_server(&mut self) -> Result<()> {
        debug!("Starting the server.");
        self.server.start_with_default_listeners()
    }

    /// Stops the ssh agent server
    pub fn stop_server(&mut self) {
        debug!("Stopping the server.");
        self.server.stop();
    }

    /// # Returns
    ///
    /// `true` if the server is running, `false` if it is not.
    #[must_use]
    pub fn is_running(&self) -> bool {
        self.server.is_running()
    }

    /// Sets the provided keys into the keystore.
    ///
    /// Does not clear existing keys — the caller is responsible for calling
    /// [`clear_keys`] before a full replacement.
    pub fn set_keys(&self, keys: Vec<K::KeyData>) -> Result<()> {
        debug!("Received new key data.");

        for key in keys {
            self.keystore.insert(key)?;
        }

        info!("New key data set.");

        Ok(())
    }

    /// Clears all keys from keystore
    pub fn clear_keys(&mut self) {
        debug!("Clearing all keys.");
        self.keystore.clear();
        debug!("Cleared all keys.");
    }
}
