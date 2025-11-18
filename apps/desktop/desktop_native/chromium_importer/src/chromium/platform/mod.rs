// Platform-specific code
#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "windows", path = "windows/mod.rs")]
#[cfg_attr(all(target_os = "macos", not(feature = "sandbox")), path = "macos.rs")]

// TODO rework this to place sandbox code in macos and cfg gate it there
#[cfg_attr(all(target_os = "macos", feature = "sandbox"), path = "macos_sandbox.rs")]

mod native;

// Windows exposes public const
#[allow(unused_imports)]
pub use native::*;