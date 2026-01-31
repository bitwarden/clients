#[cfg(target_os = "windows")]
pub(crate) mod dpapi;

pub(crate) mod encrypted_memory_store;
mod secure_key;

pub use encrypted_memory_store::EncryptedMemoryStore;

use crate::secure_memory::secure_key::DecryptionError;

/// The secure memory store provides an ephemeral key-value store for sensitive data.
/// Data stored in this store is prevented from being swapped to disk and zeroed out. Additionally,
/// platform-specific protections are applied to prevent memory dumps or debugger access from
/// reading the stored values.
pub trait SecureMemoryStore {
    type KeyType;

    /// Stores a copy of the provided value in secure memory.
    fn put(&mut self, key: Self::KeyType, value: &[u8]);

    /// Retrieves a copy of the value associated with the given key from secure memory.
    /// This copy does not have additional memory protections applied, and should be zeroed when no
    /// longer needed.
    ///
    /// # Errors
    ///
    /// `DecryptionError` if memory is tampered with. This also re-keys the memory store.
    fn get(&mut self, key: &Self::KeyType) -> Result<Option<Vec<u8>>, DecryptionError>;

    /// Checks if a value is stored under the given key.
    fn has(&self, key: &Self::KeyType) -> bool;

    /// Removes the value associated with the given key from secure memory.
    fn remove(&mut self, key: &Self::KeyType);

    /// Clears all values stored in secure memory.
    fn clear(&mut self);
}
