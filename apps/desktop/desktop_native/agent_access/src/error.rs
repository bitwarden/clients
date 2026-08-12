//! Crate-wide error type.
//!
//! Variants never carry decrypted vault data, credential values, PSKs, or identity key
//! material — only presence/failure information, matching the zero-knowledge logging rule
//! restated throughout this crate.

use thiserror::Error;

use crate::callbacks::CallbackError;

/// Errors returned by [`crate::DesktopAgentAccess`] and the storage adapters it builds.
#[derive(Debug, Error)]
pub enum AgentAccessError {
    /// `start()` was called while already running.
    #[error("agent access is already running")]
    AlreadyRunning,

    /// An operation that requires an active connection was called before `start()` or after
    /// `stop()`.
    #[error("agent access is not running")]
    NotRunning,

    /// The underlying `ap-client` operation failed.
    #[error("agent access client error: {0}")]
    Client(#[from] ap_client::ClientError),

    /// A host storage callback (identity/connections/PSKs) failed.
    #[error("storage callback failed: {0}")]
    Storage(#[source] CallbackError),

    /// Persisted data under a storage key could not be parsed (corrupt or foreign format).
    #[error("stored agent access data is invalid")]
    InvalidStoredData,

    /// A caller-supplied fingerprint string was not valid 64-character hex.
    #[error("invalid fingerprint")]
    InvalidFingerprint,

    /// The local listener (Unix socket / Windows named pipe) could not be started. Never
    /// carries the socket path itself — see `local_listener`'s module docs.
    #[error("local listener failed: {0}")]
    LocalListener(String),
}
