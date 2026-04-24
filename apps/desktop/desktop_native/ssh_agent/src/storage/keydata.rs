//! Contains structures that bridge between raw cryptographic keys and Bitwarden's business logic
//! data.

use anyhow::{anyhow, Result};

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

    /// Parses an OpenSSH PEM private key string and constructs an [`SSHKeyData`] instance.
    ///
    /// The public key blob is derived from the private key and stored in SSH wire format
    /// (the output of `ssh_key::PublicKey::to_bytes()`), ready for use in agent protocol
    /// responses without further re-encoding.
    ///
    /// # Errors
    ///
    /// Returns an error if the PEM string cannot be parsed, the public key blob cannot be
    /// encoded, or the key algorithm is unsupported.
    pub fn from_private_key_pem(pem: &str, name: String, cipher_id: String) -> Result<Self> {
        let ssh_key = ssh_key::PrivateKey::from_openssh(pem)
            .map_err(|e| anyhow!("Failed to parse private key: {e}"))?;

        let blob = ssh_key
            .public_key()
            .to_bytes()
            .map_err(|e| anyhow!("Failed to encode public key: {e}"))?;

        let private_key = PrivateKey::try_from(ssh_key)?;

        let alg = match &private_key {
            PrivateKey::Ed25519(_) => "ssh-ed25519",
            PrivateKey::Rsa(_) => "ssh-rsa",
        }
        .to_string();

        Ok(Self::new(
            private_key,
            PublicKey { alg, blob },
            name,
            cipher_id,
        ))
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
