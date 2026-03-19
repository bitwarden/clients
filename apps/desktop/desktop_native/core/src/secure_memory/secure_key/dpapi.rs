use windows::Win32::Security::Cryptography::{
    CryptProtectMemory, CryptUnprotectMemory, CRYPTPROTECTMEMORY_BLOCK_SIZE,
    CRYPTPROTECTMEMORY_SAME_PROCESS,
};

use super::{
    crypto::{MemoryEncryptionKey, KEY_SIZE},
    SecureKeyContainer,
};

/// https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata
/// The DPAPI store encrypts data using the Windows Data Protection API (DPAPI). The key is bound
/// to the current process, and cannot be decrypted by other user-mode processes.
///
/// Note: Admin processes can still decrypt this memory:
/// https://blog.slowerzs.net/posts/cryptdecryptmemory/
pub(super) struct DpapiSecureKeyContainer {
    dpapi_encrypted_key: [u8; KEY_SIZE + CRYPTPROTECTMEMORY_BLOCK_SIZE as usize],
}

// SAFETY: The encrypted data is fully owned by this struct, and not exposed outside or cloned,
// and is disposed on drop of this struct.
unsafe impl Send for DpapiSecureKeyContainer {}
// SAFETY: The container is non-mutable and thus safe to share between threads.
unsafe impl Sync for DpapiSecureKeyContainer {}

impl SecureKeyContainer for DpapiSecureKeyContainer {
    fn as_key(&self) -> MemoryEncryptionKey {
        let mut decrypted_key = self.dpapi_encrypted_key;
        unsafe {
            CryptUnprotectMemory(
                decrypted_key.as_mut_ptr() as *mut core::ffi::c_void,
                decrypted_key.len() as u32,
                CRYPTPROTECTMEMORY_SAME_PROCESS,
            )
        }
        .expect("crypt_unprotect_memory should work");
        let mut key = [0u8; KEY_SIZE];
        key.copy_from_slice(&decrypted_key[..KEY_SIZE]);
        MemoryEncryptionKey::from(&key)
    }

    fn from_key(key: MemoryEncryptionKey) -> Self {
        let mut padded_key = [0u8; KEY_SIZE + CRYPTPROTECTMEMORY_BLOCK_SIZE as usize];
        padded_key[..KEY_SIZE].copy_from_slice(key.as_ref());
        unsafe {
            CryptProtectMemory(
                padded_key.as_mut_ptr() as *mut core::ffi::c_void,
                padded_key.len() as u32,
                CRYPTPROTECTMEMORY_SAME_PROCESS,
            )
        }
        .expect("crypt_protect_memory should work");
        DpapiSecureKeyContainer {
            dpapi_encrypted_key: padded_key,
        }
    }

    fn is_supported() -> bool {
        // DPAPI is supported on all Windows versions that we support.
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multiple_keys() {
        let key1 = MemoryEncryptionKey::new();
        let key2 = MemoryEncryptionKey::new();
        let container1 = DpapiSecureKeyContainer::from_key(key1);
        let container2 = DpapiSecureKeyContainer::from_key(key2);

        // Capture at time 1
        let data_1_1 = container1.as_key();
        let data_2_1 = container2.as_key();
        // Capture at time 2
        let data_1_2 = container1.as_key();
        let data_2_2 = container2.as_key();

        // Same keys should be equal
        assert_eq!(data_1_1.as_ref(), data_1_2.as_ref());
        assert_eq!(data_2_1.as_ref(), data_2_2.as_ref());

        // Different keys should be different
        assert_ne!(data_1_1.as_ref(), data_2_1.as_ref());
        assert_ne!(data_1_2.as_ref(), data_2_2.as_ref());
    }

    #[test]
    fn test_is_supported() {
        assert!(DpapiSecureKeyContainer::is_supported());
    }
}
