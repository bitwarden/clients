use std::{collections::HashMap, ptr::NonNull, sync::LazyLock};

use crate::secure_memory::SecureMemoryStore;

/// https://man.archlinux.org/man/memfd_secret.2.en
/// The memfd_secret store protects the data using the `memfd_secret` syscall. The
/// data is inaccessible to other user-mode processes, and even to root in most cases.
/// If arbitrary data can be executed in the kernel, the data can still be retrieved:
/// https://github.com/JonathonReinhart/nosecmem
pub(super) struct MemfdSecretKVStore {
    map: HashMap<String, std::ptr::NonNull<[u8]>>,
}

impl MemfdSecretKVStore {
    pub(super) fn new() -> Self {
        MemfdSecretKVStore {
            map: HashMap::new(),
        }
    }
}

impl SecureMemoryStore for MemfdSecretKVStore {
    fn put(&mut self, key: String, value: &[u8]) {
        let mut ptr: std::ptr::NonNull<[u8]> = unsafe {
            memsec::memfd_secret_sized(value.len()).expect("memfd_secret_sized should work")
        };
        unsafe {
            std::ptr::copy_nonoverlapping(value.as_ptr(), ptr.as_mut().as_mut_ptr(), value.len());
        }
        self.map.insert(key, ptr);
    }

    fn get(&self, key: &str) -> Option<Vec<u8>> {
        let ptr = self.map.get(key)?;
        let value = unsafe { ptr.as_ref() };
        Some(value.to_vec())
    }

    fn has(&self, key: &str) -> bool {
        self.map.contains_key(key)
    }

    fn remove(&mut self, key: &str) {
        if let Some(value) = self.map.remove(key) {
            unsafe {
                memsec::free_memfd_secret(value);
            }
        }
    }

    fn clear(&mut self) {
        for (_, value) in self.map.drain() {
            unsafe {
                memsec::free_memfd_secret(value);
            }
        }
    }
}

impl Drop for MemfdSecretKVStore {
    fn drop(&mut self) {
        self.clear();
    }
}

pub(super) fn is_supported() -> bool {
    // To test if memfd_secret is supported, we try to allocate a 1 byte and see if that
    // succeeds.
    static IS_SUPPORTED: LazyLock<bool> = LazyLock::new(|| {
        let Some(ptr): Option<NonNull<[u8]>> = (unsafe { memsec::memfd_secret_sized(1) }) else {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_memfd_secret_kv_store() {
        let mut store = MemfdSecretKVStore::new();
        let key = "test_key".to_string();
        let value = vec![1, 2, 3, 4, 5];

        store.put(key.clone(), &value);
        assert!(store.has(&key));
        assert_eq!(store.get(&key), Some(value.clone()));

        store.remove(&key);
        assert!(!store.has(&key));
        assert_eq!(store.get(&key), None);
    }
}
