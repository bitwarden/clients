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

use aes::cipher::KeyInit;
use anyhow::{anyhow, Result};
use bitwarden_crypto::{
    key_slot_ids,
    safe::{
        HighEntropySecret, HighEntropySecretSource, SecretProtectedKeyEnvelope,
        SecretProtectedKeyEnvelopeNamespace,
    },
    BitwardenLegacyKeyBytes, KeyStore, SymmetricCryptoKey,
};
use bitwarden_sensitive_value::{Sensitive, SensitiveSlice};
use chacha20poly1305::{aead::Aead, XChaCha20Poly1305, XNonce};
use sha2::{Digest, Sha256};
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

use super::windows_focus::{focus_security_prompt, restore_focus};
use crate::{
    password::{self, PASSWORD_NOT_FOUND},
    secure_memory::*,
};

const AUTHENTICATE_AVAILABLE_CACHE_TTL: Duration = Duration::from_secs(30);
const KEYCHAIN_SERVICE_NAME: &str = "BitwardenBiometricsV2";
const CREDENTIAL_NAME: &HSTRING = h!("BitwardenBiometricsV2");
const CHALLENGE_LENGTH: usize = 16;
const XCHACHA20POLY1305_NONCE_LENGTH: usize = 24;
const XCHACHA20POLY1305_KEY_LENGTH: usize = 32;

/// Content-layer namespace used when sealing/unsealing the user key with the
/// [`SecretProtectedKeyEnvelope`]. Provides cryptographic domain separation from other envelope
/// consumers.
const BIOMETRIC_NAMESPACE: SecretProtectedKeyEnvelopeNamespace =
    SecretProtectedKeyEnvelopeNamespace::DesktopBiometricUnlock;

// A minimal key id set so the user key can transit the `bitwarden-crypto` key store while it is
// sealed/unsealed. The biometric module only ever holds a single, context-local symmetric key, so
// the private/signing slot enums are present solely to satisfy the `KeySlotIds` trait. The macro
// injects `use bitwarden_crypto::LocalId;`.
key_slot_ids! {
    #[symmetric]
    pub enum BiometricSymmetricKey {
        #[local]
        Local(LocalId),
    }
    #[private]
    pub enum BiometricPrivateKey {
        #[local]
        Local(LocalId),
    }
    #[signing]
    pub enum BiometricSigningKey {
        #[local]
        Local(LocalId),
    }
    pub BiometricIds => BiometricSymmetricKey, BiometricPrivateKey, BiometricSigningKey;
}

/// Wraps the Windows Hello-derived key so it can be used as a [`HighEntropySecret`]. The key is a
/// SHA-256 digest of a Windows Hello signature, which is an approved high-entropy source (a PRF
/// derived from Windows Hello biometrics).
struct WindowsHelloSecret([u8; XCHACHA20POLY1305_KEY_LENGTH]);

impl HighEntropySecretSource for WindowsHelloSecret {
    fn provide_high_entropy_bytes(&self) -> SensitiveSlice<'_> {
        Sensitive::from(self.0.as_slice())
    }
}

/// Legacy keychain entry: the user key was wrapped directly with XChaCha20Poly1305 using the
/// Windows Hello-derived key. Retained for decrypting (and migrating) pre-existing enrollments.
#[derive(serde::Serialize, serde::Deserialize)]
struct WindowsHelloKeychainEntry {
    nonce: [u8; XCHACHA20POLY1305_NONCE_LENGTH],
    challenge: [u8; CHALLENGE_LENGTH],
    wrapped_key: Vec<u8>,
}

/// Current keychain entry: the user key is sealed in a [`SecretProtectedKeyEnvelope`]. The
/// `challenge` is still stored because it is the input used to re-derive the Windows Hello secret.
#[derive(serde::Serialize, serde::Deserialize)]
struct WindowsHelloKeychainEntryV2 {
    challenge: [u8; CHALLENGE_LENGTH],
    /// Serialized [`SecretProtectedKeyEnvelope`].
    envelope: Vec<u8>,
}

/// Either keychain entry format. The two formats have disjoint required fields (`envelope` vs
/// `nonce` + `wrapped_key`), so untagged deserialization unambiguously routes a stored entry to the
/// correct variant.
#[derive(serde::Deserialize)]
#[serde(untagged)]
enum WindowsHelloKeychainEntryAny {
    V2(WindowsHelloKeychainEntryV2),
    Legacy(WindowsHelloKeychainEntry),
}

/// The Windows OS implementation of the biometric trait.
pub struct BiometricLockSystem {
    // The userkeys that are held in memory MUST be protected from memory dumping attacks, to
    // ensure locked vaults cannot be unlocked
    secure_memory: Arc<Mutex<crate::secure_memory::dpapi::DpapiSecretKVStore>>,
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
            secure_memory: Arc::new(Mutex::new(
                crate::secure_memory::dpapi::DpapiSecretKVStore::new(),
            )),
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
        // Then, with the challenge and a Windows-Hello prompt, the "windows hello key" is
        // derived. The windows hello key is used as the high-entropy secret to seal the user key
        // into a `SecretProtectedKeyEnvelope`. The bundle of challenge and serialized envelope are
        // stored to the keychain.

        // Each enrollment (per user) has a unique challenge, so that the windows-hello key is
        // unique
        let challenge: [u8; CHALLENGE_LENGTH] = rand::random();

        // This key is unique to the challenge
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge).await?;
        let envelope = seal_user_key(&windows_hello_key, key)?;

        set_keychain_entry(user_id, &WindowsHelloKeychainEntryV2 { challenge, envelope }).await?;

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

        let mut secure_memory = self.secure_memory.lock().await;
        // If the key is held ephemerally, always use UV API. Only use signing API if the key is not
        // held ephemerally but the keychain holds it persistently.
        if secure_memory.has(user_id) {
            if windows_hello_authenticate("Unlock your vault".to_string()).await? {
                secure_memory
                    .get(user_id)?
                    .ok_or_else(|| anyhow!("No key found for user"))
            } else {
                Err(anyhow!("Authentication failed"))
            }
        } else {
            let decrypted_key = match get_keychain_entry(user_id).await? {
                WindowsHelloKeychainEntryAny::V2(entry) => {
                    let windows_hello_key =
                        windows_hello_authenticate_with_crypto(&entry.challenge).await?;
                    unseal_user_key(&windows_hello_key, &entry.envelope)?
                }
                WindowsHelloKeychainEntryAny::Legacy(entry) => {
                    let windows_hello_key =
                        windows_hello_authenticate_with_crypto(&entry.challenge).await?;
                    let decrypted_key =
                        decrypt_data(&windows_hello_key, &entry.wrapped_key, &entry.nonce)?;

                    // Lazily migrate the legacy entry to the envelope format. The same challenge is
                    // reused, so no additional Windows Hello prompt is required. A migration failure
                    // must not fail the unlock - the key was already recovered above.
                    match seal_user_key(&windows_hello_key, &decrypted_key) {
                        Ok(envelope) => {
                            if let Err(e) = set_keychain_entry(
                                user_id,
                                &WindowsHelloKeychainEntryV2 {
                                    challenge: entry.challenge,
                                    envelope,
                                },
                            )
                            .await
                            {
                                warn!("[Windows Hello] Failed to persist migrated keychain entry: {e}");
                            }
                        }
                        Err(e) => {
                            warn!("[Windows Hello] Failed to re-seal keychain entry during migration: {e}");
                        }
                    }

                    decrypted_key
                }
            };
            // The first unlock already sets the key for subsequent unlocks. The key may again be
            // set externally after unlock finishes.
            secure_memory.put(user_id.to_string(), &decrypted_key.clone());
            Ok(decrypted_key)
        }
    }

    async fn unlock_available(&self, user_id: &String) -> Result<bool> {
        let secure_memory = self.secure_memory.lock().await;
        let has_key =
            secure_memory.has(user_id) || self.has_persistent(user_id).await.unwrap_or(false);
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

/// Derive the symmetric encryption key from the Windows Hello signature.
///
/// This works by signing a static challenge string with Windows Hello protected key store. The
/// signed challenge is then hashed using SHA-256 and used as the symmetric encryption key for the
/// Windows Hello protected keys.
///
/// Windows will only sign the challenge if the user has successfully authenticated with Windows,
/// ensuring user presence.
///
/// Note: This API has inconsistent focusing behavior when called from another window
async fn windows_hello_authenticate_with_crypto(
    challenge: &[u8; CHALLENGE_LENGTH],
) -> Result<[u8; XCHACHA20POLY1305_KEY_LENGTH]> {
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
            &CryptographicBuffer::CreateFromByteArray(challenge.as_slice())?,
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

    // The signature is deterministic based on the challenge and keychain key. Thus, it can be
    // hashed to a key. It is unclear what entropy this key provides.
    let windows_hello_key = Sha256::digest(signature_value).into();
    Ok(windows_hello_key)
}

async fn set_keychain_entry(user_id: &str, entry: &WindowsHelloKeychainEntryV2) -> Result<()> {
    password::set_password(
        KEYCHAIN_SERVICE_NAME,
        user_id,
        &serde_json::to_string(entry)?,
    )
    .await
}

async fn get_keychain_entry(user_id: &str) -> Result<WindowsHelloKeychainEntryAny> {
    serde_json::from_str(&password::get_password(KEYCHAIN_SERVICE_NAME, user_id).await?)
        .map_err(|e| anyhow!(e))
}

/// Seal the user key into a [`SecretProtectedKeyEnvelope`], using the Windows Hello-derived key as
/// the high-entropy secret. Returns the serialized envelope bytes.
fn seal_user_key(
    windows_hello_key: &[u8; XCHACHA20POLY1305_KEY_LENGTH],
    user_key: &[u8],
) -> Result<Vec<u8>> {
    let secret = HighEntropySecret::from(WindowsHelloSecret(*windows_hello_key));
    let user_key = SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(user_key.to_vec()))
        .map_err(|e| anyhow!("Failed to parse user key: {e}"))?;

    let store = KeyStore::<BiometricIds>::default();
    let mut ctx = store.context_mut();
    let key_id = ctx.add_local_symmetric_key(user_key);
    let envelope = SecretProtectedKeyEnvelope::seal(key_id, &secret, BIOMETRIC_NAMESPACE, &ctx)
        .map_err(|e| anyhow!("Failed to seal user key: {e}"))?;
    Ok((&envelope).into())
}

/// Unseal the user key from a serialized [`SecretProtectedKeyEnvelope`], using the Windows Hello-
/// derived key as the high-entropy secret. Returns the encoded user key bytes.
fn unseal_user_key(
    windows_hello_key: &[u8; XCHACHA20POLY1305_KEY_LENGTH],
    envelope_bytes: &[u8],
) -> Result<Vec<u8>> {
    let secret = HighEntropySecret::from(WindowsHelloSecret(*windows_hello_key));
    let envelope = SecretProtectedKeyEnvelope::try_from(&envelope_bytes.to_vec())
        .map_err(|e| anyhow!("Failed to parse key envelope: {e}"))?;

    let store = KeyStore::<BiometricIds>::default();
    let mut ctx = store.context_mut();
    let key_id = envelope
        .unseal(&secret, BIOMETRIC_NAMESPACE, &mut ctx)
        .map_err(|e| anyhow!("Failed to unseal user key: {e}"))?;
    // The biometric module's contract is to return the raw user key bytes across the NAPI boundary,
    // so the key material must be exported from the key store here.
    #[allow(deprecated)]
    let user_key = ctx
        .dangerous_get_symmetric_key(key_id)
        .map_err(|e| anyhow!("Failed to read unsealed user key: {e}"))?;
    Ok(user_key.to_encoded().to_vec())
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

/// Encrypt data with XChaCha20Poly1305. Only used by tests to produce legacy keychain entries; the
/// production code path uses [`seal_user_key`] / the [`SecretProtectedKeyEnvelope`].
#[cfg(test)]
fn encrypt_data(
    key: &[u8; XCHACHA20POLY1305_KEY_LENGTH],
    plaintext: &[u8],
) -> Result<(Vec<u8>, [u8; XCHACHA20POLY1305_NONCE_LENGTH])> {
    let cipher = XChaCha20Poly1305::new(key.into());
    let mut nonce = [0u8; XCHACHA20POLY1305_NONCE_LENGTH];
    rand::fill(&mut nonce);
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(&nonce), plaintext)
        .map_err(|e| anyhow!(e))?;
    Ok((ciphertext, nonce))
}

/// Decrypt data with XChaCha20Poly1305
fn decrypt_data(
    key: &[u8; XCHACHA20POLY1305_KEY_LENGTH],
    ciphertext: &[u8],
    nonce: &[u8; XCHACHA20POLY1305_NONCE_LENGTH],
) -> Result<Vec<u8>> {
    let cipher = XChaCha20Poly1305::new(key.into());
    let plaintext = cipher
        .decrypt(XNonce::from_slice(nonce), ciphertext)
        .map_err(|e| anyhow!(e))?;
    Ok(plaintext)
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
    use crate::biometric_v2::{
        biometric_v2::{
            decrypt_data, encrypt_data, get_keychain_entry, has_keychain_entry, seal_user_key,
            unseal_user_key, windows_hello_authenticate, windows_hello_authenticate_with_crypto,
            WindowsHelloKeychainEntry, WindowsHelloKeychainEntryAny, WindowsHelloKeychainEntryV2,
            CHALLENGE_LENGTH, KEYCHAIN_SERVICE_NAME, XCHACHA20POLY1305_KEY_LENGTH,
            XCHACHA20POLY1305_NONCE_LENGTH,
        },
        BiometricLockSystem, BiometricTrait,
    };

    #[test]
    fn test_encrypt_decrypt() {
        let key = [0u8; 32];
        let plaintext = b"Test data";
        let (ciphertext, nonce) = encrypt_data(&key, plaintext).unwrap();
        let decrypted = decrypt_data(&key, &ciphertext, &nonce).unwrap();
        assert_eq!(plaintext.to_vec(), decrypted);
    }

    #[test]
    fn test_seal_unseal_roundtrip() {
        let windows_hello_key = [42u8; XCHACHA20POLY1305_KEY_LENGTH];

        // 32-byte (AES-CBC) and 64-byte (AES-CBC-HMAC) user keys are both valid encoded
        // `SymmetricCryptoKey`s, matching the bytes that cross the NAPI boundary.
        for user_key in [vec![7u8; 32], vec![9u8; 64]] {
            let envelope = seal_user_key(&windows_hello_key, &user_key).unwrap();
            let unsealed = unseal_user_key(&windows_hello_key, &envelope).unwrap();
            assert_eq!(unsealed, user_key);
        }
    }

    #[test]
    fn test_unseal_with_wrong_secret_fails() {
        let user_key = vec![9u8; 64];
        let envelope = seal_user_key(&[42u8; XCHACHA20POLY1305_KEY_LENGTH], &user_key).unwrap();
        // A different Windows Hello key must not unseal the envelope.
        assert!(unseal_user_key(&[7u8; XCHACHA20POLY1305_KEY_LENGTH], &envelope).is_err());
    }

    #[test]
    fn test_keychain_entry_format_detection() {
        let legacy = WindowsHelloKeychainEntry {
            nonce: [1u8; XCHACHA20POLY1305_NONCE_LENGTH],
            challenge: [2u8; CHALLENGE_LENGTH],
            wrapped_key: vec![3u8; 16],
        };
        let legacy_json = serde_json::to_string(&legacy).unwrap();
        assert!(matches!(
            serde_json::from_str::<WindowsHelloKeychainEntryAny>(&legacy_json).unwrap(),
            WindowsHelloKeychainEntryAny::Legacy(_)
        ));

        let v2 = WindowsHelloKeychainEntryV2 {
            challenge: [2u8; CHALLENGE_LENGTH],
            envelope: vec![4u8; 32],
        };
        let v2_json = serde_json::to_string(&v2).unwrap();
        assert!(matches!(
            serde_json::from_str::<WindowsHelloKeychainEntryAny>(&v2_json).unwrap(),
            WindowsHelloKeychainEntryAny::V2(_)
        ));
    }

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
        let challenge = [0u8; CHALLENGE_LENGTH];
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge)
            .await
            .unwrap();
        println!(
            "Windows hello key {:?} for challenge {:?}",
            windows_hello_key, challenge
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
        let mut key = [0u8; XCHACHA20POLY1305_KEY_LENGTH];
        rand::fill(&mut key);

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
        let mut key = [0u8; XCHACHA20POLY1305_KEY_LENGTH];
        rand::fill(&mut key);

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
        let mut key = [0u8; XCHACHA20POLY1305_KEY_LENGTH];
        rand::fill(&mut key);

        let windows_hello_lock_system = BiometricLockSystem::new();

        // Write a legacy (pre-envelope) keychain entry directly, simulating a user enrolled with an
        // older build.
        let challenge: [u8; CHALLENGE_LENGTH] = rand::random();
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge)
            .await
            .unwrap();
        let (wrapped_key, nonce) = encrypt_data(&windows_hello_key, &key).unwrap();
        let legacy = WindowsHelloKeychainEntry {
            nonce,
            challenge,
            wrapped_key,
        };
        crate::password::set_password(
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
        assert!(matches!(migrated, WindowsHelloKeychainEntryAny::V2(_)));

        windows_hello_lock_system.unenroll(&user_id).await.unwrap();
    }
}
