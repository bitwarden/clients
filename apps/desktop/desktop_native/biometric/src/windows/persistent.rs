//! Persistent Windows Hello unlock path.
//!
//! The user key is sealed with a Windows Hello-derived PRF and stored in the OS keychain, so it
//! survives app restarts. Each unlock re-derives the PRF via a Windows Hello signing prompt. See
//! [`super`] for how this composes with the ephemeral path.

use std::{collections::HashMap, sync::Arc};

use anyhow::Result;
use bitwarden_crypto::SymmetricCryptoKey;
use tokio::sync::Mutex;

use super::{
    encryption::Challenge,
    keychain::{self, WindowsHelloKeychainEntry},
    keycredentialmanager::KeyCredentialManager,
};

/// Keychain-backed Windows Hello unlock, guarded by a Windows Hello signing prompt.
pub(super) struct PersistentWindowsHelloSystem {
    // Cache whether a keychain entry exists for a user to avoid excessive keychain lookups
    // (Windows audit event 5379). Key = user_id, Value = true (entry exists) or false (no
    // entry). If user_id not in map = cache miss.
    // Updated on enroll (true) and unenroll (false).
    has_keychain_entry_cache: Arc<Mutex<HashMap<String, bool>>>,
}

impl PersistentWindowsHelloSystem {
    pub(super) fn new() -> Self {
        Self {
            has_keychain_entry_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Seal `user_key` with a fresh Windows Hello-derived PRF and persist it to the keychain.
    pub(super) async fn enroll(&self, user_id: &str, user_key: &SymmetricCryptoKey) -> Result<()> {
        // Enrollment works by first generating a random challenge unique to the user / enrollment.
        // Then, with the challenge and a Windows-Hello prompt, the "windows hello prf" is
        // derived. The windows hello prf is used as the key to wrap the user key. The bundle of
        // nonce, challenge and wrapped key are stored to the keychain.

        // Each enrollment (per user) has a unique challenge, so that the windows-hello prf is
        // unique
        let challenge = Challenge::make();

        // The PRF is unique per-challenge & windows user, but not bound to the application. If
        // another process reads the challenge and calls the credential manager, it can
        // derive the same PRF.
        let windows_hello_prf = KeyCredentialManager::derive_prf(&challenge).await?;
        let entry = WindowsHelloKeychainEntry::seal(challenge, &windows_hello_prf, user_key)?;

        keychain::set_entry(user_id, &entry).await?;

        self.has_keychain_entry_cache
            .lock()
            .await
            .insert(user_id.to_string(), true);
        Ok(())
    }

    /// Unlock the persisted user key for `user_id` via a Windows Hello prompt.
    pub(super) async fn unlock(&self, user_id: &str) -> Result<SymmetricCryptoKey> {
        // Re-derive the PRF via Windows Hello and unseal the persisted user key.
        let entry = keychain::get_entry(user_id).await?;
        let windows_hello_prf = KeyCredentialManager::derive_prf(&entry.challenge).await?;
        entry.unseal(&windows_hello_prf)
    }

    /// Whether a persisted keychain entry exists for `user_id` (cached).
    pub(super) async fn has(&self, user_id: &str) -> Result<bool> {
        // Check if we have a cached value for this user (either true or false)
        let mut cache = self.has_keychain_entry_cache.lock().await;
        if let Some(&has_entry) = cache.get(user_id) {
            return Ok(has_entry);
        }

        // Cache miss: check keychain and cache the result for this user
        let has_entry = keychain::has_entry(user_id).await.unwrap_or(false);
        cache.insert(user_id.to_string(), has_entry);
        Ok(has_entry)
    }

    /// Delete the persisted keychain entry for `user_id`.
    pub(super) async fn unenroll(&self, user_id: &str) -> Result<()> {
        keychain::delete_entry(user_id).await?;

        self.has_keychain_entry_cache
            .lock()
            .await
            .insert(user_id.to_string(), false);
        Ok(())
    }
}
