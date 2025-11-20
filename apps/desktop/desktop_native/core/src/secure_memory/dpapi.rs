use std::collections::HashMap;

use windows::Win32::Security::Cryptography::{
    CryptProtectMemory, CryptUnprotectMemory, CRYPTPROTECTMEMORY_BLOCK_SIZE,
    CRYPTPROTECTMEMORY_SAME_PROCESS,
};

use crate::secure_memory::SecureMemoryStore;

/// https://learn.microsoft.com/en-us/windows/win32/api/dpapi/nf-dpapi-cryptprotectdata
/// The DPAPI store encrypts data using the Windows Data Protection API (DPAPI). The key is bound
/// to the current process, and cannot be decrypted by other user-mode processes.
///
/// Note: Admin processes can still decrypt this memory:
/// https://blog.slowerzs.net/posts/cryptdecryptmemory/
pub(crate) struct DpapiSecretKVStore {
    map: HashMap<String, Vec<u8>>,
}

impl DpapiSecretKVStore {
    pub(crate) fn new() -> Self {
        DpapiSecretKVStore {
            map: HashMap::new(),
        }
    }
}

impl SecureMemoryStore for DpapiSecretKVStore {
    fn put(&mut self, key: String, value: &[u8]) {
        let length_header_len = std::mem::size_of::<usize>();

        // The allocated data has to be a multiple of CRYPTPROTECTMEMORY_BLOCK_SIZE, so we pad it
        // and write the length in front We are storing LENGTH|DATA|00..00, where LENGTH is
        // the length of DATA, the total length is a multiple
        // of CRYPTPROTECTMEMORY_BLOCK_SIZE, and the padding is filled with zeros.

        let data_len = value.len();
        let len_with_header = data_len + length_header_len;
        let padded_length = len_with_header + CRYPTPROTECTMEMORY_BLOCK_SIZE as usize
            - (len_with_header % CRYPTPROTECTMEMORY_BLOCK_SIZE as usize);
        let mut padded_data = vec![0u8; padded_length];
        padded_data[..length_header_len].copy_from_slice(&data_len.to_le_bytes());
        padded_data[length_header_len..][..data_len].copy_from_slice(value);

        // Protect the memory using DPAPI
        unsafe {
            CryptProtectMemory(
                padded_data.as_mut_ptr() as *mut core::ffi::c_void,
                padded_length as u32,
                CRYPTPROTECTMEMORY_SAME_PROCESS,
            )
        }
        .expect("crypt_protect_memory should work");

        self.map.insert(key, padded_data);
    }

    fn get(&mut self, key: &str) -> Option<Vec<u8>> {
        self.map.get(key).map(|data| {
            // A copy is created, that is then mutated by the DPAPI unprotect function.
            let mut data = data.clone();
            unsafe {
                CryptUnprotectMemory(
                    data.as_mut_ptr() as *mut core::ffi::c_void,
                    data.len() as u32,
                    CRYPTPROTECTMEMORY_SAME_PROCESS,
                )
            }
            .expect("crypt_unprotect_memory should work");

            // Unpad the data to retrieve the original value
            let length_header_size = std::mem::size_of::<usize>();
            let length_bytes = &data[..length_header_size];
            let data_length = usize::from_le_bytes(
                length_bytes
                    .try_into()
                    .expect("length header should be usize"),
            );

            data[length_header_size..length_header_size + data_length].to_vec()
        })
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

impl Drop for DpapiSecretKVStore {
    fn drop(&mut self) {
        self.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dpapi_secret_kv_store_various_sizes() {
        let mut store = DpapiSecretKVStore::new();
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
    fn test_dpapi_crud() {
        let mut store = DpapiSecretKVStore::new();
        let key = "test_key".to_string();
        let value = vec![1, 2, 3, 4, 5];
        store.put(key.clone(), &value);
        assert!(store.has(&key));
        assert_eq!(store.get(&key), Some(value));
        store.remove(&key);
        assert!(!store.has(&key));
    }
}
