use std::{collections::HashMap, ptr::NonNull, sync::LazyLock};

use std::marker::Send;

use crate::secure_memory::SecureMemoryStore;

/// https://man.archlinux.org/man/memfd_secret.2.en
/// The memfd_secret store protects the data using the `memfd_secret` syscall. The
/// data is inaccessible to other user-mode processes, and even to root in most cases.
/// If arbitrary data can be executed in the kernel, the data can still be retrieved:
/// https://github.com/JonathonReinhart/nosecmem
///
/// Warning: There is a maximum amount of concurrent memfd_secret protected items. Only
/// use this sparingly, or extend the implementation to use one secret + in-memory encryption,
/// or to reserve a large protected area in which we allocate our items.
pub(crate) struct MemfdSecretKVStore {
    map: HashMap<String, std::ptr::NonNull<[u8]>>,
}

unsafe impl Send for MemfdSecretKVStore {}

impl MemfdSecretKVStore {
    pub(crate) fn new() -> Self {
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

#[allow(unused)]
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
    fn test_memfd_secret_kv_store_various_sizes() {
        let mut store = MemfdSecretKVStore::new();
        for size in 0..=2048 {
            let key = format!("test_key_{}", size);
            let value: Vec<u8> = (0..size).map(|i| (i % 256) as u8).collect();
            store.put(key.clone(), &value);
            assert!(store.has(&key), "Store should have key for size {}", size);
            assert_eq!(
                store.get(&key),
                Some(value),
                "Value mismatch for size {}",
                size
            );
            // The test will not pass when we don't remove the keys, because there is a limit of concurrent memfd_secret memory spaces.
            store.remove(&key);
        }
    }

    #[test]
    fn test_memfd_secret_kv_store_crud() {
        let mut store = MemfdSecretKVStore::new();
        let key = "test_key".to_string();
        let value = vec![1, 2, 3, 4, 5];
        store.put(key.clone(), &value);
        assert!(store.has(&key));
        assert_eq!(store.get(&key), Some(value));
        store.remove(&key);
        assert!(!store.has(&key));
    }
}
