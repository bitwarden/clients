//! This module implements Windows-Hello based biometric unlock.
//!
//! There are two paths implemented here.
//! The former via UV + ephemerally (but protected) keys. This only works after first unlock.
//! The latter via a signing API, that deterministically signs a challenge, from which a windows
//! hello key is derived. This key is used to encrypt the protected key.
//!
//! # Security
//! The security goal is that a locked vault - a running app - cannot be unlocked when the device
//! (user-space) is compromised in this state.
//!
//! ## UV path
//! When first unlocking the app, the app sends the user-key to this module, which holds it in
//! secure memory, protected by DPAPI. This makes it inaccessible to other processes, unless they
//! compromise the system administrator, or kernel. While the app is running this key is held in
//! memory, even if locked. When unlocking, the app will prompt the user via
//! `windows_hello_authenticate` to get a yes/no decision on whether to release the key to the app.
//! Note: Further process isolation is needed here so that code cannot be injected into the running
//! process, which may circumvent DPAPI.
//!
//! ## Sign path
//! In this scenario, when enrolling, the app sends the user-key to this module, which derives the
//! windows hello key with the Windows Hello prompt. This is done by signing a per-user challenge,
//! which produces a deterministic signature which is hashed to obtain a key. This key is used to
//! encrypt and persist the vault unlock key (user key).
//!
//! Since the keychain can be accessed by all user-space processes, the challenge is known to all
//! userspace processes. Therefore, to circumvent the security measure, the attacker would need to
//! create a fake Windows-Hello prompt, and get the user to confirm it.

mod encryption;
mod ephemeral;
mod keychain;
mod keycredentialmanager;
mod persistent;

use anyhow::{anyhow, Result};
use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey};
use tracing::{debug, warn};

use self::{
    ephemeral::EphemeralWindowsHelloLockSystem,
    keycredentialmanager::{get_active_window, restore_focus},
    persistent::PersistentWindowsHelloSystem,
};

/// The Windows OS implementation of the biometric trait.
///
/// This is a orchestrator over two subsystems: [`EphemeralWindowsHelloLockSystem`] (UV +
/// in-memory keys, used after first unlock) and [`PersistentWindowsHelloSystem`] (keychain-backed
/// signing, used for persistent enrollment).
pub struct BiometricLockSystem {
    ephemeral: EphemeralWindowsHelloLockSystem,
    persistent: PersistentWindowsHelloSystem,
}

impl BiometricLockSystem {
    /// Creates a new instance of the Windows biometric lock system.
    pub fn new() -> Self {
        Self {
            ephemeral: EphemeralWindowsHelloLockSystem::new(),
            persistent: PersistentWindowsHelloSystem::new(),
        }
    }
}

impl Default for BiometricLockSystem {
    fn default() -> Self {
        Self::new()
    }
}

impl super::BiometricTrait for BiometricLockSystem {
    async fn authenticate(&self, _hwnd: Vec<u8>, message: String) -> Result<bool> {
        self.ephemeral.authenticate(message).await
    }

    async fn authenticate_available(&self) -> Result<bool> {
        self.ephemeral.authenticate_available().await
    }

    async fn unenroll(&self, user_id: &String) -> Result<()> {
        self.ephemeral.remove(user_id).await;
        self.persistent.unenroll(user_id).await
    }

    async fn enroll_persistent(&self, user_id: &str, key: &[u8]) -> Result<()> {
        let user_key = SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(key.to_vec()))
            .map_err(|e| anyhow!("Failed to parse user key: {e}"))?;
        self.persistent.enroll(user_id, &user_key).await
    }

    async fn provide_key(&self, user_id: &str, key: &[u8]) {
        match SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(key.to_vec())) {
            Ok(user_key) => self.ephemeral.provide_key(user_id, &user_key).await,
            Err(e) => warn!("[Windows Hello] Ignoring malformed user key in provide_key: {e}"),
        }
    }

    async fn unlock(&self, user_id: &String, _hwnd: Vec<u8>) -> Result<Vec<u8>> {
        // Allow restoring focus to the previous window (browser)
        let previous_active_window = get_active_window();
        let _focus_scopeguard = scopeguard::guard((), |_| {
            if let Some(hwnd) = previous_active_window {
                debug!("Restoring focus to previous window");
                restore_focus(hwnd.0);
            }
        });

        // If the key is held ephemerally, always use the UV path. Only use the persistent signing
        // path if the key is not held ephemerally but the keychain holds it persistently.
        let user_key = if self.ephemeral.has(user_id).await {
            self.ephemeral.unlock(user_id).await?
        } else {
            let user_key = self.persistent.unlock(user_id).await?;
            // The first unlock already sets the key for subsequent unlocks. The key may again be
            // set externally after unlock finishes.
            self.ephemeral.provide_key(user_id, &user_key).await;
            user_key
        };
        Ok(user_key.to_encoded().to_vec())
    }

    async fn unlock_available(&self, user_id: &String) -> Result<bool> {
        let has_key = self.ephemeral.has(user_id).await
            || self.persistent.has(user_id).await.unwrap_or(false);
        Ok(has_key
            && self
                .ephemeral
                .authenticate_available()
                .await
                .unwrap_or(false))
    }

    async fn has_persistent(&self, user_id: &str) -> Result<bool> {
        self.persistent.has(user_id).await
    }
}

#[cfg(test)]
#[allow(clippy::print_stdout)]
mod tests {
    use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey};
    use rand_core::Rng;

    use super::{
        encryption::{Challenge, CHALLENGE_LENGTH, PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH},
        ephemeral::windows_hello_authenticate,
        keychain::{
            self, WindowsHelloKeychainEntry, WindowsHelloKeychainEntryV1, KEYCHAIN_SERVICE_NAME,
        },
        keycredentialmanager::KeyCredentialManager,
        BiometricLockSystem,
    };
    use crate::BiometricTrait;
    // Note: These tests are ignored because they require manual intervention to run

    #[tokio::test]
    #[ignore]
    async fn test_key_credential_manager_derive_prf_manual() {
        let challenge = Challenge::from_bytes([0u8; CHALLENGE_LENGTH]);
        let windows_hello_key = KeyCredentialManager::derive_prf(&challenge).await.unwrap();
        println!(
            "Windows hello key {:?} for challenge",
            windows_hello_key.as_bytes()
        );
    }

    #[tokio::test]
    #[ignore]
    async fn test_windows_hello_authenticate() {
        let authenticated =
            windows_hello_authenticate("Test Windows Hello authentication".to_string())
                .await
                .unwrap();
        println!("Windows Hello authentication result: {:?}", authenticated);
    }

    #[tokio::test]
    #[ignore]
    async fn test_double_unenroll() {
        let user_id = String::from("test_user");
        let mut key = [0u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH];
        bitwarden_random::rng().fill_bytes(&mut key);

        let windows_hello_lock_system = BiometricLockSystem::new();

        println!("Enrolling user");
        windows_hello_lock_system
            .enroll_persistent(&user_id, &key)
            .await
            .unwrap();
        assert!(windows_hello_lock_system
            .has_persistent(&user_id)
            .await
            .unwrap());

        println!("Unlocking user");
        let key_after_unlock = windows_hello_lock_system
            .unlock(&user_id, Vec::new())
            .await
            .unwrap();
        assert_eq!(key_after_unlock, key);

        println!("Unenrolling user");
        windows_hello_lock_system.unenroll(&user_id).await.unwrap();
        assert!(!windows_hello_lock_system
            .has_persistent(&user_id)
            .await
            .unwrap());

        println!("Unenrolling user again");

        // This throws PASSWORD_NOT_FOUND but our code should handle that and not throw.
        windows_hello_lock_system.unenroll(&user_id).await.unwrap();
        assert!(!windows_hello_lock_system
            .has_persistent(&user_id)
            .await
            .unwrap());
    }

    #[tokio::test]
    #[ignore]
    async fn test_enroll_unlock_unenroll() {
        let user_id = String::from("test_user");
        let mut key = [0u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH];
        bitwarden_random::rng().fill_bytes(&mut key);

        let windows_hello_lock_system = BiometricLockSystem::new();

        println!("Enrolling user");
        windows_hello_lock_system
            .enroll_persistent(&user_id, &key)
            .await
            .unwrap();
        assert!(windows_hello_lock_system
            .has_persistent(&user_id)
            .await
            .unwrap());

        println!("Unlocking user");
        let key_after_unlock = windows_hello_lock_system
            .unlock(&user_id, Vec::new())
            .await
            .unwrap();
        assert_eq!(key_after_unlock, key);

        println!("Unenrolling user");
        windows_hello_lock_system.unenroll(&user_id).await.unwrap();
        assert!(!windows_hello_lock_system
            .has_persistent(&user_id)
            .await
            .unwrap());
    }

    #[tokio::test]
    #[ignore]
    async fn test_legacy_entry_migrates_on_unlock() {
        let user_id = String::from("test_user");
        let mut key = [0u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH];
        bitwarden_random::rng().fill_bytes(&mut key);

        let windows_hello_lock_system = BiometricLockSystem::new();

        // Write a legacy (pre-envelope) keychain entry directly, simulating a user enrolled with an
        // older build.
        let mut challenge_bytes = [0u8; CHALLENGE_LENGTH];
        bitwarden_random::rng().fill_bytes(&mut challenge_bytes);
        let challenge = Challenge::from_bytes(challenge_bytes);
        let windows_hello_key = KeyCredentialManager::derive_prf(&challenge).await.unwrap();
        let user_key =
            SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(key.to_vec())).unwrap();
        let legacy =
            WindowsHelloKeychainEntryV1::seal(challenge, &windows_hello_key, &user_key).unwrap();
        desktop_core::password::set_password(
            KEYCHAIN_SERVICE_NAME,
            &user_id,
            &serde_json::to_string(&legacy).unwrap(),
        )
        .await
        .unwrap();

        println!("Unlocking user (should decrypt legacy entry and migrate)");
        let key_after_unlock = windows_hello_lock_system
            .unlock(&user_id, Vec::new())
            .await
            .unwrap();
        assert_eq!(key_after_unlock, key);

        // The entry should now be stored in the envelope (V2) format.
        let migrated = keychain::get_entry(&user_id).await.unwrap();
        assert!(matches!(migrated, WindowsHelloKeychainEntry::V2(_)));

        windows_hello_lock_system.unenroll(&user_id).await.unwrap();
    }
}
