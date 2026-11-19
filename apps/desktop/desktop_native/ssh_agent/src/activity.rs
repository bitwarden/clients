//! Reports each agent operation, who requested it and how it was decided, so the user can review
//! which apps used their keys.

use crate::server::{ConnectionContext, SIGNamespace};

/// The agent operation a peer requested.
#[derive(Debug, Clone)]
pub enum ActivityOperation {
    /// Listed the agent's public keys, e.g. `ssh-add -L`.
    List,
    /// Signed with a key, e.g. to log in to a server or sign a git commit.
    Sign {
        /// The vault item holding the key. `None` when the key is not in the keystore.
        cipher_id: Option<String>,
        /// The SSHSIG namespace. `None` when logging in to a server.
        namespace: Option<SIGNamespace>,
    },
}

/// How the agent answered an operation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivityOutcome {
    Allowed,
    Denied,
    /// No decision was made, e.g. the key was missing or approval timed out.
    Failed,
}

/// One answered agent operation.
#[derive(Debug, Clone)]
pub struct Activity {
    pub operation: ActivityOperation,
    pub connection: ConnectionContext,
    pub outcome: ActivityOutcome,
}

/// Receives every answered agent operation.
#[cfg_attr(test, mockall::automock)]
pub trait ActivityObserver: Send + Sync {
    /// Called once per operation, after the auth policy decided it.
    fn observe(&self, activity: Activity);
}
