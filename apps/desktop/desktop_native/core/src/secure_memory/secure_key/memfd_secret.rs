use std::{ptr::NonNull, sync::LazyLock};

use super::crypto::MemoryEncryptionKey;
use super::crypto::KEY_SIZE;
use super::SecureKeyContainer;

/// https://man.archlinux.org/man/memfd_secret.2.en
/// The memfd_secret store protects the data using the `memfd_secret` syscall. The
/// data is inaccessible to other user-mode processes, and even to root in most cases.
/// If arbitrary data can be executed in the kernel, the data can still be retrieved:
/// https://github.com/JonathonReinhart/nosecmem
pub(super) struct MemfdSecretSecureKeyContainer {
    ptr: NonNull<[u8]>,
}
// SAFETY: The pointers in this struct are allocated by `memfd_secret`, and we have full ownership.
// They are never exposed outside or cloned, and are cleaned up by drop.
unsafe impl Send for MemfdSecretSecureKeyContainer {}
// SAFETY: The container is non-mutable and thus safe to share between threads. Further, memfd-secret
// is accessible across threads within the same process bound.
unsafe impl Sync for MemfdSecretSecureKeyContainer {}

impl SecureKeyContainer for MemfdSecretSecureKeyContainer {
    fn as_key(&self) -> MemoryEncryptionKey {
        MemoryEncryptionKey::from(
            &unsafe { self.ptr.as_ref() }
                .try_into()
                .expect("slice should be KEY_SIZE"),
        )
    }
    fn from_key(key: MemoryEncryptionKey) -> Self {
        let mut ptr: NonNull<[u8]> = unsafe {
            memsec::memfd_secret_sized(KEY_SIZE).expect("memfd_secret_sized should work")
        };
        unsafe {
            std::ptr::copy_nonoverlapping(
                key.as_ref().as_ptr(),
                ptr.as_mut().as_mut_ptr(),
                KEY_SIZE,
            );
        }
        MemfdSecretSecureKeyContainer { ptr }
    }

    /// Note, `memfd_secret` is only available since Linux 6.5, so fallbacks are needed.
    fn is_supported() -> bool {
        // To test if memfd_secret is supported, we try to allocate a 1 byte and see if that
        // succeeds.
        static IS_SUPPORTED: LazyLock<bool> = LazyLock::new(|| {
            let Some(ptr): Option<NonNull<[u8]>> = (unsafe { memsec::memfd_secret_sized(1) })
            else {
                return false;
            };

            // Check that the pointer is readable and writable
            let result = unsafe {
                let ptr = ptr.as_ptr() as *mut u8;
                *ptr = 30;
                *ptr += 107;
                *ptr == 137
            };

            unsafe { memsec::free_memfd_secret(ptr) };
            result
        });
        *IS_SUPPORTED
    }
}

impl Drop for MemfdSecretSecureKeyContainer {
    fn drop(&mut self) {
        unsafe {
            memsec::free_memfd_secret(self.ptr);
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
        let container1 = MemfdSecretSecureKeyContainer::from_key(key1);
        let container2 = MemfdSecretSecureKeyContainer::from_key(key2);

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
        assert!(MemfdSecretSecureKeyContainer::is_supported());
    }
}
