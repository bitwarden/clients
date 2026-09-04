//! Bitwarden credential agent.
//!
//! Lets a local program ask the running desktop app for a login credential over IPC,
//! subject to the user's configured approval policy — the same shape as the SSH agent,
//! but returning username/password/TOTP instead of performing a signature.
//!
//! # Architecture
//! - `protocol` defines the newline-delimited JSON wire format shared with clients.
//! - `server` owns the platform listener and serves one request per connection.
//! - `provider` is the seam to the vault: Electron implements it over napi, applies the approval
//!   setting, and performs the lookup.
//! - `agent` ties the two together and owns the listener's lifecycle.

mod agent;
mod protocol;
mod provider;
mod server;

pub use agent::BitwardenCredentialAgent;
pub use protocol::{Action, Credential, CredentialQuery, Request, Response, PROTOCOL_VERSION};
pub use provider::{
    CredentialOutcome, CredentialProvider, CredentialRequest, PeerContext, ProviderError,
};

/// The Unix socket the agent listens on, and that clients should connect to.
#[cfg(unix)]
pub fn socket_path() -> anyhow::Result<std::path::PathBuf> {
    server::listener::unix::socket_path()
}

/// The named pipe the agent listens on, and that clients should connect to.
#[cfg(windows)]
pub fn pipe_name() -> &'static str {
    server::listener::windows::PIPE_NAME
}
