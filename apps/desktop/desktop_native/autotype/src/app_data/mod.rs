//! Data about applications used for autotype app pairing and verification.

use std::{fmt, path::PathBuf};

pub mod path;
pub mod running_apps;

/// Data about applications
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppData {
    /// Human-readable name for the app (e.g. `Google Chrome`, `Netflix`).
    pub display_name: String,
    /// Absolute path to the app's executable.
    pub path: PathBuf,
}

/// Live-instance metadata for the active application.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppMetadata {
    /// A unique ID for the app, OS-dependent.
    pub id: u32,
    /// The process ID of the app.
    pub pid: u32,
}

/// Data about an application that can also be verified
/// to reference the same application by it's unique identifiers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiableAppData {
    pub app_data: AppData,
    pub app_metadata: AppMetadata,
}

impl fmt::Display for VerifiableAppData {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "App (name: {}, path: {}, id: {}, pid: {})",
            self.app_data.display_name,
            self.app_data.path.display(),
            self.app_metadata.id,
            self.app_metadata.pid,
        )
    }
}
