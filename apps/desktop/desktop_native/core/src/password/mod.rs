//! Secure password storage and retrieval using platform keychains.
//!
//! Builds with the `file_secure_storage` feature swap the keychain for a plaintext file when
//! `BITWARDEN_SECURE_STORAGE_FILE` is set, so debug runs do not overwrite the production app's
//! entries:
//!
//! ```text
//!   get/set/delete_password
//!           |
//!     feature + env var set? --yes--> file.rs (JSON file)
//!           |
//!           no
//!           v
//!     os (macos.rs / windows.rs / unix.rs)
//! ```

use anyhow::Result;

/// Error message returned when a password is not found in the system keychain.
pub const PASSWORD_NOT_FOUND: &str = "Password not found.";

/// Env var holding the path of the debug password file.
#[cfg(feature = "file_secure_storage")]
const DEBUG_FILE_ENV: &str = "BITWARDEN_SECURE_STORAGE_FILE";

#[cfg(feature = "file_secure_storage")]
mod file;

#[cfg_attr(target_os = "linux", path = "unix.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod os;

/// Retrieves a password.
pub async fn get_password(service: &str, account: &str) -> Result<String> {
    #[cfg(feature = "file_secure_storage")]
    if let Some(path) = debug_file() {
        return file::get_password(&path, service, account);
    }

    os::get_password(service, account).await
}

/// Stores a password. Overwrites an existing entry.
pub async fn set_password(service: &str, account: &str, password: &str) -> Result<()> {
    #[cfg(feature = "file_secure_storage")]
    if let Some(path) = debug_file() {
        return file::set_password(&path, service, account, password);
    }

    os::set_password(service, account, password).await
}

/// Deletes a password.
pub async fn delete_password(service: &str, account: &str) -> Result<()> {
    #[cfg(feature = "file_secure_storage")]
    if let Some(path) = debug_file() {
        return file::delete_password(&path, service, account);
    }

    os::delete_password(service, account).await
}

/// Checks if secure storage is available.
pub async fn is_available() -> Result<bool> {
    #[cfg(feature = "file_secure_storage")]
    if debug_file().is_some() {
        return Ok(true);
    }

    os::is_available().await
}

/// Debug password file path. Never consulted without the `file_secure_storage` feature.
#[cfg(feature = "file_secure_storage")]
fn debug_file() -> Option<std::path::PathBuf> {
    std::env::var_os(DEBUG_FILE_ENV).map(std::path::PathBuf::from)
}
