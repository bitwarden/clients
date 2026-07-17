//! Persistent storage of Windows Hello biometric enrollments in the OS keychain.
//!
//! Each enrollment stores the [`Challenge`] used to derive the Windows Hello PRF together with the
//! sealed vault unlock key. Since the keychain is readable by all userspace processes, the
//! challenge is not secret; the security comes from requiring a Windows Hello prompt to re-derive
//! the PRF.

use anyhow::{anyhow, Result};
use desktop_core::password::{self, PASSWORD_NOT_FOUND};
use tracing::{debug, warn};

use super::encryption::Challenge;

pub(crate) const KEYCHAIN_SERVICE_NAME: &str = "BitwardenBiometricsV2";

/// A keychain entry: the user key is wrapped with XChaCha20Poly1305 using the Windows Hello-derived
/// PRF as a key. The `challenge` is stored because it is the input used to re-derive the PRF.
#[derive(serde::Serialize, serde::Deserialize)]
pub(crate) struct WindowsHelloKeychainEntry {
    pub(crate) nonce: [u8; super::encryption::XCHACHA20POLY1305_NONCE_LENGTH],
    pub(crate) challenge: Challenge,
    pub(crate) wrapped_key: Vec<u8>,
}

pub(crate) async fn set_entry(user_id: &str, entry: &WindowsHelloKeychainEntry) -> Result<()> {
    password::set_password(
        KEYCHAIN_SERVICE_NAME,
        user_id,
        &serde_json::to_string(entry)?,
    )
    .await
}

pub(crate) async fn get_entry(user_id: &str) -> Result<WindowsHelloKeychainEntry> {
    serde_json::from_str(&password::get_password(KEYCHAIN_SERVICE_NAME, user_id).await?)
        .map_err(|e| anyhow!(e))
}

pub(crate) async fn delete_entry(user_id: &str) -> Result<()> {
    password::delete_password(KEYCHAIN_SERVICE_NAME, user_id)
        .await
        .or_else(|e| {
            if e.to_string() == PASSWORD_NOT_FOUND {
                debug!(
                    "[Windows Hello] No keychain entry found for user {}, nothing to delete",
                    user_id
                );
                Ok(())
            } else {
                Err(e)
            }
        })
}

pub(crate) async fn has_entry(user_id: &str) -> Result<bool> {
    password::get_password(KEYCHAIN_SERVICE_NAME, user_id)
        .await
        .map(|entry| !entry.is_empty())
        .or_else(|e| {
            if e.to_string() == PASSWORD_NOT_FOUND {
                Ok(false)
            } else {
                warn!(
                    "[Windows Hello] Error checking keychain entry for user {}: {}",
                    user_id, e
                );
                Err(e)
            }
        })
}
