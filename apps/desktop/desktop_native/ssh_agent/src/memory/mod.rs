//! This module implements memory storage for the SSH agent. The current
//! implementation caches the keys in memory, and ideally uses platform secure memory APIs.

use crate::protocol::types::{KeyPair, PublicKeyWithName};

struct LockedSshItem {
    public_key: PublicKeyWithName,
    cipher_id: String,
}

#[derive(Clone)]
pub struct UnlockedSshItem {
    pub(crate) key_pair: KeyPair,
    cipher_id: String,
}

impl UnlockedSshItem {
    pub fn new(key_pair: KeyPair, cipher_id: String) -> Self {
        Self {
            key_pair,
            cipher_id,
        }
    }
}

pub(crate) struct LockedKeyStore {
    keys: Vec<LockedSshItem>,
}

pub(crate) struct UnlockedKeyStore {
    keys: Vec<UnlockedSshItem>,
}

pub(crate) enum KeyStore {
    Locked(LockedKeyStore),
    Unlocked(UnlockedKeyStore),
}

impl KeyStore {
    pub fn new() -> Self {
        KeyStore::Locked(LockedKeyStore { keys: vec![] })
    }

    pub fn lock(&mut self) {
        if let KeyStore::Unlocked(unlocked) = self {
            let keys = unlocked
                .keys
                .iter()
                .map(|kp| LockedSshItem {
                    public_key: PublicKeyWithName::new(
                        kp.key_pair.public_key().clone(),
                        kp.key_pair.name().to_string(),
                    ),
                    cipher_id: kp.cipher_id.clone(),
                })
                .collect();
            *self = KeyStore::Locked(LockedKeyStore { keys });
        }
    }

    pub fn set_unlocked(&mut self, keys: Vec<UnlockedSshItem>) {
        *self = KeyStore::Unlocked(UnlockedKeyStore { keys });
    }

    pub fn list_keys(&self) -> Vec<PublicKeyWithName> {
        match self {
            KeyStore::Locked(locked) => locked
                .keys
                .iter()
                .map(|item| item.public_key.clone())
                .collect(),
            KeyStore::Unlocked(unlocked) => unlocked
                .keys
                .iter()
                .map(|item| {
                    PublicKeyWithName::new(
                        item.key_pair.public_key().clone(),
                        item.key_pair.name().to_string(),
                    )
                })
                .collect(),
        }
    }

    pub fn get_unlocked_keypair(
        &self,
        public_key: &crate::protocol::types::PublicKey,
    ) -> Option<UnlockedSshItem> {
        if let KeyStore::Unlocked(unlocked) = self {
            for item in &unlocked.keys {
                if *item.key_pair.public_key() == *public_key {
                    return Some(item.clone());
                }
            }
        }
        None
    }

    pub fn get_cipher_id(&self, public_key: &crate::protocol::types::PublicKey) -> Option<String> {
        if let KeyStore::Locked(locked) = self {
            for item in &locked.keys {
                if item.public_key.key == *public_key {
                    return Some(item.cipher_id.clone());
                }
            }
        } else if let KeyStore::Unlocked(unlocked) = self {
            for item in &unlocked.keys {
                if *item.key_pair.public_key() == *public_key {
                    return Some(item.cipher_id.clone());
                }
            }
        }
        None
    }

    #[allow(unused)]
    pub fn is_locked(&self) -> bool {
        matches!(self, KeyStore::Locked(_))
    }
}
