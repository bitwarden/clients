//! This module provides hardened storage for single cryptographic keys. These are meant for
//! encrypting large amounts of memory. Some platforms restrict how many keys can be protected by
//! their APIs, which necessitates this layer of indirection. This significantly reduces the
//! complexity of each platform specific implementation, since all that's needed is implementing
//! protecting a single fixed sized key instead of protecting many arbitrarily sized secrets. This
//! significantly lowers the effort to maintain each implementation.
//!
//! The implementations include DPAPI on Windows, `keyctl` on Linux, and `memfd_secret` on Linux,
//! and a fallback implementation using mlock.

use tracing::info;

mod crypto;
#[cfg(target_os = "windows")]
mod dpapi;
#[cfg(target_os = "linux")]
mod keyctl;
#[cfg(target_os = "linux")]
mod memfd_secret;
mod mlock;

pub use crypto::EncryptedMemory;

use crate::secure_memory::secure_key::crypto::DecryptionError;

/// An ephemeral key that is protected using a platform mechanism. It is generated on construction
/// freshly, and can be used to encrypt and decrypt segments of memory. Since the key is ephemeral,
/// persistent data cannot be encrypted with this key. On Linux and Windows, in most cases the
/// protection mechanisms prevent memory dumps/debuggers from reading the key.
///
/// Note: This can be circumvented if code can be injected into the process and is only effective in
/// combination with the memory isolation provided in `process_isolation`.
/// - https://github.com/zer1t0/keydump
#[allow(unused)]
pub(crate) struct SecureMemoryEncryptionKey(CrossPlatformSecureKeyContainer);

impl SecureMemoryEncryptionKey {
    pub fn new() -> Self {
        SecureMemoryEncryptionKey(CrossPlatformSecureKeyContainer::from_key(
            crypto::MemoryEncryptionKey::new(),
        ))
    }

    /// Encrypts the provided plaintext using the contained key, returning an EncryptedMemory blob.
    #[allow(unused)]
    pub fn encrypt(&self, plaintext: &[u8]) -> crypto::EncryptedMemory {
        self.0.as_key().encrypt(plaintext)
    }

    /// Decrypts the provided EncryptedMemory blob using the contained key, returning the plaintext.
    /// If the decryption fails, that means the memory was tampered with, and the function panics.
    #[allow(unused)]
    pub fn decrypt(&self, encrypted: &crypto::EncryptedMemory) -> Result<Vec<u8>, DecryptionError> {
        self.0.as_key().decrypt(encrypted)
    }
}

/// A platform specific implementation of a key container that protects a single encryption key
/// from memory attacks.
#[allow(unused)]
trait SecureKeyContainer: Sync + Send {
    /// Returns the key as a byte slice. This slice does not have additional memory protections
    /// applied.
    fn as_key(&self) -> crypto::MemoryEncryptionKey;
    /// Creates a new SecureKeyContainer from the provided key.
    fn from_key(key: crypto::MemoryEncryptionKey) -> Self;
    /// Returns true if this platform supports this secure key container implementation.
    fn is_supported() -> bool;
}

#[allow(unused)]
enum CrossPlatformSecureKeyContainer {
    #[cfg(target_os = "windows")]
    Dpapi(dpapi::DpapiSecureKeyContainer),
    #[cfg(target_os = "linux")]
    Keyctl(keyctl::KeyctlSecureKeyContainer),
    #[cfg(target_os = "linux")]
    MemfdSecret(memfd_secret::MemfdSecretSecureKeyContainer),
    Mlock(mlock::MlockSecureKeyContainer),
}

impl SecureKeyContainer for CrossPlatformSecureKeyContainer {
    fn as_key(&self) -> crypto::MemoryEncryptionKey {
        match self {
            #[cfg(target_os = "windows")]
            CrossPlatformSecureKeyContainer::Dpapi(c) => c.as_key(),
            #[cfg(target_os = "linux")]
            CrossPlatformSecureKeyContainer::Keyctl(c) => c.as_key(),
            #[cfg(target_os = "linux")]
            CrossPlatformSecureKeyContainer::MemfdSecret(c) => c.as_key(),
            CrossPlatformSecureKeyContainer::Mlock(c) => c.as_key(),
        }
    }

    fn from_key(key: crypto::MemoryEncryptionKey) -> Self {
        if let Some(container) = get_env_forced_container() {
            return container;
        }

        #[cfg(target_os = "windows")]
        {
            if dpapi::DpapiSecureKeyContainer::is_supported() {
                info!("Using DPAPI for secure key storage");
                return CrossPlatformSecureKeyContainer::Dpapi(
                    dpapi::DpapiSecureKeyContainer::from_key(key),
                );
            }
        }
        #[cfg(target_os = "linux")]
        {
            // Memfd_secret is slightly better in some cases of the kernel being compromised.
            // Note that keyctl may sometimes not be available in e.g. snap. Memfd_secret is
            // not available on kernels older than 6.5 while keyctl is supported since 2.6.
            //
            // Note: This may prevent the system from hibernating but not sleeping. Hibernate
            // would write the memory to disk, exposing the keys. If this is an issue,
            // the environment variable `SECURE_KEY_CONTAINER_BACKEND` can be used
            // to force the use of keyctl or mlock.
            if memfd_secret::MemfdSecretSecureKeyContainer::is_supported() {
                info!("Using memfd_secret for secure key storage");
                return CrossPlatformSecureKeyContainer::MemfdSecret(
                    memfd_secret::MemfdSecretSecureKeyContainer::from_key(key),
                );
            }
            if keyctl::KeyctlSecureKeyContainer::is_supported() {
                info!("Using keyctl for secure key storage");
                return CrossPlatformSecureKeyContainer::Keyctl(
                    keyctl::KeyctlSecureKeyContainer::from_key(key),
                );
            }
        }

        // Falling back to mlock means that the key is accessible via memory dumping.
        info!("Falling back to mlock for secure key storage");
        CrossPlatformSecureKeyContainer::Mlock(mlock::MlockSecureKeyContainer::from_key(key))
    }

    fn is_supported() -> bool {
        // Mlock is always supported as a fallback.
        true
    }
}

fn get_env_forced_container() -> Option<CrossPlatformSecureKeyContainer> {
    let env_var = std::env::var("SECURE_KEY_CONTAINER_BACKEND");
    match env_var.as_deref() {
        #[cfg(target_os = "windows")]
        Ok("dpapi") => {
            info!("Forcing DPAPI secure key container via environment variable");
            Some(CrossPlatformSecureKeyContainer::Dpapi(
                dpapi::DpapiSecureKeyContainer::from_key(crypto::MemoryEncryptionKey::new()),
            ))
        }
        #[cfg(target_os = "linux")]
        Ok("memfd_secret") => {
            info!("Forcing memfd_secret secure key container via environment variable");
            Some(CrossPlatformSecureKeyContainer::MemfdSecret(
                memfd_secret::MemfdSecretSecureKeyContainer::from_key(
                    crypto::MemoryEncryptionKey::new(),
                ),
            ))
        }
        #[cfg(target_os = "linux")]
        Ok("keyctl") => {
            info!("Forcing keyctl secure key container via environment variable");
            Some(CrossPlatformSecureKeyContainer::Keyctl(
                keyctl::KeyctlSecureKeyContainer::from_key(crypto::MemoryEncryptionKey::new()),
            ))
        }
        Ok("mlock") => {
            info!("Forcing mlock secure key container via environment variable");
            Some(CrossPlatformSecureKeyContainer::Mlock(
                mlock::MlockSecureKeyContainer::from_key(crypto::MemoryEncryptionKey::new()),
            ))
        }
        _ => {
            info!(
                "{} is not a valid secure key container backend, using automatic selection",
                env_var.unwrap_or_default()
            );
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multiple_keys() {
        // Create 20 different keys
        let original_keys: Vec<crypto::MemoryEncryptionKey> = (0..20)
            .map(|_| crypto::MemoryEncryptionKey::new())
            .collect();

        // Store them in secure containers
        let containers: Vec<CrossPlatformSecureKeyContainer> = original_keys
            .iter()
            .map(|key| {
                let key_bytes: &[u8; crypto::KEY_SIZE] = key.as_ref().try_into().unwrap();
                CrossPlatformSecureKeyContainer::from_key(crypto::MemoryEncryptionKey::from(
                    key_bytes,
                ))
            })
            .collect();

        // Read all keys back and validate they match the originals
        for (i, (original_key, container)) in
            original_keys.iter().zip(containers.iter()).enumerate()
        {
            let retrieved_key = container.as_key();
            assert_eq!(
                original_key.as_ref(),
                retrieved_key.as_ref(),
                "Key {} should match after storage and retrieval",
                i
            );
        }

        // Verify all keys are different from each other
        for i in 0..original_keys.len() {
            for j in (i + 1)..original_keys.len() {
                assert_ne!(
                    original_keys[i].as_ref(),
                    original_keys[j].as_ref(),
                    "Keys {} and {} should be different",
                    i,
                    j
                );
            }
        }

        // Read keys back a second time to ensure consistency
        for (i, (original_key, container)) in
            original_keys.iter().zip(containers.iter()).enumerate()
        {
            let retrieved_key_again = container.as_key();
            assert_eq!(
                original_key.as_ref(),
                retrieved_key_again.as_ref(),
                "Key {} should still match on second retrieval",
                i
            );
        }
    }
}
