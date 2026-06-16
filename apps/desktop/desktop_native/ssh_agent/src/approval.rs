//! An abstraction layer that allows the `[BitwardenSSHAgent]`
//! to be able to externally request approval for ssh
//! authorization requests.

use thiserror::Error;

use crate::server::SignRequest;

/// Errors that can occur when requesting approval from an external handler.
#[derive(Debug, Error)]
pub enum ApprovalError {
    /// The handler did not respond within the allowed time.
    #[error("Approval request timed out")]
    Timeout,

    /// The handler was invoked but encountered a failure during processing.
    #[error("Approval handler failed: {0}")]
    HandlerFailed(#[source] anyhow::Error),
}

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
    /// Requests approval for a signing operation.
    ///
    /// # Arguments
    ///
    /// * `request` - The sign request bundled with its vault cipher context
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Sign was approved
    /// * `Ok(false)` - Sign was denied
    async fn request_sign_approval(
        &self,
        request: SignApprovalRequest,
    ) -> Result<bool, ApprovalError>;
}
