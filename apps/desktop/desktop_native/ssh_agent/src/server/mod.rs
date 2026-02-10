//! SSH Agent Server implementation
//!
//! Adheres to the protocol defined in:
//! <https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html>

mod auth_policy;

use std::sync::Arc;

use anyhow::Result;
pub(crate) use auth_policy::AuthPolicy;
pub use auth_policy::{AuthRequest, SignRequest};
use tokio_util::sync::CancellationToken;

use crate::crypto::keystore::KeyStore;

/// SSH Agent protocol server.
///
/// Handles SSH agent protocol messages and delegates to provided
/// keystore and authorization policy implementations.
///
/// The server manages its own lifecycle - it can be created, started, stopped,
/// and restarted without being recreated.
pub struct SshAgentServer<K, A> {
    keystore: Arc<K>,
    auth_policy: Arc<A>,
    cancellation_token: Option<CancellationToken>,
}

impl<K, A> SshAgentServer<K, A>
where
    K: KeyStore,
    A: AuthPolicy,
{
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
