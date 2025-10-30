use std::ptr::NonNull;

use super::crypto::MemoryEncryptionKey;
use super::crypto::KEY_SIZE;
use super::SecureKeyContainer;

/// A SecureKeyContainer that uses mlock to prevent the memory from being swapped to disk.
/// This does not provide as strong protections as other methods, but is always supported.
pub(super) struct MlockSecureKeyContainer {
    ptr: NonNull<[u8]>,
}
// SAFETY: The pointers in this struct are allocated by `malloc_sized`, and we have full ownership.
// They are never exposed outside or cloned, and are cleaned up by drop.
unsafe impl Send for MlockSecureKeyContainer {}
// SAFETY: The container is non-mutable and thus safe to share between threads.
unsafe impl Sync for MlockSecureKeyContainer {}

impl SecureKeyContainer for MlockSecureKeyContainer {
    fn as_key(&self) -> MemoryEncryptionKey {
        MemoryEncryptionKey::from(
            &unsafe { self.ptr.as_ref() }
                .try_into()
                .expect("slice should be KEY_SIZE"),
        )
    }
    fn from_key(key: MemoryEncryptionKey) -> Self {
        let mut ptr: NonNull<[u8]> =
            unsafe { memsec::malloc_sized(KEY_SIZE).expect("malloc_sized should work") };
        unsafe {
            std::ptr::copy_nonoverlapping(
                key.as_ref().as_ptr(),
                ptr.as_mut().as_mut_ptr(),
                KEY_SIZE,
            );
        }
        MlockSecureKeyContainer { ptr }
    }

    fn is_supported() -> bool {
        true
    }
}

impl Drop for MlockSecureKeyContainer {
    fn drop(&mut self) {
        unsafe {
            memsec::free(self.ptr);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multiple_keys() {
        let key1 = MemoryEncryptionKey::new();
        let key2 = MemoryEncryptionKey::new();
        let container1 = MlockSecureKeyContainer::from_key(key1);
        let container2 = MlockSecureKeyContainer::from_key(key2);

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
        assert!(MlockSecureKeyContainer::is_supported());
    }
}
