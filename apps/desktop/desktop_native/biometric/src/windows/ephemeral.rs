//! Ephemeral (in-memory) Windows Hello unlock path.
//!
//! After first unlock the user key is held in memory (protected by DPAPI) and released again only
//! after a Windows Hello user-verification (UV) prompt. Nothing is persisted; the key is lost when
//! the app exits. See [`super`] for how this composes with the persistent path.

use std::{
    sync::Arc,
    time::{Duration, Instant},
};

use anyhow::{anyhow, Result};
use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey};
use secure_memory::{dpapi::DpapiSecretKVStore, SecureMemoryStore as _};
use tokio::sync::Mutex;
use tracing::debug;
use windows::{
    core::{factory, HSTRING},
    Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    },
    Win32::{
        System::WinRT::IUserConsentVerifierInterop, UI::WindowsAndMessaging::GetForegroundWindow,
    },
};
use windows_future::IAsyncOperation;

const AUTHENTICATE_AVAILABLE_CACHE_TTL: Duration = Duration::from_secs(30);

/// In-memory (DPAPI-protected) key store, released only behind a Windows Hello UV prompt.
pub(super) struct EphemeralWindowsHelloLockSystem {
    // The userkeys that are held in memory MUST be protected from memory dumping attacks, to
    // ensure locked vaults cannot be unlocked
    secure_memory: Arc<Mutex<DpapiSecretKVStore>>,
    // Cache the result of authenticate_available() with a TTL to avoid
    // repeated NGC vault reads (Windows audit event 5382).
    authenticate_available_cache: Arc<Mutex<Option<(bool, Instant)>>>,
}

impl EphemeralWindowsHelloLockSystem {
    pub(super) fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(DpapiSecretKVStore::new())),
            authenticate_available_cache: Arc::new(Mutex::new(None)),
        }
    }

    /// Whether a key is currently held in memory for `user_id`.
    pub(super) async fn has(&self, user_id: &str) -> bool {
        self.secure_memory.lock().await.has(&user_id.to_string())
    }

    /// Store `user_key` in memory for `user_id`, to be released on a later UV-gated unlock.
    pub(super) async fn provide_key(&self, user_id: &str, user_key: &SymmetricCryptoKey) {
        self.secure_memory
            .lock()
            .await
            .put(user_id.to_string(), &user_key.to_encoded().to_vec());
    }

    /// Drop any in-memory key for `user_id`.
    pub(super) async fn remove(&self, user_id: &str) {
        self.secure_memory.lock().await.remove(&user_id.to_string());
    }

    /// Release the in-memory key for `user_id` after a successful Windows Hello UV prompt.
    pub(super) async fn unlock(&self, user_id: &str) -> Result<SymmetricCryptoKey> {
        if windows_hello_authenticate("Unlock your vault".to_string()).await? {
            let encoded = self
                .secure_memory
                .lock()
                .await
                .get(&user_id.to_string())?
                .ok_or_else(|| anyhow!("No key found for user"))?;
            SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(encoded))
                .map_err(|e| anyhow!("Failed to parse user key: {e}"))
        } else {
            Err(anyhow!("Authentication failed"))
        }
    }

    /// Get a yes/no Windows Hello UV decision with the given prompt message.
    pub(super) async fn authenticate(&self, message: String) -> Result<bool> {
        windows_hello_authenticate(message).await
    }

    /// Whether Windows Hello UV is currently available (cached with a TTL).
    pub(super) async fn authenticate_available(&self) -> Result<bool> {
        {
            let cache = self.authenticate_available_cache.lock().await;
            if let Some((cached_result, cached_at)) = *cache {
                // Only use cached value if it was `true` (available).
                // Never cache `false` so that newly connected devices (e.g. YubiKey)
                // are detected on the next poll without delay.
                if cached_result && cached_at.elapsed() < AUTHENTICATE_AVAILABLE_CACHE_TTL {
                    return Ok(true);
                }
            }
        } // Release lock before the async Windows API call

        let result = matches!(
            UserConsentVerifier::CheckAvailabilityAsync()?.await?,
            UserConsentVerifierAvailability::Available
                | UserConsentVerifierAvailability::DeviceBusy
        );

        *self.authenticate_available_cache.lock().await = Some((result, Instant::now()));
        Ok(result)
    }
}

/// Get a yes/no authorization without any cryptographic backing.
/// This API has better focusing behavior
pub(super) async fn windows_hello_authenticate(message: String) -> Result<bool> {
    debug!(
        "[Windows Hello] Authenticating to perform UV with message: {}",
        message
    );

    let userconsent_result: IAsyncOperation<UserConsentVerificationResult> = unsafe {
        // Windows Hello prompt must be in foreground, focused, otherwise the face or fingerprint
        // unlock will not work. We get the current foreground window, which will either be the
        // Bitwarden desktop app or the browser extension.
        let foreground_window = GetForegroundWindow();
        factory::<UserConsentVerifier, IUserConsentVerifierInterop>()?
            .RequestVerificationForWindowAsync(foreground_window, &HSTRING::from(message))?
    };

    match userconsent_result.await? {
        UserConsentVerificationResult::Verified => Ok(true),
        _ => Ok(false),
    }
}
