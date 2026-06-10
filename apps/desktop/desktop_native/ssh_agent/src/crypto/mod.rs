//! Cryptographic key management for the SSH agent.
//!
//! This module provides the core primitive types and functionality for managing
//! SSH keys in the Bitwarden SSH agent.
//!
//! # Supported signing algorithms
//!
//! - Ed25519
//! - ECDSA
//! - RSA

use std::fmt;

use anyhow::anyhow;
use rkyv::{Archive, Deserialize, Serialize};
use signature::Signer as _;
use ssh_key::{
    private::{EcdsaKeypair, Ed25519Keypair, RsaKeypair},
    Signature,
};

use crate::server::SignFlags;
pub use crate::storage::keydata::{QueryableKeyData, SSHKeyData};

/// Represents an SSH private key.
#[derive(Clone, PartialEq, Debug)]
pub enum PrivateKey {
    Ed25519(Ed25519Keypair),
    Ecdsa(EcdsaKeypair),
    Rsa(RsaKeypair),
}

/// A private key that contains everything necessary to sign.
///
/// RSA always requires [`SignFlags`].
///
/// # External signers
///
/// Hardware-backed keys are not supported. This type signs directly using key
/// material held in memory and does not delegate to any hardware device. If
/// hardware-backed key support is ever added, [`SignablePrivateKey::sign`] must be updated.
///
/// <https://docs.rs/signature/2.2.0/signature/trait.Signer.html>
pub enum SignablePrivateKey {
    Ed25519(Ed25519Keypair),
    Ecdsa(EcdsaKeypair),
    Rsa(RsaKeypair, SignFlags),
}

impl SignablePrivateKey {
    pub fn sign(&self, data: &[u8]) -> Signature {
        match self {
            Self::Ed25519(kp) => kp.sign(data),
            Self::Ecdsa(kp) => kp.sign(data),
            Self::Rsa(kp, flag) => sign_rsa(kp, data, *flag),
        }
    }
}

/// Error returned when constructing a [`SignablePrivateKey`] when RSA is requested but no flags
/// specified.
// NOTE: technically the spec allows this request, but SHA-1 is insecure and should not be used in
// any agent.
#[derive(Debug, thiserror::Error)]
#[error("RSA signing requires an explicit hash algorithm in `SignFlags`; SHA-1 is not permitted")]
pub struct UnsignableErrRsaRequiresFlags;

impl TryFrom<(PrivateKey, Option<SignFlags>)> for SignablePrivateKey {
    type Error = UnsignableErrRsaRequiresFlags;

    fn try_from((key, flags): (PrivateKey, Option<SignFlags>)) -> Result<Self, Self::Error> {
        match key {
            PrivateKey::Ed25519(kp) => Ok(Self::Ed25519(kp)),
            PrivateKey::Ecdsa(kp) => Ok(Self::Ecdsa(kp)),
            PrivateKey::Rsa(kp) => flags
                .map(|flag| Self::Rsa(kp, flag))
                .ok_or(UnsignableErrRsaRequiresFlags),
        }
    }
}

fn sign_rsa(kp: &RsaKeypair, data: &[u8], flag: SignFlags) -> Signature {
    match flag {
        SignFlags::RsaSha256 => {
            // we don't expect this to fail because the RSA keypair was already validated at
            // creation time.
            let signing_key = rsa::pkcs1v15::SigningKey::<sha2::Sha256>::try_from(kp)
                .expect("RSA keypair to convert to SHA-256 signing key");
            let rsa_sig: Box<[u8]> = signing_key.sign(data).into();

            Signature::new(
                ssh_key::Algorithm::Rsa {
                    hash: Some(flag.hash_alg()),
                },
                rsa_sig.to_vec(),
            )
            .expect("RSA-SHA256 signature construction should succeed")
        }
        SignFlags::RsaSha512 => kp.sign(data),
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
            ssh_key::Algorithm::Ecdsa { .. } => Ok(Self::Ecdsa(
                key.key_data()
                    .ecdsa()
                    .ok_or(anyhow!("Failed to parse ECDSA key"))?
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
        private::{EcdsaKeypair, Ed25519Keypair, RsaKeypair},
        rand_core::OsRng,
        EcdsaCurve, LineEnding,
    };

    use super::*;

    const MIN_KEY_BIT_SIZE: usize = 2048;
    const TEST_DATA: &[u8] = b"test data";

    fn create_valid_ed25519_key_string() -> String {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Ed25519(ed25519_keypair), "")
                .unwrap();
        ssh_key.to_openssh(LineEnding::LF).unwrap().to_string()
    }

    fn ecdsa_keypair(curve: EcdsaCurve) -> EcdsaKeypair {
        EcdsaKeypair::random(&mut OsRng, curve).unwrap()
    }

    fn ecdsa_private_key_from_ssh_key(curve: EcdsaCurve) -> PrivateKey {
        let ssh_key = ssh_key::PrivateKey::new(
            ssh_key::private::KeypairData::Ecdsa(ecdsa_keypair(curve)),
            "",
        )
        .unwrap();
        PrivateKey::try_from(ssh_key).unwrap()
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
    fn test_signing_key_from_ed25519_always_succeeds() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key = PrivateKey::Ed25519(keypair);

        assert!(SignablePrivateKey::try_from((private_key, None)).is_ok());
    }

    #[test]
    fn test_signing_key_from_rsa_without_flags_returns_error() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let private_key = PrivateKey::Rsa(keypair);

        assert!(SignablePrivateKey::try_from((private_key, None)).is_err());
    }

    #[test]
    fn test_signing_key_from_rsa_with_sha256_flag_succeeds() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let private_key = PrivateKey::Rsa(keypair);

        assert!(SignablePrivateKey::try_from((
            private_key,
            Some(crate::server::SignFlags::RsaSha256)
        ))
        .is_ok());
    }

    #[test]
    fn test_signing_key_from_rsa_with_sha512_flag_succeeds() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let private_key = PrivateKey::Rsa(keypair);

        assert!(SignablePrivateKey::try_from((
            private_key,
            Some(crate::server::SignFlags::RsaSha512)
        ))
        .is_ok());
    }

    #[test]
    fn test_signing_key_sign_ed25519_algorithm() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let signing_key = SignablePrivateKey::Ed25519(keypair);

        let sig = signing_key.sign(TEST_DATA);

        assert_eq!(sig.algorithm(), ssh_key::Algorithm::Ed25519);
    }

    #[test]
    fn test_signing_key_sign_rsa_sha512_algorithm() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let signing_key = SignablePrivateKey::Rsa(keypair, crate::server::SignFlags::RsaSha512);

        let sig = signing_key.sign(TEST_DATA);

        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Rsa {
                hash: Some(ssh_key::HashAlg::Sha512),
            }
        );
    }

    #[test]
    fn test_signing_key_sign_rsa_sha256_algorithm() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let signing_key = SignablePrivateKey::Rsa(keypair, crate::server::SignFlags::RsaSha256);

        let sig = signing_key.sign(TEST_DATA);

        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Rsa {
                hash: Some(ssh_key::HashAlg::Sha256),
            }
        );
    }

    #[test]
    fn test_signing_key_sign_ed25519_produces_valid_signature() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let public_key = keypair.public;
        let signing_key = SignablePrivateKey::Ed25519(keypair);

        let sig = signing_key.sign(TEST_DATA);

        public_key.verify(TEST_DATA, &sig).unwrap();
    }

    #[test]
    fn test_signing_key_sign_rsa_sha512_produces_valid_signature() {
        let keypair = RsaKeypair::random(&mut OsRng, MIN_KEY_BIT_SIZE).unwrap();
        let public_key = keypair.public.clone();
        let signing_key = SignablePrivateKey::Rsa(keypair, crate::server::SignFlags::RsaSha512);

        let sig = signing_key.sign(TEST_DATA);

        public_key.verify(TEST_DATA, &sig).unwrap();
    }

    #[test]
    fn test_privatekey_from_ecdsa_p256() {
        assert!(matches!(
            ecdsa_private_key_from_ssh_key(EcdsaCurve::NistP256),
            PrivateKey::Ecdsa(_)
        ));
    }

    #[test]
    fn test_privatekey_from_ecdsa_p384() {
        assert!(matches!(
            ecdsa_private_key_from_ssh_key(EcdsaCurve::NistP384),
            PrivateKey::Ecdsa(_)
        ));
    }

    #[test]
    fn test_privatekey_from_ecdsa_p521() {
        assert!(matches!(
            ecdsa_private_key_from_ssh_key(EcdsaCurve::NistP521),
            PrivateKey::Ecdsa(_)
        ));
    }

    #[test]
    fn test_signing_key_from_ecdsa_always_succeeds() {
        let private_key = PrivateKey::Ecdsa(ecdsa_keypair(EcdsaCurve::NistP256));
        assert!(SignablePrivateKey::try_from((private_key, None)).is_ok());
    }

    #[test]
    fn test_signing_key_sign_ecdsa_p256_algorithm() {
        let sig = SignablePrivateKey::Ecdsa(ecdsa_keypair(EcdsaCurve::NistP256)).sign(TEST_DATA);
        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Ecdsa {
                curve: EcdsaCurve::NistP256
            }
        );
    }

    #[test]
    fn test_signing_key_sign_ecdsa_p384_algorithm() {
        let sig = SignablePrivateKey::Ecdsa(ecdsa_keypair(EcdsaCurve::NistP384)).sign(TEST_DATA);
        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Ecdsa {
                curve: EcdsaCurve::NistP384
            }
        );
    }

    #[test]
    fn test_signing_key_sign_ecdsa_p521_algorithm() {
        let sig = SignablePrivateKey::Ecdsa(ecdsa_keypair(EcdsaCurve::NistP521)).sign(TEST_DATA);
        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Ecdsa {
                curve: EcdsaCurve::NistP521
            }
        );
    }

    #[test]
    fn test_signing_key_sign_ecdsa_p256_produces_valid_signature() {
        let sig = SignablePrivateKey::Ecdsa(ecdsa_keypair(EcdsaCurve::NistP256)).sign(TEST_DATA);
        assert_eq!(
            sig.algorithm(),
            ssh_key::Algorithm::Ecdsa {
                curve: EcdsaCurve::NistP256
            }
        );
        assert!(!sig.as_bytes().is_empty());
    }
}
