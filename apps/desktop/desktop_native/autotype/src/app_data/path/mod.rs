//! Logic for application paths used in autotype app data.
//!
//! Only user-specific folders are normalized. System paths
//! are identical across users and need no normalization.

pub mod normalizer;
pub mod platform_policy;

use std::path::PathBuf;

pub use normalizer::PathNormalizer;
pub use platform_policy::PlatformPolicy;
use tracing::warn;

/// A well-known-dir resolver (a `dirs` function) paired with its substitution token.
type DirMapping = (fn() -> Option<PathBuf>, &'static str);

/// Directory mappings for Windows platform.
#[cfg(windows)]
fn mapped_dirs() -> Vec<DirMapping> {
    vec![
        (dirs::data_local_dir, "%LOCALAPPDATA%"), // ...\AppData\Local
        (dirs::data_dir, "%APPDATA%"),            // ...\AppData\Roaming
        (dirs::home_dir, "%USERPROFILE%"),        // C:\Users\Jane
    ]
}

#[cfg(not(windows))]
fn mapped_dirs() -> Vec<DirMapping> {
    unimplemented!("Autotype is not supported on non-Windows platforms")
}

/// Build a [`PathNormalizer`] from the user's mapped dirs.
/// Best effort: unresolvable dirs are skipped. Resolution failure is very unlikely in
/// practice.
pub fn build_normalizer() -> PathNormalizer {
    let dirs = mapped_dirs();

    let mut mappings = Vec::with_capacity(dirs.len());

    for (resolve, token) in dirs {
        match resolve() {
            Some(dir) => mappings.push((dir.to_string_lossy().into_owned(), token.to_string())),
            None => {
                warn!(token = %token, "could not resolve well-known dir; paths under it won't be normalized");
            }
        }
    }

    PathNormalizer::new(mappings, PlatformPolicy::WINDOWS)
}
