#[cfg(target_os = "windows")]
pub mod abe_config;

#[macro_use]
extern crate napi_derive;

pub mod chromium;
pub mod metadata;
pub mod util;

pub use crate::chromium::platform::SUPPORTED_BROWSERS as PLATFORM_SUPPORTED_BROWSERS;
