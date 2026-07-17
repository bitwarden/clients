//! Cryptographic core of the Windows Hello biometric unlock.
//!
//! Everything here is platform-independent cryptography built on top of a Windows Hello signature.
//! A [`Challenge`] is signed by Windows Hello to produce a deterministic signature, which is hashed
//! into a high-entropy [`WindowsHelloPrf`]. That PRF is then used as a key to wrap and unwrap the
//! vault user key ([`SymmetricCryptoKey`]) in a keychain entry.
//!
//! The Windows Hello API calls that produce the signature live in [`super::keycredentialmanager`].

use aes::cipher::KeyInit;
use anyhow::{anyhow, Result};
use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey};
use chacha20poly1305::{aead::Aead, XChaCha20Poly1305, XNonce};
use rand_core::Rng;
use sha2::{Digest, Sha256};

use super::keychain::WindowsHelloKeychainEntry;

pub(crate) const CHALLENGE_LENGTH: usize = 16;
pub(crate) const PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH: usize = 32;
pub(super) const XCHACHA20POLY1305_NONCE_LENGTH: usize = 24;

/// A per-enrollment random challenge that is signed by Windows Hello to derive the
/// [`WindowsHelloPrf`].
///
/// The challenge is stored alongside the protected key so the same PRF output can be re-derived on
/// unlock. Because the challenge is stored in the (userspace-readable) keychain, it is not secret;
/// the security comes from requiring a Windows Hello prompt to produce the signature.
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub(crate) struct Challenge([u8; CHALLENGE_LENGTH]);

impl Challenge {
    /// Generates a new random challenge.
    pub(crate) fn make() -> Self {
        let mut bytes = [0u8; CHALLENGE_LENGTH];
        bitwarden_random::rng().fill_bytes(&mut bytes);
        Self(bytes)
    }

    pub(super) fn as_bytes(&self) -> &[u8; CHALLENGE_LENGTH] {
        &self.0
    }

    #[cfg(test)]
    pub(crate) fn from_bytes(bytes: [u8; CHALLENGE_LENGTH]) -> Self {
        Self(bytes)
    }
}

/// The pseudorandom output derived from Windows Hello for a given [`Challenge`]. This is used as
/// the key to protect the vault unlock key.
///
/// The prf is a SHA-256 digest of a Windows Hello signature.
#[derive(Clone)]
pub(crate) struct WindowsHelloPrf([u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]);

impl WindowsHelloPrf {
    pub(crate) fn as_bytes(&self) -> &[u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH] {
        &self.0
    }

    /// Derive the PRF output from a raw Windows Hello signature
    ///
    /// The signature is deterministic based on the challenge and keychain key, so hashing it yields
    /// a stable key. It is unclear what entropy this key provides.
    pub(super) fn derive_from_signature(signature: &[u8]) -> Self {
        Self(Sha256::digest(signature).into())
    }

    #[cfg(test)]
    pub(crate) fn from_bytes(bytes: [u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]) -> Self {
        Self(bytes)
    }
}

impl WindowsHelloKeychainEntry {
    /// Seal `user_key` by wrapping its encoded bytes with XChaCha20Poly1305 under the Windows
    /// Hello-derived PRF.
    pub(super) fn seal(
        challenge: Challenge,
        windows_hello_key: &WindowsHelloPrf,
        user_key: &SymmetricCryptoKey,
    ) -> Result<Self> {
        let cipher = XChaCha20Poly1305::new(windows_hello_key.as_bytes().into());
        let mut nonce = [0u8; XCHACHA20POLY1305_NONCE_LENGTH];
        bitwarden_random::rng().fill_bytes(&mut nonce);
        let wrapped_key = cipher
            .encrypt(
                XNonce::from_slice(&nonce),
                user_key.to_encoded().to_vec().as_slice(),
            )
            .map_err(|e| anyhow!(e))?;
        Ok(Self {
            nonce,
            challenge,
            wrapped_key,
        })
    }

    /// Unseal the user key.
    pub(super) fn unseal(&self, windows_hello_key: &WindowsHelloPrf) -> Result<SymmetricCryptoKey> {
        let cipher = XChaCha20Poly1305::new(windows_hello_key.as_bytes().into());
        let decrypted = cipher
            .decrypt(XNonce::from_slice(&self.nonce), self.wrapped_key.as_slice())
            .map_err(|e| anyhow!(e))?;
        SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(decrypted))
            .map_err(|e| anyhow!("Failed to parse user key: {e}"))
    }
}

#[cfg(test)]
mod tests {
    use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey, SymmetricKeyAlgorithm};

    use super::{
        super::keychain::WindowsHelloKeychainEntry, Challenge, WindowsHelloPrf, CHALLENGE_LENGTH,
        PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH,
    };

    fn user_key(encoded: &[u8]) -> SymmetricCryptoKey {
        SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(encoded.to_vec())).unwrap()
    }

    #[test]
    fn test_seal_unseal_roundtrip() {
        let windows_hello_key =
            WindowsHelloPrf::from_bytes([42u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]);

        // Cover both a legacy AES-CBC-HMAC user key and a modern (COSE) XChaCha20Poly1305 key.
        for key in [
            SymmetricCryptoKey::make(SymmetricKeyAlgorithm::Aes256CbcHmac),
            SymmetricCryptoKey::make(SymmetricKeyAlgorithm::Aes256Gcm),
        ] {
            let entry = WindowsHelloKeychainEntry::seal(
                Challenge::from_bytes([0u8; CHALLENGE_LENGTH]),
                &windows_hello_key,
                &key,
            )
            .unwrap();
            let unsealed = entry.unseal(&windows_hello_key).unwrap();
            assert_eq!(unsealed.to_encoded().to_vec(), key.to_encoded().to_vec());
        }
    }

    #[test]
    fn test_unseal_with_wrong_secret_fails() {
        let entry = WindowsHelloKeychainEntry::seal(
            Challenge::from_bytes([0u8; CHALLENGE_LENGTH]),
            &WindowsHelloPrf::from_bytes([42u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]),
            &user_key(&[9u8; 64]),
        )
        .unwrap();
        // A different Windows Hello key must not unseal the entry.
        assert!(entry
            .unseal(&WindowsHelloPrf::from_bytes(
                [7u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]
            ))
            .is_err());
    }
}
