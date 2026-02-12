//! Bitwarden SSH Agent implementation
//!
//! TODO: add details
//!
//! <https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#RFC4253>

#![allow(dead_code)] // TODO remove when all code is used in follow-up PR

mod agent;
mod approval;
mod authorization;
mod crypto;
mod server;

// external exports for napi
pub use agent::BitwardenSshAgent;
pub use approval::ApprovalRequester;
pub use crypto::keystore::InMemoryEncryptedKeyStore;
pub use server::{AuthRequest, SignRequest};
