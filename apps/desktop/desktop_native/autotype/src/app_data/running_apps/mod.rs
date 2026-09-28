//! Get the running, user-facing applications.

use anyhow::Result;

use crate::app_data::{AppData, VerifiableAppData};

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

/// Returns the [`VerifiableAppData`] for the currently active (foreground) application — its
/// [`AppData`] plus live metadata (window handle + pid) for verifying the same app stays active.
///
/// # Errors
///
/// Returns an error if there is no foreground window, or the active window cannot be resolved.
#[cfg(windows)]
pub fn get_active_app() -> Result<VerifiableAppData> {
    windows::get_active_app()
}

/// Returns the [`VerifiableAppData`] for the currently active (foreground) application.
///
/// # Panics
///
/// Always panics — Autotype is not supported on non-Windows platforms.
#[cfg(not(windows))]
pub fn get_active_app() -> Result<VerifiableAppData> {
    unimplemented!("Autotype is not supported on non-Windows platforms")
}
