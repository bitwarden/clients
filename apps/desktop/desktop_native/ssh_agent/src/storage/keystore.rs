//! Defines the [`KeyStore`] trait and provides an encrypted in-memory
//! implementation for storing SSH keys securely. All stored data is ephemeral and
//! lost when the store is dropped.

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

use anyhow::Result;
use secure_memory::{EncryptedMemoryStore, SecureMemoryStore};

#[cfg(test)]
use crate::storage::keydata::MockQueryableKeyData;
use crate::{
    crypto::{PrivateKey, PublicKey, QueryableKeyData, SSHKeyData},
    storage::keydata::DestinationMatch,
};

/// Securely store and retrieve SSH key data.
///
/// Provides an abstraction over key storage mechanisms, allowing for different
/// implementations or mocks.
#[cfg_attr(test, mockall::automock(type KeyData = MockQueryableKeyData;))]
pub trait KeyStore: Send + Sync {
    /// The type of key data stored by this keystore.
    type KeyData: QueryableKeyData;

    /// Stores or updates an SSH key in the keystore.
    /// If a key with the same public key already exists, it will be overwritten.
    fn insert(&self, key_data: Self::KeyData) -> Result<()>;

    /// Retrieves SSH key data by its [`PublicKey`]
    ///
    /// # Returns
    ///
    /// * `Ok(Some(KeyData))` if the key was found
    /// * `Ok(None)` if no key with the given public key exists
    /// * `Err(_)` if an error occurred during retrieval
    fn get(&self, public_key: &PublicKey) -> Result<Option<Self::KeyData>>;

    /// Retrieves the [`PrivateKey`] associated with the given [`PublicKey`].
    ///
    /// # Returns
    ///
    /// * `Ok(Some(PrivateKey))` if the key was found
    /// * `Ok(None)` if no key with the given public key exists
    /// * `Err(_)` if an error occurred during retrieval
    fn get_private_key(&self, public_key: &PublicKey) -> Result<Option<PrivateKey>>;

    /// # Arguments
    ///
    /// * `host_fingerprint` - The verified SHA-256 fingerprint of the destination host key for the
    ///   current connection, if session-bind information is available.
    ///
    ///   **Filtering**: when `None`, all keys are returned regardless of their configured
    ///   destinations (fallback behavior — original keystore order, unmodified). When `Some`,
    ///   keys restricted to other destinations are omitted entirely.
    ///
    ///   **Prioritization**: among the keys that are returned, ones explicitly configured for
    ///   `host_fingerprint` are ordered before unrestricted keys, so OpenSSH tries a
    ///   destination-matching key first. This is an identity-offering optimization, not an
    ///   authorization boundary — it never affects whether signing is authorized. The relative
    ///   order within each group (explicit matches among themselves, unrestricted keys among
    ///   themselves) matches their order in the underlying keystore.
    ///
    /// # Returns
    ///
    /// A vector of tuples containing each offered key's public key and human-readable name.
    // The lifetime is needed for `mockall::automock` to expand this method correctly; plain
    // elision compiles fine without the attribute but fails with E0106 once it's applied.
    #[allow(clippy::needless_lifetimes)]
    fn get_all_public_keys_and_names<'a>(
        &self,
        host_fingerprint: Option<&'a str>,
    ) -> Result<Vec<(PublicKey, String)>>;

    /// Atomically replaces all keys in the keystore.
    fn replace(&self, keys: Vec<Self::KeyData>) -> Result<()>;

    /// Clears the keystore of all keys.
    fn clear(&self);

    /// Returns `true` if [`replace`](KeyStore::replace) has been called at least once since the
    /// keystore was created or last cleared.
    fn is_initialized(&self) -> bool;
}

/// A thread-safe, in-memory, and encrypted implementation of the [`KeyStore`] trait.
///
/// Stores SSH keys in encrypted form in memory using [`EncryptedMemoryStore`].
/// Keys are encrypted when inserted and decrypted when retrieved.
/// All data is lost when the instance is dropped.
pub struct InMemoryEncryptedKeyStore {
    secure_memory: Arc<Mutex<EncryptedMemoryStore<PublicKey>>>,
    initialized: AtomicBool,
}

impl InMemoryEncryptedKeyStore {
    /// Create a new [`InMemoryEncryptedKeyStore`]
    #[must_use]
    pub fn new() -> Self {
        Self {
            secure_memory: Arc::new(Mutex::new(EncryptedMemoryStore::new())),
            initialized: AtomicBool::new(false),
        }
    }
}

impl Default for InMemoryEncryptedKeyStore {
    fn default() -> Self {
        Self::new()
    }
}

impl KeyStore for InMemoryEncryptedKeyStore {
    type KeyData = SSHKeyData;

    fn insert(&self, key_data: Self::KeyData) -> Result<()> {
        let pub_key = key_data.public_key().clone();
        let bytes: Vec<u8> = key_data.try_into()?;

        self.secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .put(pub_key, bytes.as_slice());

        Ok(())
    }

    fn get(&self, public_key: &PublicKey) -> Result<Option<Self::KeyData>> {
        self.secure_memory
            .lock()
            .expect("Mutex is not poisoned.")
            .get(public_key)?
            .map(SSHKeyData::try_from)
            .transpose()
    }

    #[allow(clippy::needless_lifetimes)]
    fn get_all_public_keys_and_names<'a>(
        &self,
        host_fingerprint: Option<&'a str>,
    ) -> Result<Vec<(PublicKey, String)>> {
        // Two buckets, filled in a single pass over the keystore's existing order: this makes the
        // partition stable (each bucket keeps the relative order its members already had) and
        // preserves the original collect::<Result<_, _>>() semantics of returning on the *first*
        // unparseable key, since `?` short-circuits at the same point in the same iteration order.
        let mut explicit_matches = Vec::new();
        let mut unrestricted = Vec::new();

        for bytes in self
            .secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .to_vec()?
        {
            let key_data = SSHKeyData::try_from(bytes)?;
            let entry = (key_data.public_key().clone(), key_data.name().clone());
            match key_data.destination_match(host_fingerprint) {
                DestinationMatch::ExplicitMatch => explicit_matches.push(entry),
                DestinationMatch::Unrestricted => unrestricted.push(entry),
                DestinationMatch::NoMatch => {}
            }
        }

        explicit_matches.extend(unrestricted);
        Ok(explicit_matches)
    }

    fn get_private_key(&self, public_key: &PublicKey) -> Result<Option<PrivateKey>> {
        Ok(self.get(public_key)?.map(|kd| kd.private_key().clone()))
    }

    fn replace(&self, new_keys: Vec<SSHKeyData>) -> Result<()> {
        let entries = new_keys
            .into_iter()
            .map(|k| {
                let pub_key = k.public_key().clone();
                let bytes: Vec<u8> = k.try_into()?;
                Ok((pub_key, bytes))
            })
            .collect::<Result<Vec<_>>>()?;

        {
            let mut store = self.secure_memory.lock().expect("Mutex is not poisoned");

            store.clear();
            for (pub_key, bytes) in entries {
                store.put(pub_key, bytes.as_slice());
            }
        }
        self.initialized.store(true, Ordering::Relaxed);
        Ok(())
    }

    fn clear(&self) {
        self.secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .clear();
        self.initialized.store(false, Ordering::Relaxed);
    }

    fn is_initialized(&self) -> bool {
        self.initialized.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use ssh_key::{
        private::{Ed25519Keypair, RsaKeypair},
        rand_core::OsRng,
    };

    use super::*;
    use crate::crypto::{PrivateKey, QueryableKeyData};

    fn create_test_keydata_ed25519(name: &str, cipher_id: &str) -> SSHKeyData {
        create_test_keydata_ed25519_with_destinations(name, cipher_id, &[])
    }

    fn create_test_keydata_ed25519_with_destinations(
        name: &str,
        cipher_id: &str,
        destinations: &[&str],
    ) -> SSHKeyData {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let ssh_key = ssh_key::PrivateKey::new(
            ssh_key::private::KeypairData::Ed25519(ed25519_keypair.clone()),
            "",
        )
        .unwrap();
        let public_key_bytes = ssh_key.public_key().to_bytes().unwrap();

        SSHKeyData::new(
            PrivateKey::Ed25519(ed25519_keypair),
            PublicKey {
                alg: "ssh-ed25519".to_string(),
                blob: public_key_bytes,
            },
            name.to_string(),
            cipher_id.to_string(),
            destinations.iter().map(|s| s.to_string()).collect(),
        )
    }

    fn create_test_keydata_rsa(name: &str, cipher_id: &str) -> SSHKeyData {
        let rsa_keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Rsa(rsa_keypair.clone()), "")
                .unwrap();
        let public_key_bytes = ssh_key.public_key().to_bytes().unwrap();

        SSHKeyData::new(
            PrivateKey::Rsa(rsa_keypair),
            PublicKey {
                alg: "ssh-rsa".to_string(),
                blob: public_key_bytes,
            },
            name.to_string(),
            cipher_id.to_string(),
            vec![],
        )
    }

    #[test]
    fn test_new_creates_empty_store() {
        let ks = InMemoryEncryptedKeyStore::new();

        let result = ks.get_all_public_keys_and_names(None);
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

        // Create new SSHKeyData with same public key but different name/cipher_id
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let key_data2 = SSHKeyData::new(
            PrivateKey::Ed25519(ed25519_keypair),
            public_key.clone(),
            "updated-name".to_string(),
            "updated-cipher".to_string(),
            vec![],
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
    fn test_replace_on_empty_store_inserts_keys() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key1 = create_test_keydata_ed25519("key1", "cipher-1");
        let key2 = create_test_keydata_rsa("key2", "cipher-2");

        ks.replace(vec![key1, key2]).unwrap();

        let result = ks.get_all_public_keys_and_names(None).unwrap();
        assert_eq!(result.len(), 2);
        let names: Vec<String> = result.iter().map(|(_, n)| n.clone()).collect();
        assert!(names.contains(&"key1".to_string()));
        assert!(names.contains(&"key2".to_string()));
    }

    #[test]
    fn test_replace_removes_previous_keys() {
        let ks = InMemoryEncryptedKeyStore::new();
        let old_key = create_test_keydata_ed25519("old-key", "cipher-old");
        ks.insert(old_key).unwrap();

        let new_key = create_test_keydata_rsa("new-key", "cipher-new");
        ks.replace(vec![new_key]).unwrap();

        let result = ks.get_all_public_keys_and_names(None).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].1, "new-key");
    }

    #[test]
    fn test_replace_second_call_overwrites_first() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key1 = create_test_keydata_ed25519("key1", "cipher-1");
        let key2 = create_test_keydata_rsa("key2", "cipher-2");

        ks.replace(vec![key1]).unwrap();
        ks.replace(vec![key2]).unwrap();

        let result = ks.get_all_public_keys_and_names(None).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].1, "key2");
    }

    #[test]
    fn test_replace_with_empty_vec_clears_store() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key = create_test_keydata_ed25519("key", "cipher");
        ks.insert(key).unwrap();

        ks.replace(vec![]).unwrap();

        let result = ks.get_all_public_keys_and_names(None).unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_is_initialized_false_on_new() {
        let ks = InMemoryEncryptedKeyStore::new();
        assert!(!ks.is_initialized());
    }

    #[test]
    fn test_is_initialized_true_after_replace() {
        let ks = InMemoryEncryptedKeyStore::new();
        ks.replace(vec![]).unwrap();
        assert!(ks.is_initialized());
    }

    #[test]
    fn test_is_initialized_true_after_replace_with_keys() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key = create_test_keydata_ed25519("key", "cipher");
        ks.replace(vec![key]).unwrap();
        assert!(ks.is_initialized());
    }

    #[test]
    fn test_is_initialized_false_after_clear() {
        let ks = InMemoryEncryptedKeyStore::new();
        ks.replace(vec![]).unwrap();
        assert!(ks.is_initialized());
        ks.clear();
        assert!(!ks.is_initialized());
    }

    #[test]
    fn test_get_all_empty_store() {
        let ks = InMemoryEncryptedKeyStore::new();
        let result = ks.get_all_public_keys_and_names(None);

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_get_all_multiple_keys() {
        let ks = InMemoryEncryptedKeyStore::new();

        let key1 = create_test_keydata_ed25519("key1", "cipher-1");
        let key2 = create_test_keydata_rsa("key2", "cipher-2");
        let key3 = create_test_keydata_ed25519("key3", "cipher-3");
        let pub_key1 = key1.public_key().clone();
        let pub_key2 = key2.public_key().clone();
        let pub_key3 = key3.public_key().clone();

        ks.insert(key1).unwrap();
        ks.insert(key2).unwrap();
        ks.insert(key3).unwrap();

        let result = ks.get_all_public_keys_and_names(None).unwrap();
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

    #[test]
    fn test_get_all_unrestricted_key_is_always_returned() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key = create_test_keydata_ed25519_with_destinations("key", "cipher", &[]);
        ks.insert(key).unwrap();

        let result = ks
            .get_all_public_keys_and_names(Some("SHA256:host"))
            .unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_get_all_key_with_matching_destination_is_returned() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key = create_test_keydata_ed25519_with_destinations("key", "cipher", &["SHA256:host"]);
        ks.insert(key).unwrap();

        let result = ks
            .get_all_public_keys_and_names(Some("SHA256:host"))
            .unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_get_all_key_with_only_non_matching_destinations_is_excluded() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key = create_test_keydata_ed25519_with_destinations("key", "cipher", &["SHA256:other"]);
        ks.insert(key).unwrap();

        let result = ks
            .get_all_public_keys_and_names(Some("SHA256:host"))
            .unwrap();
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_get_all_key_with_multiple_destinations_one_matching_is_returned() {
        let ks = InMemoryEncryptedKeyStore::new();
        let key = create_test_keydata_ed25519_with_destinations(
            "key",
            "cipher",
            &["SHA256:other", "SHA256:host"],
        );
        ks.insert(key).unwrap();

        let result = ks
            .get_all_public_keys_and_names(Some("SHA256:host"))
            .unwrap();
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn test_get_all_mixed_restricted_and_unrestricted_keys_returns_correct_subset() {
        let ks = InMemoryEncryptedKeyStore::new();
        let unrestricted =
            create_test_keydata_ed25519_with_destinations("unrestricted", "cipher-1", &[]);
        let matching =
            create_test_keydata_ed25519_with_destinations("matching", "cipher-2", &["SHA256:host"]);
        let non_matching = create_test_keydata_ed25519_with_destinations(
            "non-matching",
            "cipher-3",
            &["SHA256:other"],
        );
        ks.insert(unrestricted).unwrap();
        ks.insert(matching).unwrap();
        ks.insert(non_matching).unwrap();

        let result = ks
            .get_all_public_keys_and_names(Some("SHA256:host"))
            .unwrap();
        let names: Vec<String> = result.iter().map(|(_, name)| name.clone()).collect();

        assert_eq!(result.len(), 2);
        assert!(names.contains(&"unrestricted".to_string()));
        assert!(names.contains(&"matching".to_string()));
        assert!(!names.contains(&"non-matching".to_string()));
    }

    #[test]
    fn test_get_all_without_host_fingerprint_returns_everything_regardless_of_destinations() {
        let ks = InMemoryEncryptedKeyStore::new();
        let unrestricted =
            create_test_keydata_ed25519_with_destinations("unrestricted", "cipher-1", &[]);
        let restricted = create_test_keydata_ed25519_with_destinations(
            "restricted",
            "cipher-2",
            &["SHA256:other"],
        );
        ks.insert(unrestricted).unwrap();
        ks.insert(restricted).unwrap();

        let result = ks.get_all_public_keys_and_names(None).unwrap();
        assert_eq!(result.len(), 2);
    }

    /// Names of the keys returned for `host_fingerprint`, in order.
    fn names_in_order(
        ks: &InMemoryEncryptedKeyStore,
        host_fingerprint: Option<&str>,
    ) -> Vec<String> {
        ks.get_all_public_keys_and_names(host_fingerprint)
            .unwrap()
            .into_iter()
            .map(|(_, name)| name)
            .collect()
    }

    /// `baseline`, restricted to the names in `keep`, preserving `baseline`'s relative order.
    fn filter_preserving_order(baseline: &[String], keep: &[&str]) -> Vec<String> {
        baseline
            .iter()
            .filter(|name| keep.contains(&name.as_str()))
            .cloned()
            .collect()
    }

    #[test]
    fn test_get_all_explicit_match_ordered_before_unrestricted() {
        let ks = InMemoryEncryptedKeyStore::new();
        let unrestricted =
            create_test_keydata_ed25519_with_destinations("unrestricted", "cipher-1", &[]);
        let matching =
            create_test_keydata_ed25519_with_destinations("matching", "cipher-2", &["SHA256:host"]);
        ks.insert(unrestricted).unwrap();
        ks.insert(matching).unwrap();

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(
            result,
            vec!["matching".to_string(), "unrestricted".to_string()]
        );
    }

    #[test]
    fn test_get_all_unrestricted_keys_still_returned_alongside_explicit_match() {
        // Prioritization must not turn into exclusive selection: once any explicit match exists,
        // unrestricted keys must still be present in the result, not dropped.
        let ks = InMemoryEncryptedKeyStore::new();
        let matching =
            create_test_keydata_ed25519_with_destinations("matching", "cipher-1", &["SHA256:host"]);
        let unrestricted =
            create_test_keydata_ed25519_with_destinations("unrestricted", "cipher-2", &[]);
        ks.insert(matching).unwrap();
        ks.insert(unrestricted).unwrap();

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(result.len(), 2);
        assert!(result.contains(&"unrestricted".to_string()));
    }

    #[test]
    fn test_get_all_restricted_non_matching_key_still_omitted_under_prioritization() {
        let ks = InMemoryEncryptedKeyStore::new();
        let matching =
            create_test_keydata_ed25519_with_destinations("matching", "cipher-1", &["SHA256:host"]);
        let non_matching = create_test_keydata_ed25519_with_destinations(
            "non-matching",
            "cipher-2",
            &["SHA256:other"],
        );
        ks.insert(matching).unwrap();
        ks.insert(non_matching).unwrap();

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(result, vec!["matching".to_string()]);
    }

    #[test]
    fn test_get_all_multiple_explicit_matches_preserve_relative_order() {
        let ks = InMemoryEncryptedKeyStore::new();
        let names = ["match-a", "match-b", "match-c"];
        for (i, name) in names.iter().enumerate() {
            ks.insert(create_test_keydata_ed25519_with_destinations(
                name,
                &format!("cipher-{i}"),
                &["SHA256:host"],
            ))
            .unwrap();
        }
        let baseline = names_in_order(&ks, None);

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(result, filter_preserving_order(&baseline, &names));
    }

    #[test]
    fn test_get_all_multiple_unrestricted_keys_preserve_relative_order() {
        let ks = InMemoryEncryptedKeyStore::new();
        let names = ["unres-a", "unres-b", "unres-c"];
        for (i, name) in names.iter().enumerate() {
            ks.insert(create_test_keydata_ed25519_with_destinations(
                name,
                &format!("cipher-{i}"),
                &[],
            ))
            .unwrap();
        }
        let baseline = names_in_order(&ks, None);

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(result, filter_preserving_order(&baseline, &names));
    }

    #[test]
    fn test_get_all_stable_partition_with_mixed_matches_unrestricted_and_non_matching() {
        // Mirrors the ordering example from the feature spec: two explicit matches, two
        // unrestricted keys, and one restricted-but-non-matching key, inserted in a shuffled
        // arrangement. The result must be [explicit matches in original relative order] followed
        // by [unrestricted keys in original relative order], with the non-matching key omitted.
        let ks = InMemoryEncryptedKeyStore::new();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "match-2",
            "cipher-1",
            &["SHA256:host"],
        ))
        .unwrap();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "unrestricted-1",
            "cipher-2",
            &[],
        ))
        .unwrap();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "match-1",
            "cipher-3",
            &["SHA256:host"],
        ))
        .unwrap();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "restricted-non-match",
            "cipher-4",
            &["SHA256:other"],
        ))
        .unwrap();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "unrestricted-2",
            "cipher-5",
            &[],
        ))
        .unwrap();
        let baseline = names_in_order(&ks, None);

        let result = names_in_order(&ks, Some("SHA256:host"));

        let expected_matches = filter_preserving_order(&baseline, &["match-1", "match-2"]);
        let expected_unrestricted =
            filter_preserving_order(&baseline, &["unrestricted-1", "unrestricted-2"]);
        assert_eq!(result.len(), 4);
        assert_eq!(&result[..2], expected_matches.as_slice());
        assert_eq!(&result[2..], expected_unrestricted.as_slice());
        assert!(!result.contains(&"restricted-non-match".to_string()));
    }

    #[test]
    fn test_get_all_no_explicit_matches_preserves_original_order_among_unrestricted() {
        let ks = InMemoryEncryptedKeyStore::new();
        let names = ["key-a", "key-b", "key-c"];
        for (i, name) in names.iter().enumerate() {
            ks.insert(create_test_keydata_ed25519_with_destinations(
                name,
                &format!("cipher-{i}"),
                &[],
            ))
            .unwrap();
        }
        let baseline = names_in_order(&ks, None);

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(result, baseline);
    }

    #[test]
    fn test_get_all_every_key_matches_preserves_original_order() {
        let ks = InMemoryEncryptedKeyStore::new();
        let names = ["key-a", "key-b", "key-c"];
        for (i, name) in names.iter().enumerate() {
            ks.insert(create_test_keydata_ed25519_with_destinations(
                name,
                &format!("cipher-{i}"),
                &["SHA256:host"],
            ))
            .unwrap();
        }
        let baseline = names_in_order(&ks, None);

        let result = names_in_order(&ks, Some("SHA256:host"));

        assert_eq!(result, baseline);
    }

    #[test]
    fn test_get_all_without_host_fingerprint_matches_raw_keystore_order_exactly() {
        // The fallback path must not reorder anything: it should reproduce the exact sequence the
        // underlying store yields, independent of any configured destinations.
        let ks = InMemoryEncryptedKeyStore::new();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "restricted",
            "cipher-1",
            &["SHA256:other"],
        ))
        .unwrap();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "unrestricted",
            "cipher-2",
            &[],
        ))
        .unwrap();
        ks.insert(create_test_keydata_ed25519_with_destinations(
            "matching",
            "cipher-3",
            &["SHA256:host"],
        ))
        .unwrap();

        let raw_order: Vec<String> = ks
            .secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .to_vec()
            .unwrap()
            .into_iter()
            .map(|bytes| SSHKeyData::try_from(bytes).unwrap().name().clone())
            .collect();

        let result = names_in_order(&ks, None);

        assert_eq!(result, raw_order);
    }

    #[test]
    fn test_get_all_propagates_parse_error_for_malformed_stored_entry() {
        // A malformed entry (however it got into the store) must still surface as an error rather
        // than being silently skipped — this preserves the pre-existing
        // collect::<Result<Vec<_>, _>>() short-circuit-on-first-error behavior.
        let ks = InMemoryEncryptedKeyStore::new();
        let valid =
            create_test_keydata_ed25519_with_destinations("valid", "cipher-1", &["SHA256:host"]);
        ks.insert(valid).unwrap();

        let malformed_key = PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: vec![0, 1, 2, 3],
        };
        ks.secure_memory
            .lock()
            .expect("Mutex is not poisoned")
            .put(malformed_key, b"not valid rkyv bytes");

        let result = ks.get_all_public_keys_and_names(Some("SHA256:host"));

        assert!(result.is_err());
    }
}
