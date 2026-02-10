//! An abstraction layer that allows the `[BitwardenSshAgent]`
//! to be able to externally request approval for ssh
//! authorization requests.

use crate::server::AuthRequest;

/// Handler that processes approval requests.
#[cfg_attr(test, mockall::automock)]
#[async_trait::async_trait]
pub trait ApprovalRequester: Send + Sync {
    /// Handles an approval request.
    ///
    /// # Arguments
    ///
    /// * `request` - The authorization request (List or Sign with context)
    /// * `cipher_id` - The cipher ID from the vault (for sign requests)
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Request was approved
    /// * `Ok(false)` - Request was denied
    ///
    /// # Errors
    ///
    /// Returns an error if the handler failed to process the request
    async fn request(
        &self,
        request: AuthRequest,
        cipher_id: Option<String>,
    ) -> Result<bool, anyhow::Error>;
}
