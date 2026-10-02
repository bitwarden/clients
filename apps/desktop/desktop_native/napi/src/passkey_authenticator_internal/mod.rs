#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "linux", path = "linux.rs")]
mod internal;
pub use internal::*;

/// Errors returned by `register()`.
#[derive(Debug)]
pub enum RegisterError {
    /// The passkey plugin is not supported on this platform or by this build of the app.
    NotSupported,
    /// The passkey plugin is supported, but registration failed.
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    Failed(String),
}
