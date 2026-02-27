pub const PASSWORD_NOT_FOUND: &str = "Password not found.";

#[allow(clippy::module_inception)]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod password;
pub use password::*;
