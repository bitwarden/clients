//! This file implements Windows-Hello based biometric unlock.
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

use std::{
    collections::HashMap,
    sync::{atomic::AtomicBool, Arc},
    time::{Duration, Instant},
};

mod encryption;

use anyhow::{anyhow, Result};
use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey};
use desktop_core::password::{self, PASSWORD_NOT_FOUND};
use secure_memory::*;
use tokio::sync::Mutex;
use tracing::{debug, warn};
use windows::{
    core::{factory, h, Interface, HSTRING},
    Security::{
        Credentials::{
            KeyCredentialCreationOption, KeyCredentialManager, KeyCredentialStatus,
            UI::{
                UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
            },
        },
        Cryptography::CryptographicBuffer,
    },
    Storage::Streams::IBuffer,
    Win32::{
        System::WinRT::{IBufferByteAccess, IUserConsentVerifierInterop},
        UI::WindowsAndMessaging::GetForegroundWindow,
    },
};
use windows_future::IAsyncOperation;

use self::encryption::{
    Challenge, WindowsHelloKeychainEntry, WindowsHelloKeychainEntryV2, WindowsHelloPrf,
};
use super::windows_focus::{focus_security_prompt, restore_focus};

const AUTHENTICATE_AVAILABLE_CACHE_TTL: Duration = Duration::from_secs(30);
const KEYCHAIN_SERVICE_NAME: &str = "BitwardenBiometricsV2";
const CREDENTIAL_NAME: &HSTRING = h!("BitwardenBiometricsV2");

/// The Windows OS implementation of the biometric trait.
pub struct BiometricLockSystem {
    // The userkeys that are held in memory MUST be protected from memory dumping attacks, to
    // ensure locked vaults cannot be unlocked
    secure_memory: Arc<Mutex<secure_memory::dpapi::DpapiSecretKVStore>>,
    // Cache whether a keychain entry exists for a user to avoid excessive keychain lookups
    // (Windows audit event 5379). Key = user_id, Value = true (entry exists) or false (no
    // entry). If user_id not in map = cache miss.
    // Updated on enroll (true) and unenroll (false).
    has_keychain_entry_cache: Arc<Mutex<HashMap<String, bool>>>,
    // Cache the result of authenticate_available() with a TTL to avoid
    // repeated NGC vault reads (Windows audit event 5382).
    authenticate_available_cache: Arc<Mutex<Option<(bool, Instant)>>>,
}

impl BiometricLockSystem {
    /// Creates a new instance of the Windows biometric lock system.
    pub fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(secure_memory::dpapi::DpapiSecretKVStore::new())),
            has_keychain_entry_cache: Arc::new(Mutex::new(HashMap::new())),
            authenticate_available_cache: Arc::new(Mutex::new(None)),
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
        windows_hello_authenticate(message).await
    }

    async fn authenticate_available(&self) -> Result<bool> {
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

        *self.authenticate_available_cache.lock().await = Some((result, std::time::Instant::now()));
        Ok(result)
    }

    async fn unenroll(&self, user_id: &String) -> Result<()> {
        self.secure_memory.lock().await.remove(user_id);
        delete_keychain_entry(user_id).await?;

        self.has_keychain_entry_cache
            .lock()
            .await
            .insert(user_id.clone(), false);

        Ok(())
    }

    async fn enroll_persistent(&self, user_id: &str, key: &[u8]) -> Result<()> {
        // Enrollment works by first generating a random challenge unique to the user / enrollment.
        // Then, with the challenge and a Windows-Hello prompt, the "windows hello prf" is derived.
        // The windows hello prf is used as the high-entropy secret to seal the user key into a
        // `SecretProtectedKeyEnvelope`. The bundle of challenge and serialized envelope are stored
        // to the keychain.

        let user_key = SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(key.to_vec()))
            .map_err(|e| anyhow!("Failed to parse user key: {e}"))?;

        // Each enrollment (per user) has a unique challenge, so that the windows-hello prf is
        // unique
        let challenge = Challenge::make();

        // This prf is unique to the challenge
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge).await?;
        let entry = WindowsHelloKeychainEntryV2::seal(challenge, &windows_hello_key, &user_key)?;

        set_keychain_entry(user_id, &entry).await?;

        self.has_keychain_entry_cache
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
        // Allow restoring focus to the previous window (browser)
        let previous_active_window = super::windows_focus::get_active_window();
        let _focus_scopeguard = scopeguard::guard((), |_| {
            if let Some(hwnd) = previous_active_window {
                debug!("Restoring focus to previous window");
                restore_focus(hwnd.0);
            }
        });

        // If the key is held ephemerally, always use UV API. Only use signing API if the key is not
        // held ephemerally but the keychain holds it persistently.
        if self.secure_memory.lock().await.has(user_id) {
            if windows_hello_authenticate("Unlock your vault".to_string()).await? {
                self.secure_memory
                    .lock()
                    .await
                    .get(user_id)?
                    .ok_or_else(|| anyhow!("No key found for user"))
            } else {
                Err(anyhow!("Authentication failed"))
            }
        } else {
            // Re-derive the PRF via Windows Hello and unseal the persisted user key. Legacy (V1)
            // entries are migrated on unlock to the V2 format.
            let user_key = match get_keychain_entry(user_id).await? {
                WindowsHelloKeychainEntry::V2(entry) => {
                    let windows_hello_key =
                        windows_hello_authenticate_with_crypto(&entry.challenge).await?;
                    entry.unseal(&windows_hello_key)?
                }
                WindowsHelloKeychainEntry::V1(entry) => {
                    let windows_hello_key =
                        windows_hello_authenticate_with_crypto(&entry.challenge).await?;
                    let user_key = entry.unseal(&windows_hello_key)?;

                    // Lazily migrate the legacy entry to the envelope format. The same challenge is
                    // reused, so no additional Windows Hello prompt is required. A migration
                    // failure must not fail the unlock - the key was already
                    // recovered above.
                    match WindowsHelloKeychainEntryV2::seal(
                        entry.challenge,
                        &windows_hello_key,
                        &user_key,
                    ) {
                        Ok(migrated_entry) => {
                            if let Err(e) = set_keychain_entry(user_id, &migrated_entry).await {
                                warn!(
                                    "[Windows Hello] Failed to persist migrated keychain entry: {e}"
                                );
                            }
                        }
                        Err(e) => {
                            warn!("[Windows Hello] Failed to re-seal keychain entry during migration: {e}");
                        }
                    }

                    user_key
                }
            };

            let decrypted_key = user_key.to_encoded().to_vec();
            // The first unlock already sets the key for subsequent unlocks. The key may again be
            // set externally after unlock finishes.
            self.secure_memory
                .lock()
                .await
                .put(user_id.to_string(), &decrypted_key);
            Ok(decrypted_key)
        }
    }

    async fn unlock_available(&self, user_id: &String) -> Result<bool> {
        let has_key = self.secure_memory.lock().await.has(user_id)
            || self.has_persistent(user_id).await.unwrap_or(false);
        Ok(has_key && self.authenticate_available().await.unwrap_or(false))
    }

    async fn has_persistent(&self, user_id: &str) -> Result<bool> {
        // Check if we have a cached value for this user (either true or false)
        let mut cache = self.has_keychain_entry_cache.lock().await;
        if let Some(&has_entry) = cache.get(user_id) {
            return Ok(has_entry);
        }

        // Cache miss: check keychain and cache the result for this user
        let has_entry = has_keychain_entry(user_id).await.unwrap_or(false);
        cache.insert(user_id.to_string(), has_entry);
        Ok(has_entry)
    }
}

/// Get a yes/no authorization without any cryptographic backing.
/// This API has better focusing behavior
async fn windows_hello_authenticate(message: String) -> Result<bool> {
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

/// Derive the [`WindowsHelloPrf`] from the Windows Hello signature.
///
/// This works by signing the challenge with the Windows Hello protected key store. The signed
/// challenge is then hashed into a high-entropy PRF that seals/unseals the Windows Hello protected
/// keys.
///
/// Windows will only sign the challenge if the user has successfully authenticated with Windows,
/// ensuring user presence.
///
/// Note: This API has inconsistent focusing behavior when called from another window
async fn windows_hello_authenticate_with_crypto(challenge: &Challenge) -> Result<WindowsHelloPrf> {
    debug!("[Windows Hello] Authenticating to sign challenge");

    // Ugly hack: We need to focus the window via window focusing APIs until Microsoft releases a
    // new API. This is unreliable, and if it does not work, the operation may fail
    let stop_focusing = Arc::new(AtomicBool::new(false));
    let stop_focusing_clone = stop_focusing.clone();
    let _ = std::thread::spawn(move || loop {
        if !stop_focusing_clone.load(std::sync::atomic::Ordering::Relaxed) {
            focus_security_prompt();
            std::thread::sleep(std::time::Duration::from_millis(500));
        } else {
            break;
        }
    });
    // Only stop focusing once this function exits. The focus MUST run both during the initial
    // creation with RequestCreateAsync, and also with the subsequent use with RequestSignAsync.
    let _guard = scopeguard::guard((), |_| {
        stop_focusing.store(true, std::sync::atomic::Ordering::Relaxed);
    });

    // First create or replace the Bitwarden Biometrics signing key
    let credential = {
        let key_credential_creation_result = KeyCredentialManager::RequestCreateAsync(
            CREDENTIAL_NAME,
            KeyCredentialCreationOption::FailIfExists,
        )?
        .await?;
        match key_credential_creation_result.Status()? {
            KeyCredentialStatus::CredentialAlreadyExists => {
                KeyCredentialManager::OpenAsync(CREDENTIAL_NAME)?.await?
            }
            KeyCredentialStatus::Success => key_credential_creation_result,
            _ => return Err(anyhow!("Failed to create key credential")),
        }
    }
    .Credential()?;

    let signature = {
        let sign_operation = credential.RequestSignAsync(
            &CryptographicBuffer::CreateFromByteArray(challenge.as_bytes().as_slice())?,
        )?;

        // We need to drop the credential here to avoid holding it across an await point.
        drop(credential);
        sign_operation.await?
    };

    if signature.Status()? != KeyCredentialStatus::Success {
        return Err(anyhow!("Failed to sign data"));
    }

    let mut signature_buffer = signature.Result()?;
    let signature_value = unsafe { as_mut_bytes(&mut signature_buffer)? };

    Ok(WindowsHelloPrf::derive_from_signature(signature_value))
}

async fn set_keychain_entry(user_id: &str, entry: &WindowsHelloKeychainEntryV2) -> Result<()> {
    password::set_password(
        KEYCHAIN_SERVICE_NAME,
        user_id,
        &serde_json::to_string(entry)?,
    )
    .await
}

async fn get_keychain_entry(user_id: &str) -> Result<WindowsHelloKeychainEntry> {
    serde_json::from_str(&password::get_password(KEYCHAIN_SERVICE_NAME, user_id).await?)
        .map_err(|e| anyhow!(e))
}

async fn delete_keychain_entry(user_id: &str) -> Result<()> {
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

async fn has_keychain_entry(user_id: &str) -> Result<bool> {
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

unsafe fn as_mut_bytes(buffer: &mut IBuffer) -> Result<&mut [u8]> {
    let interop = buffer.cast::<IBufferByteAccess>()?;

    unsafe {
        let data = interop.Buffer()?;
        Ok(std::slice::from_raw_parts_mut(
            data,
            buffer.Length()? as usize,
        ))
    }
}

#[cfg(test)]
#[allow(clippy::print_stdout)]
mod tests {
    use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey};
    use rand_core::Rng;

    use super::{
        encryption::{
            Challenge, WindowsHelloKeychainEntry, WindowsHelloKeychainEntryV1, CHALLENGE_LENGTH,
            PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH,
        },
        get_keychain_entry, has_keychain_entry, windows_hello_authenticate,
        windows_hello_authenticate_with_crypto, BiometricLockSystem, KEYCHAIN_SERVICE_NAME,
    };
    use crate::BiometricTrait;

    #[tokio::test]
    async fn test_has_keychain_entry_no_entry() {
        let user_id = "test_user";
        let has_entry = has_keychain_entry(user_id).await.unwrap();
        assert!(!has_entry);
    }

    // Note: These tests are ignored because they require manual intervention to run

    #[tokio::test]
    #[ignore]
    async fn test_windows_hello_authenticate_with_crypto_manual() {
        let challenge = Challenge::from_bytes([0u8; CHALLENGE_LENGTH]);
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge)
            .await
            .unwrap();
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
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge)
            .await
            .unwrap();
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
        let migrated = get_keychain_entry(&user_id).await.unwrap();
        assert!(matches!(migrated, WindowsHelloKeychainEntry::V2(_)));

        windows_hello_lock_system.unenroll(&user_id).await.unwrap();
    }
}
