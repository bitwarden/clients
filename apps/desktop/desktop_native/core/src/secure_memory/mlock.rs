use std::collections::HashMap;

use crate::secure_memory::SecureMemoryStore;

/// The mlock store protects the data using the `mlock`. This prevents swapping to disk
/// but does not provide protection against user-mode memory dumps or debugger access.
pub(super) struct MlockSecretKVStore {
    map: HashMap<String, std::ptr::NonNull<[u8]>>,
}

impl MlockSecretKVStore {
    pub(super) fn new() -> Self {
        MlockSecretKVStore {
            map: HashMap::new(),
        }
    }
}

impl SecureMemoryStore for MlockSecretKVStore {
    fn put(&mut self, key: String, value: &[u8]) {
        let mut ptr: std::ptr::NonNull<[u8]> =
            unsafe { memsec::malloc_sized(value.len()).expect("malloc_sized should work") };
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
                memsec::free(value);
            }
        }
    }

    fn clear(&mut self) {
        for (_, value) in self.map.drain() {
            unsafe {
                memsec::free(value);
            }
        }
    }
}

impl Drop for MlockSecretKVStore {
    fn drop(&mut self) {
        self.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mlock_secret_kv_store() {
        let mut store = MlockSecretKVStore::new();
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
