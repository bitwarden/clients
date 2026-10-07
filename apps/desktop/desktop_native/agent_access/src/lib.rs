//! Local agent access: programs on this machine ask the desktop app for a vault item, or for a
//! human decision, over a local socket. The listener sets who is asking from the OS; the
//! [`Router`] hands every request to one [`Answerer`] (the desktop UI, over napi).

mod agent;
pub mod protocol;
pub mod requester;
mod router;
mod server;

pub use agent::BitwardenCredentialAgent;
pub use router::{AgentRequest, Answerer, Outcome, RequestKind, Router};

/// The Unix socket the agent listens on, and that clients connect to.
#[cfg(unix)]
pub fn socket_path() -> anyhow::Result<std::path::PathBuf> {
    server::listener::unix::socket_path()
}

/// The named pipe the agent listens on, and that clients connect to.
#[cfg(windows)]
pub fn pipe_name() -> &'static str {
    server::listener::windows::PIPE_NAME
}
