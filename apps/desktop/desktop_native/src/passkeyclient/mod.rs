#[cfg_attr(target_os = "linux", path = "ctap2.rs")]
#[cfg_attr(target_os = "windows", path = "unimplemented.rs")]
#[cfg_attr(target_os = "macos", path = "ctap2.rs")]
mod passkeyclient;
pub use passkeyclient::*;
