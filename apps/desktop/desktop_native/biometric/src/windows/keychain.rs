//! Persistent storage of Windows Hello biometric enrollments in the OS keychain.
//!
//! Each enrollment stores the [`Challenge`] used to derive the Windows Hello PRF together with the
//! sealed vault unlock key. Since the keychain is readable by all userspace processes, the
//! challenge is not secret; the security comes from requiring a Windows Hello prompt to re-derive
//! the PRF.

use anyhow::{anyhow, Result};
use bitwarden_crypto::safe::SecretProtectedKeyEnvelope;
use desktop_core::password::{self, PASSWORD_NOT_FOUND};
use tracing::{debug, warn};

use super::encryption::Challenge;

pub(crate) const KEYCHAIN_SERVICE_NAME: &str = "BitwardenBiometricsV2";

/// V1 keychain entry: the user key is wrapped directly with XChaCha20Poly1305 using the
/// Windows Hello-derived PRF as a key.
#[derive(serde::Serialize, serde::Deserialize)]
pub(crate) struct WindowsHelloKeychainEntryV1 {
    pub(crate) nonce: [u8; super::encryption::XCHACHA20POLY1305_NONCE_LENGTH],
    pub(crate) challenge: Challenge,
    pub(crate) wrapped_key: Vec<u8>,
}

/// V2 keychain entry: the user key is sealed in a [`SecretProtectedKeyEnvelope`]. The `challenge`
/// is still stored because it is the input used to re-derive the Windows Hello PRF.
#[derive(serde::Serialize, serde::Deserialize)]
pub(crate) struct WindowsHelloKeychainEntryV2 {
    pub(crate) challenge: Challenge,
    pub(crate) envelope: SecretProtectedKeyEnvelope,
}

#[derive(serde::Deserialize)]
#[serde(untagged)]
#[allow(clippy::large_enum_variant)]
pub(crate) enum WindowsHelloKeychainEntry {
    //The two formats have disjoint required fields (`envelope` vs
    // `nonce` + `wrapped_key`), so untagged deserialization unambiguously deserializes to the
    // correct variant
    V2(WindowsHelloKeychainEntryV2),
    V1(WindowsHelloKeychainEntryV1),
}

pub(crate) async fn set_entry(user_id: &str, entry: &WindowsHelloKeychainEntryV2) -> Result<()> {
    password::set_password(
        KEYCHAIN_SERVICE_NAME,
        user_id,
        &serde_json::to_string(entry)?,
    )
    .await
}

pub(crate) async fn get_entry(user_id: &str) -> Result<WindowsHelloKeychainEntry> {
    serde_json::from_str(&password::get_password(KEYCHAIN_SERVICE_NAME, user_id).await?)
        .map_err(|e| anyhow!(e))
}

pub(crate) async fn delete_entry(user_id: &str) -> Result<()> {
    password::delete_password(KEYCHAIN_SERVICE_NAME, user_id)
        .await
        .or_else(|e| {
            if e.to_string() == PASSWORD_NOT_FOUND {
                debug!(
                    "[Windows Hello] No keychain entry found for user {}, nothing to delete",
                    user_id
                );
                Ok(())
            } else {
                Err(e)
            }
        })
}

pub(crate) async fn has_entry(user_id: &str) -> Result<bool> {
    password::get_password(KEYCHAIN_SERVICE_NAME, user_id)
        .await
        .map(|entry| !entry.is_empty())
        .or_else(|e| {
            if e.to_string() == PASSWORD_NOT_FOUND {
                Ok(false)
            } else {
                warn!(
                    "[Windows Hello] Error checking keychain entry for user {}: {}",
                    user_id, e
                );
                Err(e)
            }
        })
}

#[cfg(test)]
mod tests {
    use super::{super::encryption::CHALLENGE_LENGTH, WindowsHelloKeychainEntry};

    const TEST_VECTOR_CHALLENGE: [u8; CHALLENGE_LENGTH] =
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const TEST_VECTOR_NONCE: [u8; super::super::encryption::XCHACHA20POLY1305_NONCE_LENGTH] = [
        200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217,
        218, 219, 220, 221, 222, 223,
    ];
    const TEST_VECTOR_WRAPPED_KEY: &[u8] = &[90, 91, 92, 93, 94, 95];

    // Test-vectors for th v1 and v2 keychain entries. Note: These are not cryptographically
    // meaningful, just enough to ensure the serialization works.
    const TEST_VECTOR_V2_JSON: &str = r#"{"challenge":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"envelope":"hFg0pAEDA3giYXBwbGljYXRpb24veC5iaXR3YXJkZW4ubGVnYWN5LWtleToAATiBBjoAATiAAqEFTJX+FbmsYy42SWrfHFhQI16UOuY0GTZtLbTetv+Wqj6lVecK8DtCRcyn/e1ULGKaf13Q9tXSrg4rJl4v8GKIJv361FCsgOZ8kxzN7qUDFAUIGYEEW2hDG7kWOVkD56GBg0CiASkzWCAqKJNBFc+VbkGF4V0sv5HXgCn4CcMpw8/UGHyrvP95v/Y="}"#;
    const TEST_VECTOR_V1_JSON: &str = r#"{"nonce":[200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223],"challenge":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],"wrapped_key":[90,91,92,93,94,95]}"#;

    /// A recorded current-format entry must keep deserializing to the `V2` variant with its
    /// challenge intact.
    #[test]
    fn test_keychain_entry_v2_format_vector() {
        let entry: WindowsHelloKeychainEntry = serde_json::from_str(TEST_VECTOR_V2_JSON).unwrap();
        let WindowsHelloKeychainEntry::V2(entry) = entry else {
            panic!("A challenge+envelope entry must deserialize to the V2 variant");
        };
        assert_eq!(entry.challenge.as_bytes(), &TEST_VECTOR_CHALLENGE);
    }

    /// A recorded legacy entry must keep deserializing to the `V1` variant with its fields intact,
    /// and re-serialize to the exact stored bytes. This guards backward compatibility for
    /// enrollments created before the envelope format.
    #[test]
    fn test_keychain_entry_v1_format_vector() {
        let entry: WindowsHelloKeychainEntry = serde_json::from_str(TEST_VECTOR_V1_JSON).unwrap();
        let WindowsHelloKeychainEntry::V1(entry) = entry else {
            panic!("A nonce+challenge+wrapped_key entry must deserialize to the V1 variant");
        };
        assert_eq!(entry.nonce, TEST_VECTOR_NONCE);
        assert_eq!(entry.challenge.as_bytes(), &TEST_VECTOR_CHALLENGE);
        assert_eq!(entry.wrapped_key, TEST_VECTOR_WRAPPED_KEY);
        assert_eq!(serde_json::to_string(&entry).unwrap(), TEST_VECTOR_V1_JSON);
    }
}
