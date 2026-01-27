//! This module defines the [`KeyStore`] trait and provides an encrypted in-memory
//! implementation for storing SSH keys securely.All stored data is ephemeral and
//! lost when the store is dropped.

use std::sync::{Arc, Mutex};

use anyhow::Result;

use desktop_core::secure_memory::{EncryptedMemoryStore, SecureMemoryStore};

use super::{KeyData, PublicKey};

/// Securely store and retrieve SSH key data.
///
/// Provides an abstraction over key storage mechanisms, allowing for different
/// implementations or mocks.
pub(crate) trait KeyStore {
    /// Stores or updates an SSH key in the keystore.
    /// If a key with the same public key already exists, it will be overwritten.
    ///
    /// # Arguments
    ///
    /// * `key_data` - The SSH key data to store, including private key, public key, name, and cipher ID
    ///
    /// # Returns
    ///
    /// `Ok(())` if the key was successfully stored, or an error if the operation failed.
    fn insert(&self, key_data: KeyData) -> Result<()>;

    /// Retrieves SSH key data by its public key.
    ///
    /// # Arguments
    ///
    /// * `public_key` - The public key to search for
    ///
    /// # Returns
    ///
    /// * `Ok(Some(KeyData))` if the key was found
    /// * `Ok(None)` if no key with the given public key exists
    /// * `Err(_)` if an error occurred during retrieval
    fn get(&self, public_key: &PublicKey) -> Result<Option<KeyData>>;

    /// # Returns
    ///
    /// A vector of tuples containing each key's public key and human-readable name,
    /// or an error if the operation failed.
    fn get_all_public_keys_and_names(&mut self) -> Result<Vec<(PublicKey, String)>>;
}

/// A thread-safe, in-memory, and encrypted implementation of the [`KeyStore`] trait.
///
/// Stores SSH keys in encrypted form in memory using [`EncryptedMemoryStore`].
/// Keys are encrypted when inserted and decrypted when retrieved.
/// All data is lost when the instance is dropped.
pub(crate) struct InMemoryEncryptedKeyStore {
    secure_memory: Arc<Mutex<EncryptedMemoryStore<PublicKey>>>,
}

impl InMemoryEncryptedKeyStore {
    pub(crate) fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(EncryptedMemoryStore::new())),
        }
    }
}

impl KeyStore for InMemoryEncryptedKeyStore {
    fn insert(&self, key_data: KeyData) -> Result<()> {
        let pub_key = key_data.public_key().clone();
        let bytes: Vec<u8> = key_data.try_into()?;

        self.secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .put(pub_key, bytes.as_slice());

        Ok(())
    }

    fn get(&self, public_key: &PublicKey) -> Result<Option<KeyData>> {
        self.secure_memory
            .lock()
            .expect("Mutex is not poisoned.")
            .get(public_key)?
            .map(KeyData::try_from)
            .transpose()
    }

    fn get_all_public_keys_and_names(&mut self) -> Result<Vec<(PublicKey, String)>> {
        self.secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .to_vec()?
            .into_iter()
            .map(|bytes| {
                KeyData::try_from(bytes)
                    .map(|key_data| (key_data.public_key().clone(), key_data.name().clone()))
            })
            .collect::<Result<Vec<_>, _>>()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::PrivateKey;
    use ssh_key::{
        private::{Ed25519Keypair, RsaKeypair},
        rand_core::OsRng,
    };

    fn create_test_keydata_ed25519(name: &str, cipher_id: &str) -> KeyData {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let ssh_key = ssh_key::PrivateKey::new(
            ssh_key::private::KeypairData::Ed25519(ed25519_keypair.clone()),
            "",
        )
        .unwrap();
        let public_key_bytes = ssh_key.public_key().to_bytes().unwrap();

        KeyData::new(
            PrivateKey::Ed25519(ed25519_keypair),
            PublicKey {
                alg: "ssh-ed25519".to_string(),
                blob: public_key_bytes,
            },
            name.to_string(),
            cipher_id.to_string(),
        )
    }

    fn create_test_keydata_rsa(name: &str, cipher_id: &str) -> KeyData {
        let rsa_keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Rsa(rsa_keypair.clone()), "")
                .unwrap();
        let public_key_bytes = ssh_key.public_key().to_bytes().unwrap();

        KeyData::new(
            PrivateKey::Rsa(rsa_keypair),
            PublicKey {
                alg: "ssh-rsa".to_string(),
                blob: public_key_bytes,
            },
            name.to_string(),
            cipher_id.to_string(),
        )
    }

    #[test]
    fn test_new_creates_empty_store() {
        let mut ks = InMemoryEncryptedKeyStore::new();

        let result = ks.get_all_public_keys_and_names();
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_insert_multiple_keys_and_keytypes() {
        let ks = InMemoryEncryptedKeyStore::new();

        let key1 = create_test_keydata_ed25519("key1", "cipher-1");
        let key2 = create_test_keydata_rsa("key2", "cipher-2");
        let key3 = create_test_keydata_ed25519("key3", "cipher-3");

        assert!(ks.insert(key1).is_ok());
        assert!(ks.insert(key2).is_ok());
        assert!(ks.insert(key3).is_ok());
    }

    #[test]
    fn test_insert_overwrites_existing_key() {
        let ks = InMemoryEncryptedKeyStore::new();

        let key_data1 = create_test_keydata_ed25519("original-name", "original-cipher");
        let public_key = key_data1.public_key().clone();

        // insert first key
        ks.insert(key_data1).unwrap();

        // Create new KeyData with same public key but different name/cipher_id
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let key_data2 = KeyData::new(
            PrivateKey::Ed25519(ed25519_keypair),
            public_key.clone(),
            "updated-name".to_string(),
            "updated-cipher".to_string(),
        );

        // insert second key with same public key
        ks.insert(key_data2).unwrap();

        // the name was updated
        let key_data = ks.get(&public_key).unwrap().unwrap();
        assert_eq!(key_data.name(), &String::from("updated-name"));
    }

    #[test]
    fn test_get_nonexistent_key() {
        let ks = InMemoryEncryptedKeyStore::new();

        let dummy_public_key = PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: vec![1, 2, 3, 4, 5],
        };

        let result = ks.get(&dummy_public_key);
        assert!(result.is_ok());
        assert!(result.unwrap().is_none());
    }

    #[test]
    fn test_get_preserves_all_fields() {
        let ks = InMemoryEncryptedKeyStore::new();

        let original = create_test_keydata_ed25519("test-key", "cipher-123");
        let public_key = original.public_key().clone();
        let private_key = original.private_key().clone();
        let expected_name = original.name().clone();
        let expected_cipher_id = original.cipher_id().clone();

        ks.insert(original).unwrap();
        let retrieved = ks.get(&public_key).unwrap().unwrap();

        assert_eq!(retrieved.name(), &expected_name);
        assert_eq!(retrieved.cipher_id(), &expected_cipher_id);
        assert_eq!(retrieved.public_key(), &public_key);
        assert_eq!(retrieved.private_key(), &private_key);
    }

    #[test]
    fn test_get_all_empty_store() {
        let mut ks = InMemoryEncryptedKeyStore::new();
        let result = ks.get_all_public_keys_and_names();

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_get_all_multiple_keys() {
        let mut ks = InMemoryEncryptedKeyStore::new();

        let key1 = create_test_keydata_ed25519("key1", "cipher-1");
        let key2 = create_test_keydata_rsa("key2", "cipher-2");
        let key3 = create_test_keydata_ed25519("key3", "cipher-3");
        let pub_key1 = key1.public_key().clone();
        let pub_key2 = key2.public_key().clone();
        let pub_key3 = key3.public_key().clone();

        ks.insert(key1).unwrap();
        ks.insert(key2).unwrap();
        ks.insert(key3).unwrap();

        let result = ks.get_all_public_keys_and_names().unwrap();
        assert_eq!(result.len(), 3);

        let names: Vec<String> = result.iter().map(|(_, name)| name.clone()).collect();

        assert!(names.contains(&"key1".to_string()));
        assert!(names.contains(&"key2".to_string()));
        assert!(names.contains(&"key3".to_string()));

        let public_keys: Vec<PublicKey> = result.iter().map(|(pk, _)| pk.clone()).collect();

        assert!(public_keys.contains(&pub_key1));
        assert!(public_keys.contains(&pub_key2));
        assert!(public_keys.contains(&pub_key3));
    }
}
