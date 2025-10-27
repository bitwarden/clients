use std::ptr::NonNull;

use chacha20poly1305::{aead::Aead, Key, KeyInit};
use rand::{rng, Rng};

pub(super) const KEY_SIZE: usize = 32;
pub(super) const NONCE_SIZE: usize = 24;

/// The encryption performed here is xchacha-poly1305. Any tampering with the key or the ciphertexts will result
/// in a decryption failure and panic. The key's memory contents are protected from being swapped to disk
/// via mlock.
pub(super) struct MemoryEncryptionKey(NonNull<[u8]>);

/// An encrypted memory blob that must be decrypted using the same key that it was encrypted with.
pub struct EncryptedMemory {
    nonce: [u8; NONCE_SIZE],
    ciphertext: Vec<u8>,
}

impl MemoryEncryptionKey {
    pub fn new() -> Self {
        let mut key = [0u8; KEY_SIZE];
        rng().fill(&mut key);
        MemoryEncryptionKey::from(&key)
    }

    /// Encrypts the given plaintext using the key.
    #[allow(unused)]
    pub(super) fn encrypt(&self, plaintext: &[u8]) -> EncryptedMemory {
        let cipher = chacha20poly1305::XChaCha20Poly1305::new(Key::from_slice(self.as_ref()));
        let mut nonce = [0u8; NONCE_SIZE];
        rng().fill(&mut nonce);
        let ciphertext = cipher
            .encrypt(chacha20poly1305::XNonce::from_slice(&nonce), plaintext)
            .expect("encryption should not fail");
        EncryptedMemory { nonce, ciphertext }
    }

    /// Decrypts the given encrypted memory using the key. A decryption failure will panic. This is
    /// okay because neither the keys nor ciphertexts should ever fail to decrypt, and doing so
    /// indicates that the process memory was tampered with.
    #[allow(unused)]
    pub(super) fn decrypt(&self, encrypted: &EncryptedMemory) -> Result<Vec<u8>, DecryptionError> {
        let cipher = chacha20poly1305::XChaCha20Poly1305::new(Key::from_slice(self.as_ref()));
        cipher
            .decrypt(
                chacha20poly1305::XNonce::from_slice(&encrypted.nonce),
                encrypted.ciphertext.as_ref(),
            )
            .map_err(|_| DecryptionError::CouldNotDecrypt)
    }
}

impl Drop for MemoryEncryptionKey {
    fn drop(&mut self) {
        unsafe {
            memsec::free(self.0);
        }
    }
}

impl From<&[u8; KEY_SIZE]> for MemoryEncryptionKey {
    fn from(value: &[u8; KEY_SIZE]) -> Self {
        let mut ptr: NonNull<[u8]> =
            unsafe { memsec::malloc_sized(KEY_SIZE).expect("malloc_sized should work") };
        unsafe {
            std::ptr::copy_nonoverlapping(value.as_ptr(), ptr.as_mut().as_mut_ptr(), KEY_SIZE);
        }
        MemoryEncryptionKey(ptr)
    }
}

impl AsRef<[u8]> for MemoryEncryptionKey {
    fn as_ref(&self) -> &[u8] {
        unsafe { self.0.as_ref() }
    }
}

#[derive(Debug)]
pub(crate) enum DecryptionError {
    CouldNotDecrypt,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memory_encryption_key() {
        let key = MemoryEncryptionKey::new();
        let data = b"Hello, world!";
        let encrypted = key.encrypt(data);
        let decrypted = key.decrypt(&encrypted).unwrap();
        assert_eq!(data.as_ref(), decrypted.as_slice());
    }
}
