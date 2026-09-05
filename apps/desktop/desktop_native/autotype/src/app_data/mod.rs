//! Data about applications used for autotype app pairing and verification.

use std::path::PathBuf;

pub mod path;
pub mod running_apps;

/// Data about applications
#[derive(Debug, Clone)]
pub struct AppData {
    /// Human-readable name for the app (e.g. `Google Chrome`, `Netflix`).
    pub display_name: String,
    /// Absolute path to the app's executable, when it can be resolved.
    pub path: Option<PathBuf>,
}
