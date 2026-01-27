//! Cryptographic key management for the SSH agent.
//!
//! This module provides the core primative types and functionality for managing
//! SSH keys in the Bitwarden SSH agent.
//!
//! The module exposes several key types:
//!
//! - [`KeyData`] - Complete SSH key with metadata (private key, public key, name, cipher ID)
//! - [`PrivateKey`] - SSH private key (Ed25519 or RSA)
//! - [`PublicKey`] - SSH public key with algorithm and blob data
//!
//! # Supported Algorithms
//!
//! - Ed25519 keys
//! - RSA keys
//!
//! ECDSA keys are not currently supported (PM-29894)

use std::fmt;

use anyhow::anyhow;
use rkyv::{Archive, Deserialize, Serialize};
use ssh_key::private::{Ed25519Keypair, RsaKeypair};

mod keystore;
mod serialization;

/// Represents an SSH key with its associated metadata.
///
/// Contains the private and public components of an SSH key,
/// along with a human-readable name and the cipher ID from the vault.
#[derive(Clone)]
pub(crate) struct KeyData {
    private_key: PrivateKey,
    public_key: PublicKey,
    name: String,
    cipher_id: String,
}

impl KeyData {
    /// Creates a new `KeyData` instance.
    ///
    /// # Arguments
    ///
    /// * `private_key` - The private key component (Ed25519 or RSA)
    /// * `public_key` - The public key component with algorithm and blob
    /// * `name` - A human-readable name for the key
    /// * `cipher_id` - The vault cipher identifier associated with this key
    ///
    /// # Returns
    ///
    /// A new `KeyData` instance containing all provided key data and metadata.
    pub(crate) fn new(
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
    /// A reference to the [`PublicKey`] containing the algorithm and blob.
    pub(crate) fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    /// # Returns
    ///
    /// A reference to the [`PrivateKey`] enum variant (Ed25519 or RSA).
    pub(crate) fn private_key(&self) -> &PrivateKey {
        &self.private_key
    }

    /// # Returns
    ///
    /// A reference to the human-readable name string for this key.
    pub(crate) fn name(&self) -> &String {
        &self.name
    }

    /// # Returns
    ///
    /// A reference to the cipher ID string that links this key to a vault entry.
    pub(crate) fn cipher_id(&self) -> &String {
        &self.cipher_id
    }
}

/// Represents an SSH private key.
///
/// Supported key types: Ed25519, RSA.
#[derive(Clone, PartialEq, Debug)]
pub(crate) enum PrivateKey {
    Ed25519(Ed25519Keypair),
    Rsa(RsaKeypair),
}

impl TryFrom<ssh_key::private::PrivateKey> for PrivateKey {
    type Error = anyhow::Error;

    fn try_from(key: ssh_key::private::PrivateKey) -> Result<Self, Self::Error> {
        match key.algorithm() {
            ssh_key::Algorithm::Ed25519 => Ok(Self::Ed25519(
                key.key_data()
                    .ed25519()
                    .ok_or(anyhow!("Failed to parse ed25519 key"))?
                    .to_owned(),
            )),
            ssh_key::Algorithm::Rsa { hash: _ } => Ok(Self::Rsa(
                key.key_data()
                    .rsa()
                    .ok_or(anyhow!("Failed to parse RSA key"))?
                    .to_owned(),
            )),
            _ => Err(anyhow!("Unsupported key type")),
        }
    }
}

/// Represents an SSH public key.
///
/// Contains the algorithm identifier (e.g., "ssh-ed25519", "ssh-rsa")
/// and the binary blob of the public key data.
#[derive(Clone, Ord, Eq, PartialOrd, PartialEq, Archive, Serialize, Deserialize)]
pub(crate) struct PublicKey {
    pub alg: String,
    pub blob: Vec<u8>,
}

impl PublicKey {
    pub(crate) fn alg(&self) -> &str {
        &self.alg
    }

    pub(crate) fn blob(&self) -> &[u8] {
        &self.blob
    }
}

impl fmt::Debug for PublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "PublicKey(\"{self}\")")
    }
}

impl fmt::Display for PublicKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        use base64::{prelude::BASE64_STANDARD, Engine as _};

        write!(f, "{} {}", self.alg(), BASE64_STANDARD.encode(self.blob()))
    }
}

#[cfg(test)]
mod tests {
    use ssh_key::{
        private::{Ed25519Keypair, RsaKeypair},
        rand_core::OsRng,
        LineEnding,
    };

    use super::*;

    fn create_valid_ed25519_key_string() -> String {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Ed25519(ed25519_keypair), "")
                .unwrap();
        ssh_key.to_openssh(LineEnding::LF).unwrap().to_string()
    }

    #[test]
    fn test_privatekey_from_ed25519() {
        let key_string = create_valid_ed25519_key_string();
        let ssh_key = ssh_key::PrivateKey::from_openssh(&key_string).unwrap();

        let private_key = PrivateKey::try_from(ssh_key).unwrap();
        assert!(matches!(private_key, PrivateKey::Ed25519(_)));
    }

    #[test]
    fn test_privatekey_from_rsa() {
        let rsa_keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Rsa(rsa_keypair), "").unwrap();

        let private_key = PrivateKey::try_from(ssh_key).unwrap();
        assert!(matches!(private_key, PrivateKey::Rsa(_)));
    }
}
