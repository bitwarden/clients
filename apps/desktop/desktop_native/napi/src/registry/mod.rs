#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(not(target_os = "windows"), path = "dummy.rs")]
mod internal;
pub use internal::*;
