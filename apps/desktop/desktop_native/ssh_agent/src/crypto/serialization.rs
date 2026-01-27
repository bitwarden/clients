//! Serialization and deserialization of SSH key data.
//!
//! This module handles the conversion of [`KeyData`] to and from binary format
//! for secure storage. It uses the `rkyv` crate for efficient zero-copy
//! serialization and deserialization.
//!
//! # Key Format
//!
//! Private keys are stored in OpenSSH PEM format with LF line endings.
//! The serialization process:
//!
//! 1. Converts [`PrivateKey`] to OpenSSH PEM string format
//! 2. Combines with [`PublicKey`], name, and cipher ID into [`KeyDataSerializable`]
//! 3. Serializes to binary using `rkyv`
//!
//! Deserialization reverses this process and validates the key format.

use anyhow::{anyhow, Error};
use rkyv::{deserialize, rancor::Error as RancorError, Archive, Deserialize, Serialize};
use ssh_key::{private::KeypairData, LineEnding};

use super::{KeyData, PrivateKey, PublicKey};

#[derive(Archive, Serialize, Deserialize, PartialEq)]
struct KeyDataSerializable {
    private_key: String,
    public_key: PublicKey,
    name: String,
    cipher_id: String,
}

impl TryFrom<KeyDataSerializable> for KeyData {
    type Error = anyhow::Error;

    fn try_from(key_data: KeyDataSerializable) -> Result<Self, Self::Error> {
        let private_key = parse_key(&key_data.private_key)?;
        let private_key = PrivateKey::try_from(private_key)?;

        Ok(Self {
            private_key,
            public_key: key_data.public_key,
            name: key_data.name,
            cipher_id: key_data.cipher_id,
        })
    }
}

fn parse_key(pem: &str) -> Result<ssh_key::PrivateKey, Error> {
    match ssh_key::private::PrivateKey::from_openssh(pem) {
        Ok(key) => match key.public_key().to_bytes() {
            Ok(_) => Ok(key),
            Err(e) => Err(anyhow!("Failed to parse public key: {e}")),
        },
        Err(e) => Err(anyhow!("Failed to parse key: {e}")),
    }
}

impl TryFrom<Vec<u8>> for KeyData {
    type Error = anyhow::Error;

    fn try_from(bytes: Vec<u8>) -> Result<Self, Self::Error> {
        let archived = rkyv::access::<ArchivedKeyDataSerializable, RancorError>(&bytes[..])?;
        let serializable = deserialize::<KeyDataSerializable, RancorError>(archived)?;
        KeyData::try_from(serializable)
    }
}

impl TryFrom<KeyData> for Vec<u8> {
    type Error = anyhow::Error;

    fn try_from(key_data: KeyData) -> Result<Self, Self::Error> {
        let private_key = String::try_from(key_data.private_key)?;

        let serializable = KeyDataSerializable {
            private_key,
            public_key: key_data.public_key,
            name: key_data.name,
            cipher_id: key_data.cipher_id,
        };

        Ok(rkyv::to_bytes::<RancorError>(&serializable)?.to_vec())
    }
}

impl TryFrom<PrivateKey> for String {
    type Error = anyhow::Error;

    fn try_from(key: PrivateKey) -> Result<Self, Self::Error> {
        let keypair_data = match key {
            PrivateKey::Ed25519(kp) => KeypairData::Ed25519(kp),
            PrivateKey::Rsa(kp) => KeypairData::Rsa(kp),
        };
        let private_key = ssh_key::PrivateKey::new(keypair_data, "")?;
        Ok(private_key
            .to_openssh(LineEnding::LF)
            .map(|s| s.to_string())?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ssh_key::{
        private::{Ed25519Keypair, RsaKeypair},
        rand_core::OsRng,
        LineEnding,
    };

    const INVALID_KEY: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
invalid_base64_data!!!
-----END OPENSSH PRIVATE KEY-----";

    fn create_valid_ed25519_key_string() -> String {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Ed25519(ed25519_keypair), "")
                .unwrap();
        ssh_key.to_openssh(LineEnding::LF).unwrap().to_string()
    }

    fn create_test_keydata_ed25519() -> KeyData {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let ssh_key = ssh_key::PrivateKey::new(
            ssh_key::private::KeypairData::Ed25519(ed25519_keypair.clone()),
            "",
        )
        .unwrap();
        let public_key_bytes = ssh_key.public_key().to_bytes().unwrap();

        KeyData {
            private_key: PrivateKey::Ed25519(ed25519_keypair),
            public_key: PublicKey {
                alg: "ssh-ed25519".to_string(),
                blob: public_key_bytes,
            },
            name: "test-key".to_string(),
            cipher_id: "test-cipher-123".to_string(),
        }
    }

    fn create_test_keydata_rsa() -> KeyData {
        let rsa_keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Rsa(rsa_keypair.clone()), "")
                .unwrap();
        let public_key_bytes = ssh_key.public_key().to_bytes().unwrap();

        KeyData {
            private_key: PrivateKey::Rsa(rsa_keypair),
            public_key: PublicKey {
                alg: "ssh-rsa".to_string(),
                blob: public_key_bytes,
            },
            name: "test-rsa-key".to_string(),
            cipher_id: "test-cipher-456".to_string(),
        }
    }

    #[test]
    fn test_parse_key_valid_ed25519() {
        let key_string = create_valid_ed25519_key_string();
        let result = parse_key(&key_string);
        assert!(result.is_ok());

        let key = result.unwrap();
        assert_eq!(key.algorithm(), ssh_key::Algorithm::Ed25519);
    }

    #[test]
    fn test_parse_key_valid_rsa() {
        let rsa_keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let ssh_key =
            ssh_key::PrivateKey::new(ssh_key::private::KeypairData::Rsa(rsa_keypair), "").unwrap();
        let pem = ssh_key.to_openssh(LineEnding::LF).unwrap().to_string();

        let result = parse_key(&pem);
        assert!(result.is_ok());
    }

    #[test]
    #[should_panic(expected = "Failed to parse key")]
    fn test_parse_key_invalid_key() {
        parse_key(INVALID_KEY).unwrap();
    }

    #[test]
    #[should_panic(expected = "Failed to parse key")]
    fn test_parse_key_empty_string() {
        parse_key("").unwrap();
    }

    #[test]
    fn test_privatekey_ed25519_to_string() {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key = PrivateKey::Ed25519(ed25519_keypair);

        let pem = String::try_from(private_key).unwrap();
        assert!(pem.contains("BEGIN OPENSSH PRIVATE KEY"));
        assert!(pem.contains("END OPENSSH PRIVATE KEY"));
    }

    #[test]
    fn test_privatekey_rsa_to_string() {
        let rsa_keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let private_key = PrivateKey::Rsa(rsa_keypair);

        let pem = String::try_from(private_key).unwrap();
        assert!(pem.contains("BEGIN OPENSSH PRIVATE KEY"));
        assert!(pem.contains("END OPENSSH PRIVATE KEY"));
    }

    #[test]
    fn test_privatekey_to_string_uses_lf_line_ending() {
        let ed25519_keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key = PrivateKey::Ed25519(ed25519_keypair);

        let pem = String::try_from(private_key).unwrap();
        // Should use LF (\n), not CRLF (\r\n)
        assert!(!pem.contains("\r\n"));
    }

    #[test]
    fn test_keydataserializable_to_keydata_valid() {
        let key_string = create_valid_ed25519_key_string();
        let serializable = KeyDataSerializable {
            private_key: key_string,
            public_key: PublicKey {
                alg: "ssh-ed25519".to_string(),
                blob: vec![1, 2, 3, 4],
            },
            name: "test".to_string(),
            cipher_id: "cipher-123".to_string(),
        };

        let result = KeyData::try_from(serializable);
        assert!(result.is_ok());
    }

    #[test]
    #[should_panic(expected = "Failed to parse key")]
    fn test_keydataserializable_to_keydata_invalid_key() {
        let serializable = KeyDataSerializable {
            private_key: INVALID_KEY.to_string(),
            public_key: PublicKey {
                alg: "ssh-ed25519".to_string(),
                blob: vec![1, 2, 3, 4],
            },
            name: "test".to_string(),
            cipher_id: "cipher-123".to_string(),
        };

        KeyData::try_from(serializable).unwrap();
    }

    #[test]
    #[should_panic(expected = "subtree pointer overran range")]
    fn test_keydata_from_corrupted_bytes() {
        let corrupted_bytes = vec![0u8, 1, 2, 3, 4, 5];
        KeyData::try_from(corrupted_bytes).unwrap();
    }

    #[test]
    #[should_panic(expected = "subtree pointer overran range")]
    fn test_keydata_from_empty_bytes() {
        let empty_bytes: Vec<u8> = vec![];
        KeyData::try_from(empty_bytes).unwrap();
    }

    #[test]
    fn test_keydata_ed25519_to_from_bytes() {
        let original = create_test_keydata_ed25519();

        let bytes: Vec<u8> = original.clone().try_into().unwrap();
        let restored: KeyData = bytes.try_into().unwrap();

        assert_eq!(restored.name(), original.name());
        assert_eq!(restored.cipher_id(), original.cipher_id());
        assert_eq!(restored.public_key(), original.public_key());
        assert_eq!(restored.private_key(), original.private_key());
    }

    #[test]
    fn test_keydata_rsa_to_from_bytes() {
        let original = create_test_keydata_rsa();

        let bytes: Vec<u8> = original.clone().try_into().unwrap();
        let restored: KeyData = bytes.try_into().unwrap();

        assert_eq!(restored.name(), original.name());
        assert_eq!(restored.cipher_id(), original.cipher_id());
        assert_eq!(restored.public_key(), original.public_key());
        assert_eq!(restored.private_key(), original.private_key());
    }
}
