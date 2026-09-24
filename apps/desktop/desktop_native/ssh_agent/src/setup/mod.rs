//! Detection and automatic configuration of the host, so that SSH clients reach
//! the Bitwarden agent instead of another agent.
//!
//! Each platform needs something different:
//! - unix: `SSH_AUTH_SOCK` must point at the agent's socket, which means adding a line to the
//!   user's shell profiles.
//! - windows: clients always use the well-known OpenSSH named pipe, so the built-in `ssh-agent`
//!   service must not be holding it.

#[cfg(unix)]
mod unix;
#[cfg(windows)]
mod windows;

#[cfg(unix)]
pub use unix::{apply_configuration, is_configured};
#[cfg(windows)]
pub use windows::{apply_configuration, is_configured};
