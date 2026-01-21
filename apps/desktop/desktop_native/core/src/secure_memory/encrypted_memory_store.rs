use std::collections::BTreeMap;

use tracing::error;

use crate::secure_memory::{
    secure_key::{DecryptionError, EncryptedMemory, SecureMemoryEncryptionKey},
    SecureMemoryStore,
};

/// An encrypted memory store holds a platform protected symmetric encryption key, and uses it
/// to encrypt all items it stores. The ciphertexts for the items are not specially protected. This
/// allows circumventing length and amount limitations on platform specific secure memory APIs since
/// only a single short item needs to be protected.
///
/// The key is briefly in process memory during encryption and decryption, in memory that is
/// protected from swapping to disk via mlock, and then zeroed out immediately after use.
/// # Type Parameters
///
/// * `K` - The type of the key.
pub struct EncryptedMemoryStore<K>
where
    K: std::cmp::Ord + std::fmt::Display + std::clone::Clone,
{
    map: BTreeMap<K, EncryptedMemory>,
    memory_encryption_key: SecureMemoryEncryptionKey,
}

impl<K> EncryptedMemoryStore<K>
where
    K: std::cmp::Ord + std::fmt::Display + std::clone::Clone,
{
    #[must_use]
    pub fn new() -> Self {
        EncryptedMemoryStore {
            map: BTreeMap::new(),
            memory_encryption_key: SecureMemoryEncryptionKey::new(),
        }
    }

    /// # Returns
    ///
    /// An array of all decrypted values.
    ///
    /// # Errors
    ///
    /// `DecryptionError` if an error occured during decryption
    pub fn to_vec(&mut self) -> Result<Vec<Vec<u8>>, DecryptionError> {
        let mut result = vec![];
        let keys: Vec<_> = self.map.keys().cloned().collect();

        for key in &keys {
            let bytes = self.get(key)?.expect("All keys to still be in map.");
            result.push(bytes);
        }
        Ok(result)
    }
}

impl<K> Default for EncryptedMemoryStore<K>
where
    K: std::cmp::Ord + std::fmt::Display + std::clone::Clone,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<K> SecureMemoryStore for EncryptedMemoryStore<K>
where
    K: std::cmp::Ord + std::fmt::Display + std::clone::Clone,
{
    type KeyType = K;

    fn put(&mut self, key: Self::KeyType, value: &[u8]) {
        let encrypted_value = self.memory_encryption_key.encrypt(value);
        self.map.insert(key, encrypted_value);
    }

    fn get(&mut self, key: &Self::KeyType) -> Result<Option<Vec<u8>>, DecryptionError> {
        if let Some(encrypted) = self.map.get(key) {
            self.memory_encryption_key.decrypt(encrypted).map_err(|error| {
                error!(?error, %key, "In memory store, decryption failed. The memory may have been tampered with. Re-keying.");
                self.memory_encryption_key = SecureMemoryEncryptionKey::new();
                self.clear();
                error
            }).map(Some)
        } else {
            Ok(None)
        }
    }

    fn has(&self, key: &Self::KeyType) -> bool {
        self.map.contains_key(key)
    }

    fn remove(&mut self, key: &Self::KeyType) {
        self.map.remove(key);
    }

    fn clear(&mut self) {
        self.map.clear();
    }
}

impl<K> Drop for EncryptedMemoryStore<K>
where
    K: std::cmp::Ord + std::fmt::Display + std::clone::Clone,
{
    fn drop(&mut self) {
        self.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_secret_kv_store_various_sizes() {
        let mut store = EncryptedMemoryStore::default();
        for size in 0..=2048 {
            let key = format!("test_key_{size}");
            let value: Vec<u8> = (0..size).map(|i| (i % 256) as u8).collect();
            store.put(key.clone(), &value);
            assert!(store.has(&key), "Store should have key for size {size}");
            assert_eq!(
                store.get(&key).expect("entry in map for key"),
                Some(value),
                "Value mismatch for size {size}",
            );
        }
    }

    #[test]
    fn test_crud() {
        let mut store = EncryptedMemoryStore::default();
        let key = "test_key".to_string();
        let value = vec![1, 2, 3, 4, 5];
        store.put(key.clone(), &value);
        assert!(store.has(&key));
        assert_eq!(store.get(&key).expect("entry in map for key"), Some(value));
        store.remove(&key);
        assert!(!store.has(&key));
    }
}
