#[cfg(target_os = "windows")]
pub mod windows;
#[cfg(target_os = "windows")]
pub use crate::windows::SUPPORTED_BROWSERS as PLATFORM_SUPPORTED_BROWSERS;

#[cfg(target_os = "macos")]
pub mod macos;
#[cfg(target_os = "macos")]
pub use crate::macos::SUPPORTED_BROWSERS as PLATFORM_SUPPORTED_BROWSERS;

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "linux")]
pub use crate::linux::SUPPORTED_BROWSERS as PLATFORM_SUPPORTED_BROWSERS;

pub mod chromium;
pub mod metadata;
pub mod util;
