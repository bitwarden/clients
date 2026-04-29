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
    pub fn start(&mut self) -> Result<()> {
        debug!("Starting the server.");
        self.server.start_with_default_listeners()
    }

    /// Stops the server and clears the keystore.
    pub fn stop(&mut self) {
        debug!("Stopping server and clearing keys.");
        self.server.stop();
        self.keystore.clear();
    }

    /// # Returns
    ///
    /// `true` if the server is running, `false` if it is not.
    #[must_use]
    pub fn is_running(&self) -> bool {
        self.server.is_running()
    }

    /// Atomically replaces the keystore contents with the provided keys.
    pub fn replace(&self, keys: Vec<K::KeyData>) -> Result<()> {
        debug!("Replacing key data.");
        self.keystore.replace(keys)?;
        info!("Key data replaced.");
        Ok(())
    }
}
