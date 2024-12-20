#[allow(clippy::module_inception)]
#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "windows", path = "unimplemented.rs")]
#[cfg_attr(target_os = "macos", path = "unimplemented.rs")]
mod powermonitor;
pub use powermonitor::*;
