//! Get the running, user-facing applications.

use anyhow::Result;

use crate::app_data::AppData;

#[cfg(windows)]
mod windows;

/// Lists the running user-facing applications as [`AppData`].
///
/// # Errors
///
/// Currently infallible. Returns `Result` for forward compatibility.
#[cfg(windows)]
pub fn get_running_apps() -> Result<Vec<AppData>> {
    Ok(windows::get_running_apps())
}

/// Lists the running user-facing applications as [`AppData`].
///
/// # Panics
///
/// Always panics — Autotype is not supported on non-Windows platforms.
#[cfg(not(windows))]
pub fn get_running_apps() -> Result<Vec<AppData>> {
    unimplemented!("Autotype is not supported on non-Windows platforms")
}
