//! Windows Explorer context menu integration for Bitwarden.
//!
//! Provides registration and removal of a cascading "Bitwarden" context menu
//! entry in Windows Explorer, allowing users to create Sends from files and
//! folders via right-click.

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(not(target_os = "windows"), path = "unimplemented.rs")]
mod internal;
pub use internal::*;
