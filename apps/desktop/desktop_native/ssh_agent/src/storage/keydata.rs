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
    #[must_use]
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
    #[must_use]
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

#[cfg(test)]
mod tests {
    use super::*;

    // Synthetic sk-ssh-ed25519@openssh.com key (FIDO2 resident key).
    // Generated with zeroed dummy key data — valid wire format, not a real keypair.
    const TEST_SK_ED25519_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAASgAAABpzay1zc2
gtZWQyNTUxOUBvcGVuc3NoLmNvbQAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAARzc2g6AAAAiHneT6B53k+gAAAAGnNrLXNzaC1lZDI1NTE5QG9wZW5zc2guY2
9tAAAAIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABHNzaDoAAAAAEAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAE3NrLXRlc3RAZXhhbXBsZS5jb20BAgMEBQY=
-----END OPENSSH PRIVATE KEY-----";

    #[test]
    fn test_from_private_key_pem_safely_rejects_unsupported_key_type() {
        let result = SSHKeyData::from_private_key_pem(
            TEST_SK_ED25519_PEM,
            "sk-test".to_string(),
            "cipher-sk-1".to_string(),
        );

        assert!(result.is_err(), "sk-ssh-ed25519 key type must be rejected");
    }
}
