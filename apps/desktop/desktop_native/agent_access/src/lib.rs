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
#[cfg(unix)]
pub use server::listener::unix::socket_paths;
#[cfg(windows)]
pub use server::listener::windows::{pipe_name, verify_pipe_server};
