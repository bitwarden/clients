//! SSH Agent Server implementation
//!
//! Adheres to the protocol defined in:
//! <https://datatracker.ietf.org/doc/draft-ietf-sshm-ssh-agent/>

mod auth_policy;

use std::sync::Arc;

use anyhow::Result;
pub(crate) use auth_policy::AuthPolicy;
pub use auth_policy::{AuthRequest, SIGNamespace, SignRequest};
use tokio_util::sync::CancellationToken;

use crate::storage::keystore::KeyStore;

/// SSH Agent protocol server.
///
/// Handles SSH agent protocol messages and delegates to provided
/// keystore and authorization policy implementations.
///
/// The server internally manages its lifecycle - it can be created, started, stopped,
/// and restarted without being re-created.
pub struct SSHAgentServer<K, A> {
    /// The storage of SSH key data
    keystore: Arc<K>,
    /// The authenticator policy to invoke for operations that require authorization
    auth_policy: Arc<A>,
    /// Async task coordination to use when asked to stop. Is `None` when non running.
    cancellation_token: Option<CancellationToken>,
}

impl<K, A> SSHAgentServer<K, A>
where
    K: KeyStore,
    A: AuthPolicy,
{
    /// Creates a new [`SSHAgentServer`]
    pub fn new(keystore: Arc<K>, auth_policy: Arc<A>) -> Self {
        Self {
            keystore,
            auth_policy,
            cancellation_token: None,
        }
    }

    pub fn start(&mut self) -> Result<()> {
        todo!();
    }

    pub fn is_running(&self) -> bool {
        todo!();
    }

    pub fn stop(&mut self) {
        todo!();
    }
}
