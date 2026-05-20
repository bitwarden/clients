//! Cryptographic key management for the SSH agent.
//!
//! This module provides the core primitive types and functionality for managing
//! SSH keys in the Bitwarden SSH agent.
//!
//! # Supported signing algorithms
//!
//! - Ed25519
//! - RSA
//!
//! ECDSA keys are not currently supported (PM-29894)

use std::fmt;

use anyhow::anyhow;
use rkyv::{Archive, Deserialize, Serialize};
use signature::Signer as _;
use ssh_key::{
    private::{Ed25519Keypair, RsaKeypair},
    Signature,
};

pub use crate::storage::keydata::{QueryableKeyData, SSHKeyData};

/// Represents an SSH private key.
///
/// # External signers
///
/// Hardware-backed keys are not supported. If hardware-backed key support is ever added, the
/// [`PrivateKey::sign`] function must be updated accordingly; see it for more details.
#[derive(Clone, PartialEq, Debug)]
pub enum PrivateKey {
    Ed25519(Ed25519Keypair),
    Rsa(RsaKeypair),
}

impl PrivateKey {
    /// Signs the provided data using this private key.
    ///
    /// # Returns
    ///
    /// A [`Signature`] containing the algorithm identifier and raw signature bytes.
    ///
    /// # External signers
    ///
    /// Hardware-backed keys are not supported by the SSH Agent feature. This function signs
    /// directly using key material held in memory and does not delegate to any hardware device. If
    /// hardware-backed key support is ever added, this function must be updated. Consult the
    /// following for more information.
    ///
    /// <https://docs.rs/signature/2.2.0/signature/trait.Signer.html>
    pub fn sign(&self, data: &[u8]) -> Signature {
        match self {
            Self::Ed25519(kp) => kp.sign(data),
            Self::Rsa(kp) => kp.sign(data),
        }
    }
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
pub struct PublicKey {
    pub alg: String,
    pub blob: Vec<u8>,
}

impl PublicKey {
    #[must_use]
    pub fn alg(&self) -> &str {
        &self.alg
    }

    #[must_use]
    pub fn blob(&self) -> &[u8] {
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
    use signature::Verifier as _;
    use ssh_key::{
        private::{Ed25519Keypair, RsaKeypair},
        rand_core::OsRng,
        LineEnding,
    };

    use super::*;

    const MIN_KEY_BIT_SIZE: usize = 2048;

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
        let rsa_keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Rsa(rsa_keypair), "").unwrap();

        let private_key = PrivateKey::try_from(ssh_key).unwrap();
        assert!(matches!(private_key, PrivateKey::Rsa(_)));
    }

    #[test]
    fn test_privatekey_sign_ed25519_algorithm() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key = PrivateKey::Ed25519(keypair);
        const TEST_DATA: &[u8] = b"test data";

        let sig = private_key.sign(TEST_DATA);

        assert_eq!(sig.algorithm(), ssh_key::Algorithm::Ed25519);
    }

    #[test]
    fn test_privatekey_sign_rsa_algorithm() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let private_key = PrivateKey::Rsa(keypair);
        const TEST_DATA: &[u8] = b"test data";

        let sig = private_key.sign(TEST_DATA);

        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Rsa {
                hash: Some(ssh_key::HashAlg::Sha512),
            }
        );
    }

    #[test]
    fn test_privatekey_sign_ed25519_signature() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let public_key = keypair.public;
        let private_key = PrivateKey::Ed25519(keypair);
        const TEST_DATA: &[u8] = b"test data";

        let sig = private_key.sign(TEST_DATA);

        public_key.verify(TEST_DATA, &sig).unwrap();
    }

    #[test]
    fn test_privatekey_sign_rsa_signature() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let public_key = keypair.public.clone(); // RsaKepair doesn't implement copy
        let private_key = PrivateKey::Rsa(keypair);
        const TEST_DATA: &[u8] = b"test data";

        let sig = private_key.sign(TEST_DATA);

        public_key.verify(TEST_DATA, &sig).unwrap();
    }
}
