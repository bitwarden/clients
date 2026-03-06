//! An abstraction layer that allows the `[BitwardenSSHAgent]`
//! to be able to externally request approval for ssh
//! authorization requests.

use crate::server::SignRequest;

/// Bundles a sign request with the vault cipher context needed to approve it.
#[derive(Debug, Clone)]
pub struct SignApprovalRequest {
    /// The sign request, provides context about the request that the server received
    pub sign_request: SignRequest,
    /// The cipher ID from the vault, if the key was found
    pub cipher_id: Option<String>,
}

/// Handler that processes approval requests for signing operations.
#[cfg_attr(test, mockall::automock)]
#[async_trait::async_trait]
pub trait ApprovalRequester: Send + Sync {
    /// Requests approval to unlock the vault.
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Unlock was approved
    /// * `Ok(false)` - Unlock was denied
    ///
    /// # Errors
    ///
    /// If the handler failed to process the request
    async fn request_unlock(&self) -> anyhow::Result<bool>;

    /// Requests approval for a signing operation.
    ///
    /// # Arguments
    ///
    /// * `request` - The sign request bundled with its vault cipher context
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Request was approved
    /// * `Ok(false)` - Request was denied
    ///
    /// # Errors
    ///
    /// If the handler failed to process the request
    async fn request_sign_approval(&self, request: SignApprovalRequest) -> anyhow::Result<bool>;
}
