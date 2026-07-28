//! Cryptographic core of the Windows Hello biometric unlock.
//!
//! Everything here is platform-independent cryptography built on top of a Windows Hello signature.
//! A [`Challenge`] is signed by Windows Hello to produce a deterministic signature, which is hashed
//! into a high-entropy [`WindowsHelloPrf`]. That PRF is then used as the high-entropy secret that
//! seals and unseals the vault user key ([`SymmetricCryptoKey`]) in a keychain entry.
//!
//! The Windows Hello API calls that produce the signature, and the keychain persistence of the
//! entries defined here, live in the parent module (`windows.rs`).

use aes::cipher::KeyInit;
use anyhow::{anyhow, Result};
use bitwarden_crypto::{
    key_slot_ids,
    safe::{
        HighEntropySecret, HighEntropySecretSource, SecretProtectedKeyEnvelope,
        SecretProtectedKeyEnvelopeNamespace,
    },
    BitwardenLegacyKeyBytes, KeyStore, SymmetricCryptoKey,
};
use bitwarden_sensitive_value::{Sensitive, SensitiveSlice};
use chacha20poly1305::{aead::Aead, XChaCha20Poly1305, XNonce};
use rand_core::Rng;
use sha2::{Digest, Sha256};

pub(crate) const CHALLENGE_LENGTH: usize = 16;
pub(crate) const PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH: usize = 32;
pub(super) const XCHACHA20POLY1305_NONCE_LENGTH: usize = 24;

/// Unique content-layer namespace for biometric-protected keys.
pub(super) const BIOMETRIC_NAMESPACE: SecretProtectedKeyEnvelopeNamespace =
    SecretProtectedKeyEnvelopeNamespace::DesktopBiometricUnlock;

// The key slots for the biometric module. Only local symmetric keys are used (the user key is
// added via `add_local_symmetric_key`); the private and signing slots exist solely to satisfy the
// `KeySlotIds` contract that `KeyStore` requires.
key_slot_ids! {
    #[symmetric]
    pub enum BiometricSymmetricKey {
        #[local]
        Local(LocalId),
    }

    #[private]
    pub enum BiometricPrivateKey {
        #[local]
        Local(LocalId),
    }

    #[signing]
    pub enum BiometricSigningKey {
        #[local]
        Local(LocalId),
    }

    pub BiometricIds => BiometricSymmetricKey, BiometricPrivateKey, BiometricSigningKey;
}

/// A per-enrollment random challenge that is signed by Windows Hello to derive the
/// [`WindowsHelloPrf`].
///
/// The challenge is stored alongside the protected key so the same PRF output can be re-derived on
/// unlock. Because the challenge is stored in the (userspace-readable) keychain, it is not secret;
/// the security comes from requiring a Windows Hello prompt to produce the signature.
#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub(super) struct Challenge([u8; CHALLENGE_LENGTH]);

impl Challenge {
    /// Generates a new random challenge.
    pub(super) fn make() -> Self {
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
/// the high-entropy secret to protect the vault unlock key.
///
/// The prf is a SHA-256 digest of a Windows Hello signature.
#[derive(Clone)]
pub(super) struct WindowsHelloPrf([u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]);

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

impl HighEntropySecretSource for WindowsHelloPrf {
    fn provide_high_entropy_bytes(&self) -> SensitiveSlice<'_> {
        Sensitive::from(self.0.as_slice())
    }
}

/// V1 keychain entry: the user key is wrapped directly with XChaCha20Poly1305 using the
/// Windows Hello-derived PRF as a key.
#[derive(serde::Serialize, serde::Deserialize)]
pub(super) struct WindowsHelloKeychainEntryV1 {
    pub(super) nonce: [u8; XCHACHA20POLY1305_NONCE_LENGTH],
    pub(super) challenge: Challenge,
    pub(super) wrapped_key: Vec<u8>,
}

/// V2 keychain entry: the user key is sealed in a [`SecretProtectedKeyEnvelope`]. The `challenge`
/// is still stored because it is the input used to re-derive the Windows Hello PRF.
#[derive(serde::Serialize, serde::Deserialize)]
pub(super) struct WindowsHelloKeychainEntryV2 {
    pub(super) challenge: Challenge,
    pub(super) envelope: SecretProtectedKeyEnvelope,
}

#[derive(serde::Deserialize)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
pub(super) enum WindowsHelloKeychainEntry {
    // The two formats have disjoint required fields (`envelope` vs `nonce` + `wrapped_key`), so
    // untagged deserialization unambiguously deserializes to the correct variant.
    V2(WindowsHelloKeychainEntryV2),
    V1(WindowsHelloKeychainEntryV1),
}

impl WindowsHelloKeychainEntryV2 {
    /// Seal `user_key` into a new keychain entry with `challenge`.
    pub(super) fn seal(
        challenge: Challenge,
        windows_hello_key: &WindowsHelloPrf,
        user_key: &SymmetricCryptoKey,
    ) -> Result<Self> {
        let secret = HighEntropySecret::from(windows_hello_key.clone());

        let store = KeyStore::<BiometricIds>::default();
        let mut ctx = store.context_mut();
        let key_id = ctx.add_local_symmetric_key(user_key.clone());
        let envelope = SecretProtectedKeyEnvelope::seal(key_id, &secret, BIOMETRIC_NAMESPACE, &ctx)
            .map_err(|e| anyhow!("Failed to seal user key: {e}"))?;

        Ok(Self {
            challenge,
            envelope,
        })
    }

    /// Unseal the user key from the entry
    pub(super) fn unseal(&self, windows_hello_key: &WindowsHelloPrf) -> Result<SymmetricCryptoKey> {
        let secret = HighEntropySecret::from(windows_hello_key.clone());

        let store = KeyStore::<BiometricIds>::default();
        let mut ctx = store.context_mut();
        let key_id = self
            .envelope
            .unseal(&secret, BIOMETRIC_NAMESPACE, &mut ctx)
            .map_err(|e| anyhow!("Failed to unseal user key: {e}"))?;
        #[allow(deprecated)]
        let user_key = ctx
            .dangerous_get_symmetric_key(key_id)
            .map_err(|e| anyhow!("Failed to read unsealed user key: {e}"))?;
        Ok(user_key.clone())
    }
}

impl WindowsHelloKeychainEntryV1 {
    /// Seal `user_key` by wrapping its encoded bytes with XChaCha20Poly1305 under the Windows
    /// Hello-derived key. Only used by tests to produce legacy entries; the production code path
    /// seals into the [`WindowsHelloKeychainEntryV2`] envelope format.
    #[cfg(test)]
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

    /// Unseal the user key
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
    use aes::cipher::KeyInit;
    use bitwarden_crypto::{BitwardenLegacyKeyBytes, SymmetricCryptoKey, SymmetricKeyAlgorithm};
    use chacha20poly1305::{aead::Aead, XChaCha20Poly1305, XNonce};

    use super::{
        Challenge, WindowsHelloKeychainEntry, WindowsHelloKeychainEntryV1,
        WindowsHelloKeychainEntryV2, WindowsHelloPrf, CHALLENGE_LENGTH,
        PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH, XCHACHA20POLY1305_NONCE_LENGTH,
    };

    fn user_key(encoded: &[u8]) -> SymmetricCryptoKey {
        SymmetricCryptoKey::try_from(&BitwardenLegacyKeyBytes::from(encoded.to_vec())).unwrap()
    }

    // Fixed, deterministic inputs used to produce and verify the test vector below. The Windows
    // Hello key stands in for the PRF that Windows Hello would derive from the challenge; the test
    // never calls Windows, it re-derives the sealing secret directly from these bytes.
    const TEST_VECTOR_WINDOWS_HELLO_KEY: [u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH] =
        [42u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH];
    const TEST_VECTOR_CHALLENGE: [u8; CHALLENGE_LENGTH] =
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    // A valid 64-byte (AES-CBC-HMAC) encoded user key
    const TEST_VECTOR_USER_KEY: &[u8] = &[9u8; 64];

    // A `WindowsHelloKeychainEntryV2` (challenge + `SecretProtectedKeyEnvelope`), serialized
    // exactly as it is persisted to the OS keychain. Sealing with
    // `TEST_VECTOR_WINDOWS_HELLO_KEY` must keep unsealing to `TEST_VECTOR_USER_KEY`; if this
    // stops decoding, the persisted format broke.
    const TEST_VECTOR_ENTRY_V2_JSON: &str = r#"{"challenge":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"envelope":"hFg0pAEDA3giYXBwbGljYXRpb24veC5iaXR3YXJkZW4ubGVnYWN5LWtleToAATiBBjoAATiAAqEFTJX+FbmsYy42SWrfHFhQI16UOuY0GTZtLbTetv+Wqj6lVecK8DtCRcyn/e1ULGKaf13Q9tXSrg4rJl4v8GKIJv361FCsgOZ8kxzN7qUDFAUIGYEEW2hDG7kWOVkD56GBg0CiASkzWCAqKJNBFc+VbkGF4V0sv5HXgCn4CcMpw8/UGHyrvP95v/Y="}"#;

    // Fixed nonce used to wrap the V1 test vector below. V1 seals with a random nonce, but the
    // recorded vector pins one so the ciphertext is reproducible.
    const TEST_VECTOR_NONCE: [u8; XCHACHA20POLY1305_NONCE_LENGTH] = [
        100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
        118, 119, 120, 121, 122, 123,
    ];

    // A `WindowsHelloKeychainEntryV1` (nonce + challenge + XChaCha20Poly1305-wrapped user key),
    // serialized exactly as legacy enrollments are persisted to the OS keychain. Unsealing with
    // `TEST_VECTOR_WINDOWS_HELLO_KEY` must keep yielding `TEST_VECTOR_USER_KEY`; if this stops
    // decoding, backward compatibility for pre-envelope enrollments broke.
    const TEST_VECTOR_ENTRY_V1_JSON: &str = r#"{"nonce":[100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123],"challenge":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"wrapped_key":[81,218,92,229,12,119,8,54,163,227,74,91,121,250,150,67,17,18,87,203,171,52,240,148,22,32,186,221,13,62,88,100,76,134,2,161,8,214,206,255,148,98,112,209,165,238,212,69,206,211,254,102,160,138,69,28,192,20,15,244,244,187,68,159,162,81,235,10,88,16,242,93,161,225,231,48,172,242,125,176]}"#;

    /// Regenerates the constants above. Ignored so it never runs in CI; run manually with
    /// `--ignored --nocapture` and paste the printed constant back into the source.
    #[test]
    #[ignore = "Generates test vectors; run manually"]
    #[allow(clippy::print_stdout)]
    fn generate_test_vectors() {
        let windows_hello_key = WindowsHelloPrf::from_bytes(TEST_VECTOR_WINDOWS_HELLO_KEY);

        let v2 = WindowsHelloKeychainEntryV2::seal(
            Challenge::from_bytes(TEST_VECTOR_CHALLENGE),
            &windows_hello_key,
            &user_key(TEST_VECTOR_USER_KEY),
        )
        .unwrap();

        // Round-trip once here to confirm the generated vector is itself valid.
        let unsealed = v2.unseal(&windows_hello_key).unwrap();
        assert_eq!(unsealed.to_encoded().to_vec(), TEST_VECTOR_USER_KEY);

        println!(
            "const TEST_VECTOR_ENTRY_V2_JSON: &str = r#\"{}\"#;",
            serde_json::to_string(&v2).unwrap()
        );

        // V1 wraps the user key directly with XChaCha20Poly1305. `seal` picks a random nonce, so
        // build the entry with the pinned `TEST_VECTOR_NONCE` to keep the recorded vector stable.
        let cipher = XChaCha20Poly1305::new(windows_hello_key.as_bytes().into());
        let wrapped_key = cipher
            .encrypt(
                XNonce::from_slice(&TEST_VECTOR_NONCE),
                user_key(TEST_VECTOR_USER_KEY)
                    .to_encoded()
                    .to_vec()
                    .as_slice(),
            )
            .unwrap();
        let v1 = WindowsHelloKeychainEntryV1 {
            nonce: TEST_VECTOR_NONCE,
            challenge: Challenge::from_bytes(TEST_VECTOR_CHALLENGE),
            wrapped_key,
        };

        let unsealed = v1.unseal(&windows_hello_key).unwrap();
        assert_eq!(unsealed.to_encoded().to_vec(), TEST_VECTOR_USER_KEY);

        println!(
            "const TEST_VECTOR_ENTRY_V1_JSON: &str = r#\"{}\"#;",
            serde_json::to_string(&v1).unwrap()
        );
    }

    /// Never regenerate the test vector, it would be a breaking change
    #[test]
    fn test_keychain_entry_v2_test_vector() {
        let windows_hello_key = WindowsHelloPrf::from_bytes(TEST_VECTOR_WINDOWS_HELLO_KEY);

        let entry: WindowsHelloKeychainEntry =
            serde_json::from_str(TEST_VECTOR_ENTRY_V2_JSON).unwrap();
        let WindowsHelloKeychainEntry::V2(entry) = entry else {
            panic!("Test vector must decode as a V2 keychain entry");
        };

        let unsealed = entry.unseal(&windows_hello_key).unwrap();
        assert_eq!(unsealed.to_encoded().to_vec(), TEST_VECTOR_USER_KEY);
    }

    /// Never regenerate the test vector, it would be a breaking change
    #[test]
    fn test_keychain_entry_v1_test_vector() {
        let windows_hello_key = WindowsHelloPrf::from_bytes(TEST_VECTOR_WINDOWS_HELLO_KEY);

        let entry: WindowsHelloKeychainEntry =
            serde_json::from_str(TEST_VECTOR_ENTRY_V1_JSON).unwrap();
        let WindowsHelloKeychainEntry::V1(entry) = entry else {
            panic!("Test vector must decode as a V1 keychain entry");
        };

        let unsealed = entry.unseal(&windows_hello_key).unwrap();
        assert_eq!(unsealed.to_encoded().to_vec(), TEST_VECTOR_USER_KEY);
    }

    #[test]
    fn test_v2_seal_unseal_roundtrip() {
        let windows_hello_key =
            WindowsHelloPrf::from_bytes([42u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]);

        // Cover both a legacy AES-CBC-HMAC user key and a modern (COSE) XChaCha20Poly1305 key.
        for key in [
            SymmetricCryptoKey::make(SymmetricKeyAlgorithm::Aes256CbcHmac),
            SymmetricCryptoKey::make(SymmetricKeyAlgorithm::Aes256Gcm),
        ] {
            let entry = WindowsHelloKeychainEntryV2::seal(
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
    fn test_v1_seal_unseal_roundtrip() {
        let windows_hello_key =
            WindowsHelloPrf::from_bytes([42u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]);

        for encoded in [vec![7u8; 32], vec![9u8; 64]] {
            let entry = WindowsHelloKeychainEntryV1::seal(
                Challenge::from_bytes([0u8; CHALLENGE_LENGTH]),
                &windows_hello_key,
                &user_key(&encoded),
            )
            .unwrap();
            let unsealed = entry.unseal(&windows_hello_key).unwrap();
            assert_eq!(unsealed.to_encoded().to_vec(), encoded);
        }
    }

    #[test]
    fn test_unseal_with_wrong_secret_fails() {
        let entry = WindowsHelloKeychainEntryV2::seal(
            Challenge::from_bytes([0u8; CHALLENGE_LENGTH]),
            &WindowsHelloPrf::from_bytes([42u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]),
            &user_key(&[9u8; 64]),
        )
        .unwrap();
        // A different Windows Hello key must not unseal the envelope.
        assert!(entry
            .unseal(&WindowsHelloPrf::from_bytes(
                [7u8; PSEUDORANDOM_WINDOWS_HELLO_OUTPUT_LENGTH]
            ))
            .is_err());
    }
}
