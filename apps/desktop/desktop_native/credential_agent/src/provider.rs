//! The interface the agent uses to resolve a client request into a credential.
//!
//! The vault lives in the Electron process, so the agent itself holds no credential data.
//! It hands each request to a [`CredentialProvider`] — implemented over napi — which performs
//! the approval prompt (per the user's configured approval setting) and the vault lookup,
//! then returns the resulting credential or a refusal.

use async_trait::async_trait;

use crate::protocol::{Credential, CredentialQuery};

/// A request forwarded to the provider for approval and lookup.
#[derive(Debug, Clone)]
pub struct CredentialRequest {
    pub query: CredentialQuery,
    pub peer: PeerContext,
}

/// What is known about the process on the other end of the socket. Shown to the user
/// in the approval prompt, so they can tell which program is asking.
#[derive(Debug, Clone, Default)]
pub struct PeerContext {
    pub pid: Option<u32>,
    pub process_name: Option<String>,
}

/// The provider's answer to a [`CredentialRequest`].
#[derive(Debug)]
pub enum CredentialOutcome {
    Granted(Box<Credential>),
    /// The user, or their approval policy, refused.
    Denied,
    /// No vault item matched the query.
    NotFound,
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("the credential request timed out waiting for the user")]
    Timeout,
    #[error("the credential request failed: {0}")]
    Failed(#[source] anyhow::Error),
}

#[async_trait]
pub trait CredentialProvider: Send + Sync + 'static {
    /// Prompts the user if required, then resolves the request against the vault.
    async fn request_credential(
        &self,
        request: CredentialRequest,
    ) -> Result<CredentialOutcome, ProviderError>;
}
