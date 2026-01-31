// Platform-specific code
#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "windows", path = "windows/mod.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod native;

// Sandbox support (macOS only for MAS builds)
#[cfg(target_os = "macos")]
pub mod sandbox;

// Windows exposes public const
#[allow(unused_imports)]
pub use native::*;
