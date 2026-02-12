//! An abstraction layer that allows the `[BitwardenSshAgent]`
//! to be able to externally request approval for ssh
//! authorization requests.

use crate::server::SignRequest;

/// Handler that processes approval requests for signing operations.
#[cfg_attr(test, mockall::automock)]
#[async_trait::async_trait]
pub trait ApprovalRequester: Send + Sync {
    /// Requests approval for a signing operation.
    ///
    /// # Arguments
    ///
    /// * `sign_request` - The sign request with context (public key, process name, etc.)
    /// * `cipher_id` - The cipher ID from the vault
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Request was approved
    /// * `Ok(false)` - Request was denied
    ///
    /// # Errors
    ///
    /// Returns an error if the handler failed to process the request
    async fn request_sign_approval(
        &self,
        sign_request: SignRequest,
        cipher_id: Option<String>,
    ) -> Result<bool, anyhow::Error>;
}
