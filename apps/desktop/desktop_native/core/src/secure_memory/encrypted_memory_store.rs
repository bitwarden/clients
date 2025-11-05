use tracing::error;

use crate::secure_memory::{
    secure_key::{EncryptedMemory, SecureMemoryEncryptionKey},
    SecureMemoryStore,
};

/// An encrypted memory store holds a platform protected symmetric encryption key, and uses it
/// to encrypt all items it stores. The ciphertexts for the items are not specially protected. This
/// allows circumventing length and amount limitations on platform specific secure memory APIs since
/// only a single short item needs to be protected.
///
/// The key is briefly in process memory during encryption and decryption, in memory that is protected
/// from swapping to disk via mlock, and then zeroed out immediately after use.
#[allow(unused)]
pub(crate) struct EncryptedMemoryStore {
    map: std::collections::HashMap<String, EncryptedMemory>,
    memory_encryption_key: SecureMemoryEncryptionKey,
}

impl EncryptedMemoryStore {
    #[allow(unused)]
    pub(crate) fn new() -> Self {
        EncryptedMemoryStore {
            map: std::collections::HashMap::new(),
            memory_encryption_key: SecureMemoryEncryptionKey::new(),
        }
    }
}

impl SecureMemoryStore for EncryptedMemoryStore {
    fn put(&mut self, key: String, value: &[u8]) {
        let encrypted_value = self.memory_encryption_key.encrypt(value);
        self.map.insert(key, encrypted_value);
    }

    fn get(&mut self, key: &str) -> Option<Vec<u8>> {
        let encrypted_memory = self.map.get(key);
        if let Some(encrypted_memory) = encrypted_memory {
            match self.memory_encryption_key.decrypt(encrypted_memory) {
                Ok(plaintext) => Some(plaintext),
                Err(_) => {
                    error!("In memory store, decryption failed for key {}. The memory may have been tampered with. re-keying.", key);
                    self.memory_encryption_key = SecureMemoryEncryptionKey::new();
                    self.clear();
                    None
                }
            }
        } else {
            None
        }
    }

    fn has(&self, key: &str) -> bool {
        self.map.contains_key(key)
    }

    fn remove(&mut self, key: &str) {
        self.map.remove(key);
    }

    fn clear(&mut self) {
        self.map.clear();
    }
}

impl Drop for EncryptedMemoryStore {
    fn drop(&mut self) {
        self.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_kv_store_various_sizes() {
        let mut store = EncryptedMemoryStore::new();
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
        }
    }

    #[test]
    fn test_crud() {
        let mut store = EncryptedMemoryStore::new();
        let key = "test_key".to_string();
        let value = vec![1, 2, 3, 4, 5];
        store.put(key.clone(), &value);
        assert!(store.has(&key));
        assert_eq!(store.get(&key), Some(value));
        store.remove(&key);
        assert!(!store.has(&key));
    }
}
