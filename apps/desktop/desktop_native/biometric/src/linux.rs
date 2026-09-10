//! This file implements Polkit based system unlock.
//!
//! # Security
//! This section describes the assumed security model and security guarantees achieved. In the
//! required security guarantee is that a locked vault - a running app - cannot be unlocked when the
//! device (user-space) is compromised in this state.
//!
//! ## Ephemeral path
//! When first unlocking the app, the app sends the user-key to this module, which holds it in
//! secure memory, protected by memfd_secret. This makes it inaccessible to other processes, even if
//! they compromise root, a kernel compromise has circumventable best-effort protections. While the
//! app is running this key is held in memory, even if locked. When unlocking, the app will prompt
//! the user via `polkit` to get a yes/no decision on whether to release the key to the app.
//!
//! ## Persistent path
//! Optionally, the user key can be persisted to the OS Secret Service, so that system unlock also
//! works after an app restart or reboot. Unlike Windows Hello, polkit only returns a yes/no
//! authorization decision and no key material, so there is no secret to wrap the user key with;
//! the Secret Service is the only thing protecting it at rest.
//!
//! This means the above security guarantee does NOT hold for the persistent path: any un-sandboxed
//! process running as the user can read the key from the Secret Service and thus unlock a locked
//! vault without user verification. Because of this it is opt-in only, gated behind an explicit
//! warning in the app, and the ephemeral path is always preferred while a key is held in memory.

use std::{collections::HashMap, sync::Arc};

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use desktop_core::password::{self, PASSWORD_NOT_FOUND};
use secure_memory::{EncryptedMemoryStore, SecureMemoryStore as _};
use tokio::sync::Mutex;
use tracing::{debug, warn};
use zbus::Connection;
use zbus_polkit::policykit1::{AuthorityProxy, CheckAuthorizationFlags, Subject};

/// Secret Service collection entry name holding the persistently enrolled user keys.
const KEYRING_SERVICE_NAME: &str = "BitwardenBiometricsV2";

/// Biometric lock system using Polkit for authentication and secure memory to hold the key on
/// Linux.
pub struct BiometricLockSystem {
    // The userkeys that are held in memory MUST be protected from memory dumping attacks, to
    // ensure locked vaults cannot be unlocked
    secure_memory: Arc<Mutex<EncryptedMemoryStore<String>>>,
    // Cache whether a Secret Service entry exists for a user, to avoid querying the Secret Service
    // on every poll of `unlock_available` / `has_persistent`. Key = user_id, Value = true (entry
    // exists) or false (no entry). If user_id is not in the map = cache miss.
    // Updated on enroll (true) and unenroll (false).
    has_keyring_entry_cache: Arc<Mutex<HashMap<String, bool>>>,
}

impl BiometricLockSystem {
    /// Creates a new biometric lock system with secure memory storage.
    pub fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(EncryptedMemoryStore::default())),
            has_keyring_entry_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

impl Default for BiometricLockSystem {
    fn default() -> Self {
        Self::new()
    }
}

impl super::BiometricTrait for BiometricLockSystem {
    async fn authenticate(&self, _hwnd: Vec<u8>, _message: String) -> Result<bool> {
        polkit_authenticate_bitwarden_policy().await
    }

    async fn authenticate_available(&self) -> Result<bool> {
        polkit_is_bitwarden_policy_available().await
    }

    async fn enroll_persistent(&self, user_id: &str, key: &[u8]) -> Result<()> {
        // Polkit hands out no key material, only a yes/no decision, so the user key cannot be
        // wrapped with a secret derived from the authentication like it is on Windows. It is
        // handed to the OS Secret Service as-is. See the security note at the top of this file
        // for the implications.
        set_keyring_entry(user_id, key).await?;

        self.has_keyring_entry_cache
            .lock()
            .await
            .insert(user_id.to_string(), true);
        Ok(())
    }

    async fn provide_key(&self, user_id: &str, key: &[u8]) {
        self.secure_memory
            .lock()
            .await
            .put(user_id.to_string(), key);
    }

    async fn unlock(&self, user_id: &String, _hwnd: Vec<u8>) -> Result<Vec<u8>> {
        // A single authorization covers both the ephemeral and the persistent path, so the user is
        // never prompted twice for one unlock.
        if !polkit_authenticate_bitwarden_policy().await? {
            return Err(anyhow!("Authentication failed"));
        }

        // If the key is held ephemerally, always prefer it; the Secret Service is only consulted
        // when there is no in-memory key, which is the case after an app restart.
        let ephemeral_key = self.secure_memory.lock().await.get(user_id)?;
        if let Some(key) = ephemeral_key {
            return Ok(key);
        }

        let key = get_keyring_entry(user_id).await?;
        // The first unlock already sets the key for subsequent unlocks. The key may again be set
        // externally after unlock finishes.
        self.secure_memory
            .lock()
            .await
            .put(user_id.to_string(), &key);
        Ok(key)
    }

    async fn unlock_available(&self, user_id: &String) -> Result<bool> {
        if self.secure_memory.lock().await.has(user_id) {
            return Ok(true);
        }
        self.has_persistent(user_id).await
    }

    async fn has_persistent(&self, user_id: &str) -> Result<bool> {
        // Check if we have a cached value for this user (either true or false)
        let mut cache = self.has_keyring_entry_cache.lock().await;
        if let Some(&has_entry) = cache.get(user_id) {
            return Ok(has_entry);
        }

        // Cache miss: check the Secret Service and cache the result for this user
        let has_entry = has_keyring_entry(user_id).await.unwrap_or(false);
        cache.insert(user_id.to_string(), has_entry);
        Ok(has_entry)
    }

    async fn unenroll(&self, user_id: &String) -> Result<(), anyhow::Error> {
        self.secure_memory.lock().await.remove(user_id);
        delete_keyring_entry(user_id).await?;

        self.has_keyring_entry_cache
            .lock()
            .await
            .insert(user_id.clone(), false);
        Ok(())
    }
}

async fn set_keyring_entry(user_id: &str, key: &[u8]) -> Result<()> {
    password::set_password(KEYRING_SERVICE_NAME, user_id, &STANDARD.encode(key)).await
}

async fn get_keyring_entry(user_id: &str) -> Result<Vec<u8>> {
    let entry = password::get_password(KEYRING_SERVICE_NAME, user_id).await?;
    STANDARD.decode(entry).map_err(|e| anyhow!(e))
}

async fn delete_keyring_entry(user_id: &str) -> Result<()> {
    password::delete_password(KEYRING_SERVICE_NAME, user_id)
        .await
        .or_else(|e| {
            if e.to_string() == PASSWORD_NOT_FOUND {
                debug!("[Polkit] No keyring entry to delete");
                Ok(())
            } else {
                Err(e)
            }
        })
}

async fn has_keyring_entry(user_id: &str) -> Result<bool> {
    password::get_password(KEYRING_SERVICE_NAME, user_id)
        .await
        .map(|entry| !entry.is_empty())
        .or_else(|e| {
            if e.to_string() == PASSWORD_NOT_FOUND {
                Ok(false)
            } else {
                warn!("[Polkit] Error checking keyring entry: {e}");
                Err(e)
            }
        })
}

/// Perform a polkit authorization against the bitwarden unlock policy. Note: This relies on no
/// custom rules in the system skipping the authorization check, in which case this counts as UV /
/// authentication.
async fn polkit_authenticate_bitwarden_policy() -> Result<bool> {
    debug!("[Polkit] Authenticating / performing UV");

    let connection = Connection::system().await?;
    let proxy = AuthorityProxy::new(&connection).await?;

    // Use system-bus-name instead of unix-process to avoid PID namespace issues in
    // sandboxed environments (e.g., Flatpak). When using unix-process with a PID from
    // inside the sandbox, polkit cannot validate it against the host PID namespace.
    //
    // By using system-bus-name, polkit queries D-Bus for the connection's credentials,
    // which includes the correct host PID and UID, avoiding namespace mismatches.
    //
    // If D-Bus unique name is not available, fall back to the traditional unix-process
    // approach for compatibility with non-sandboxed environments.
    let subject = if let Some(bus_name) = connection.unique_name() {
        use zbus::zvariant::{OwnedValue, Str};
        let mut subject_details = std::collections::HashMap::new();
        subject_details.insert(
            "name".to_string(),
            OwnedValue::from(Str::from(bus_name.as_str())),
        );
        Subject {
            subject_kind: "system-bus-name".to_string(),
            subject_details,
        }
    } else {
        // Fallback: use unix-process with PID (may not work in sandboxed environments)
        Subject::new_for_owner(std::process::id(), None, None)?
    };

    let details = std::collections::HashMap::new();
    let authorization_result = proxy
        .check_authorization(
            &subject,
            "com.bitwarden.Bitwarden.unlock",
            &details,
            CheckAuthorizationFlags::AllowUserInteraction.into(),
            "",
        )
        .await;

    match authorization_result {
        Ok(result) => Ok(result.is_authorized),
        Err(e) => {
            warn!("[Polkit] Error performing authentication: {:?}", e);
            Ok(false)
        }
    }
}

async fn polkit_is_bitwarden_policy_available() -> Result<bool> {
    let connection = Connection::system().await?;
    let proxy = AuthorityProxy::new(&connection).await?;
    let actions = proxy.enumerate_actions("en").await?;
    for action in actions {
        if action.action_id == "com.bitwarden.Bitwarden.unlock" {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BiometricTrait;

    #[tokio::test]
    #[ignore]
    async fn test_polkit_authenticate() {
        let result = polkit_authenticate_bitwarden_policy().await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_has_persistent_without_enrollment() {
        let lock_system = BiometricLockSystem::new();
        assert!(!lock_system
            .has_persistent("test_user_not_enrolled")
            .await
            .unwrap());
    }

    #[tokio::test]
    async fn test_unlock_available_with_ephemeral_key() {
        let user_id = String::from("test_user");
        let lock_system = BiometricLockSystem::new();

        assert!(!lock_system.unlock_available(&user_id).await.unwrap());

        lock_system.provide_key(&user_id, &[1u8; 64]).await;
        assert!(lock_system.unlock_available(&user_id).await.unwrap());
    }

    // Note: These tests are ignored because they require an available Secret Service
    // implementation, and a polkit prompt the user has to confirm.

    #[tokio::test]
    #[ignore]
    async fn test_enroll_persistent_unenroll() {
        let user_id = String::from("test_user");
        let key = [1u8; 64];

        let lock_system = BiometricLockSystem::new();

        lock_system.enroll_persistent(&user_id, &key).await.unwrap();
        assert!(lock_system.has_persistent(&user_id).await.unwrap());
        assert!(lock_system.unlock_available(&user_id).await.unwrap());

        lock_system.unenroll(&user_id).await.unwrap();
        assert!(!lock_system.has_persistent(&user_id).await.unwrap());

        // Unenrolling twice must not fail, even though there is no entry left to delete
        lock_system.unenroll(&user_id).await.unwrap();
        assert!(!lock_system.has_persistent(&user_id).await.unwrap());
    }

    #[tokio::test]
    #[ignore]
    async fn test_unlock_returns_persisted_key() {
        let user_id = String::from("test_user");
        let key = [1u8; 64];

        let lock_system = BiometricLockSystem::new();
        lock_system.enroll_persistent(&user_id, &key).await.unwrap();

        let unlocked_key = lock_system.unlock(&user_id, Vec::new()).await.unwrap();
        assert_eq!(unlocked_key, key);

        lock_system.unenroll(&user_id).await.unwrap();
    }
}
