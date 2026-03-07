//! `AuthPolicy` defines an interface for entities external to the
//! ssh agent server to authorizing SSH agent operations.

use crate::{authorization::AuthError, crypto::PublicKey};

/// Namespace of signature requests.
#[derive(Debug, Clone, PartialEq)]
pub enum SignRequestNamespace {
    Git,
    File,
    Unsupported,
}

/// Request to sign data using an SSH key.
#[derive(Debug, Clone)]
pub struct SignRequest {
    /// The public key identifying which key to use for signing
    pub public_key: PublicKey,
    /// Name of the process making the request. If the agent is running in sandboxed environments,
    /// it may not have access to the process name.
    pub process_name: Option<String>,
    /// Whether this is an agent forwarding request
    pub is_forwarding: bool,
    /// If available, the parsed representation of the sign request's namespace.
    pub namespace: Option<SignRequestNamespace>,
}

/// Authorization request for SSH agent operations.
#[derive(Debug, Clone)]
pub enum AuthRequest {
    /// Request to list available SSH keys
    List,
    /// Request to sign data with a specific key
    Sign(SignRequest),
}

/// Implementers of this policy use the context provided to authorize
/// or deny the ssh agent server operation that was requested.
#[async_trait::async_trait]
pub trait AuthPolicy: Send + Sync {
    /// Authorizes an SSH agent operation request.
    ///
    /// # Arguments
    ///
    /// * `request` - The authorization request to evaluate
    ///
    /// # Returns
    ///
    /// * `Ok(true)` - Operation is authorized
    /// * `Ok(false)` - Operation was denied
    ///
    /// # Errors
    ///
    /// * `AuthError` if an error occurred during authorization
    async fn authorize(&self, request: &AuthRequest) -> Result<bool, AuthError>;
}
