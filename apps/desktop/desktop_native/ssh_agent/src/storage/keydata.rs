//! Contains structures that bridge between raw cryptographic keys and Bitwarden's business logic
//! data.

use crate::crypto::{PrivateKey, PublicKey};

/// Represents SSH key that is queryable.
///
/// Allows abstracting over different key data implementations,
/// for mocking in tests without requiring actual cryptographic keys.
#[cfg_attr(test, mockall::automock)]
pub trait QueryableKeyData: Send + Sync {
    /// # Returns
    ///
    /// A reference to the [`PublicKey`].
    fn public_key(&self) -> &PublicKey;

    /// # Returns
    ///
    /// A reference to the human-readable name for this key.
    fn name(&self) -> &String;

    /// # Returns
    ///
    /// A reference to the cipher ID that links this key to a vault entry.
    fn cipher_id(&self) -> &String;
}

/// Represents an SSH key and its associated metadata.
#[derive(Clone)]
pub struct SSHKeyData {
    /// Private key of the key pair
    pub(super) private_key: PrivateKey,
    /// Public key of the key pair
    pub(super) public_key: PublicKey,
    /// Human-readable name
    pub(super) name: String,
    /// Vault cipher ID associated with the key pair
    pub(super) cipher_id: String,
}

impl SSHKeyData {
    /// Creates a new `SSHKeyData` instance.
    ///
    /// # Arguments
    ///
    /// * `private_key` - The private key component
    /// * `public_key` - The public key component
    /// * `name` - A human-readable name for the key
    /// * `cipher_id` - The vault cipher identifier associated with this key
    pub fn new(
        private_key: PrivateKey,
        public_key: PublicKey,
        name: String,
        cipher_id: String,
    ) -> Self {
        Self {
            private_key,
            public_key,
            name,
            cipher_id,
        }
    }

    /// # Returns
    ///
    /// A reference to the [`PrivateKey`].
    pub fn private_key(&self) -> &PrivateKey {
        &self.private_key
    }
}

impl QueryableKeyData for SSHKeyData {
    fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    fn name(&self) -> &String {
        &self.name
    }

    fn cipher_id(&self) -> &String {
        &self.cipher_id
    }
}
