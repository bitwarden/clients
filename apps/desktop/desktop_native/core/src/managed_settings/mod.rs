//! Reads the managed-settings container value that an administrator deploys through the host's
//! device management channel. The value is a single JSON string, passed through unparsed.

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "linux", path = "unimplemented.rs")]
mod managed_settings_impl;
pub use managed_settings_impl::*;
