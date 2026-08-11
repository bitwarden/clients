//! Reads the administrator-forced configuration a host declares through its Unified Endpoint
//! Management (UEM) channel. This is client configuration rather than Vault Data, so it carries no
//! encryption keys, no authentication tokens, and involves no cryptography.
//!
//! Only Windows is implemented here. macOS reads the same container value through Electron's
//! `systemPreferences` and Linux reads it through Node's `fs`, both from the Electron main process
//! rather than through desktop_native.

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(not(target_os = "windows"), path = "unimplemented.rs")]
mod managed_settings_impl;
pub use managed_settings_impl::*;
