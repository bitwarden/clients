//! This file implements Windows-Hello based biometric unlock.
//!
//! There are two paths implemented here.
//! The former via UV + ephemerally (but protected) keys. This only works after first unlock.
//! The latter via a signing API, that deterministically signs a challenge, from which a windows hello key is derived. This key
//! is used to encrypt the protected key.
//!
//! # Security
//! The security goal is that a locked vault - a running app - cannot be unlocked when the device (user-space)
//! is compromised in this state.
//!
//! ## UV path
//! When first unlocking the app, the app sends the user-key to this module, which holds it in secure memory,
//! protected by DPAPI. This makes it inaccessible to other processes, unless they compromise the system administrator, or kernel.
//! While the app is running this key is held in memory, even if locked. When unlocking, the app will prompt the user via
//! `windows_hello_authenticate` to get a yes/no decision on whether to release the key to the app.
//! Note: Further process isolation is needed here so that code cannot be injected into the running process, which may
//! circumvent DPAPI.
//!
//! ## Sign path
//! In this scenario, when enrolling, the app sends the user-key to this module, which derives the windows hello key
//! with the Windows Hello prompt. This is done by signing a per-user challenge, which produces a deterministic
//! signature which is hashed to obtain a key. This key is used to encrypt and persist the vault unlock key (user key).
//!
//! Since the keychain can be accessed by all user-space processes, the challenge is known to all userspace processes.
//! Therefore, to circumvent the security measure, the attacker would need to create a fake Windows-Hello prompt, and
//! get the user to confirm it.

use std::sync::{atomic::AtomicBool, Arc};
use tracing::{debug, warn};

use aes::cipher::KeyInit;
use anyhow::{anyhow, Result};
use chacha20poly1305::{aead::Aead, XChaCha20Poly1305, XNonce};
use sha2::{Digest, Sha256};
use tokio::sync::Mutex;
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

const KEYCHAIN_SERVICE_NAME: &str = "BitwardenBiometricsV2";
const CREDENTIAL_NAME: &HSTRING = h!("BitwardenBiometricsV2");
const CHALLENGE_LENGTH: usize = 16;
const XCHACHA20POLY1305_NONCE_LENGTH: usize = 24;
const XCHACHA20POLY1305_KEY_LENGTH: usize = 32;

#[derive(serde::Serialize, serde::Deserialize)]
struct WindowsHelloKeychainEntry {
    nonce: [u8; XCHACHA20POLY1305_NONCE_LENGTH],
    challenge: [u8; CHALLENGE_LENGTH],
    wrapped_key: Vec<u8>,
}

/// The Windows OS implementation of the biometric trait.
pub struct BiometricLockSystem {
    // The userkeys that are held in memory MUST be protected from memory dumping attacks, to ensure
    // locked vaults cannot be unlocked
    secure_memory: Arc<Mutex<crate::secure_memory::dpapi::DpapiSecretKVStore>>,
}

impl BiometricLockSystem {
    pub fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(
                crate::secure_memory::dpapi::DpapiSecretKVStore::new(),
            )),
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
        match UserConsentVerifier::CheckAvailabilityAsync()?.await? {
            UserConsentVerifierAvailability::Available
            | UserConsentVerifierAvailability::DeviceBusy => Ok(true),
            _ => Ok(false),
        }
    }

    async fn unenroll(&self, user_id: &str) -> Result<()> {
        self.secure_memory.lock().await.remove(user_id);
        delete_keychain_entry(user_id).await
    }

    async fn enroll_persistent(&self, user_id: &str, key: &[u8]) -> Result<()> {
        // Enrollment works by first generating a random challenge unique to the user / enrollment. Then,
        // with the challenge and a Windows-Hello prompt, the "windows hello key" is derived. The windows
        // hello key is used to encrypt the key to store with XChaCha20Poly1305. The bundle of nonce,
        // challenge and wrapped-key are stored to the keychain

        // Each enrollment (per user) has a unique challenge, so that the windows-hello key is unique
        let challenge: [u8; CHALLENGE_LENGTH] = rand::random();

        // This key is unique to the challenge
        let windows_hello_key = windows_hello_authenticate_with_crypto(&challenge).await?;
        let (wrapped_key, nonce) = encrypt_data(&windows_hello_key, key)?;

        set_keychain_entry(
            user_id,
            &WindowsHelloKeychainEntry {
                nonce,
                challenge,
                wrapped_key,
            },
        )
        .await
    }

    async fn provide_key(&self, user_id: &str, key: &[u8]) {
        self.secure_memory
            .lock()
            .await
            .put(user_id.to_string(), key);
    }

    async fn unlock(&self, user_id: &str, _hwnd: Vec<u8>) -> Result<Vec<u8>> {
        // Allow restoring focus to the previous window (browser)
        let previous_active_window = super::windows_focus::get_active_window();
        let _focus_scopeguard = scopeguard::guard((), |_| {
            if let Some(hwnd) = previous_active_window {
                debug!("Restoring focus to previous window");
                restore_focus(hwnd.0);
            }
        });

        let mut secure_memory = self.secure_memory.lock().await;
        // If the key is held ephemerally, always use UV API. Only use signing API if the key is not held
        // ephemerally but the keychain holds it persistently.
        if secure_memory.has(user_id) {
            if windows_hello_authenticate("Unlock your vault".to_string()).await? {
                secure_memory
                    .get(user_id)
                    .clone()
                    .ok_or_else(|| anyhow!("No key found for user"))
            } else {
                Err(anyhow!("Authentication failed"))
            }
        } else {
            let keychain_entry = get_keychain_entry(user_id).await?;
            let windows_hello_key =
                windows_hello_authenticate_with_crypto(&keychain_entry.challenge).await?;
            let decrypted_key = decrypt_data(
                &windows_hello_key,
                &keychain_entry.wrapped_key,
                &keychain_entry.nonce,
            )?;
            // The first unlock already sets the key for subsequent unlocks. The key may again be set externally after unlock finishes.
            secure_memory.put(user_id.to_string(), &decrypted_key.clone());
            Ok(decrypted_key)
        }
    }

    async fn unlock_available(&self, user_id: &str) -> Result<bool> {
        let secure_memory = self.secure_memory.lock().await;
        let has_key =
            secure_memory.has(user_id) || has_keychain_entry(user_id).await.unwrap_or(false);
        Ok(has_key && self.authenticate_available().await.unwrap_or(false))
    }

    async fn has_persistent(&self, user_id: &str) -> Result<bool> {
        Ok(get_keychain_entry(user_id).await.is_ok())
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

    // Ugly hack: We need to focus the window via window focusing APIs until Microsoft releases a new API.
    // This is unreliable, and if it does not work, the operation may fail
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
    // Only stop focusing once this function exits. The focus MUST run both during the initial creation
    // with RequestCreateAsync, and also with the subsequent use with RequestSignAsync.
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

    let signature_buffer = signature.Result()?;
    let signature_value = unsafe { as_mut_bytes(&signature_buffer)? };

    // The signature is deterministic based on the challenge and keychain key. Thus, it can be hashed to a key.
    // It is unclear what entropy this key provides.
    let windows_hello_key = Sha256::digest(signature_value).into();
    Ok(windows_hello_key)
}

async fn set_keychain_entry(user_id: &str, entry: &WindowsHelloKeychainEntry) -> Result<()> {
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

/// Encrypt data with XChaCha20Poly1305
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

unsafe fn as_mut_bytes(buffer: &IBuffer) -> Result<&mut [u8]> {
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
mod tests {
    use crate::biometric_v2::{
        biometric_v2::{
            decrypt_data, encrypt_data, has_keychain_entry, windows_hello_authenticate,
            windows_hello_authenticate_with_crypto, CHALLENGE_LENGTH, XCHACHA20POLY1305_KEY_LENGTH,
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
        let user_id = "test_user";
        let mut key = [0u8; XCHACHA20POLY1305_KEY_LENGTH];
        rand::fill(&mut key);

        let windows_hello_lock_system = BiometricLockSystem::new();

        println!("Enrolling user");
        windows_hello_lock_system
            .enroll_persistent(user_id, &key)
            .await
            .unwrap();
        assert!(windows_hello_lock_system
            .has_persistent(user_id)
            .await
            .unwrap());

        println!("Unlocking user");
        let key_after_unlock = windows_hello_lock_system
            .unlock(user_id, Vec::new())
            .await
            .unwrap();
        assert_eq!(key_after_unlock, key);

        println!("Unenrolling user");
        windows_hello_lock_system.unenroll(user_id).await.unwrap();
        assert!(!windows_hello_lock_system
            .has_persistent(user_id)
            .await
            .unwrap());

        println!("Unenrolling user again");

        // This throws PASSWORD_NOT_FOUND but our code should handle that and not throw.
        windows_hello_lock_system.unenroll(user_id).await.unwrap();
        assert!(!windows_hello_lock_system
            .has_persistent(user_id)
            .await
            .unwrap());
    }

    #[tokio::test]
    #[ignore]
    async fn test_enroll_unlock_unenroll() {
        let user_id = "test_user";
        let mut key = [0u8; XCHACHA20POLY1305_KEY_LENGTH];
        rand::fill(&mut key);

        let windows_hello_lock_system = BiometricLockSystem::new();

        println!("Enrolling user");
        windows_hello_lock_system
            .enroll_persistent(user_id, &key)
            .await
            .unwrap();
        assert!(windows_hello_lock_system
            .has_persistent(user_id)
            .await
            .unwrap());

        println!("Unlocking user");
        let key_after_unlock = windows_hello_lock_system
            .unlock(user_id, Vec::new())
            .await
            .unwrap();
        assert_eq!(key_after_unlock, key);

        println!("Unenrolling user");
        windows_hello_lock_system.unenroll(user_id).await.unwrap();
        assert!(!windows_hello_lock_system
            .has_persistent(user_id)
            .await
            .unwrap());
    }
}
