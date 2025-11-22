use aes::cipher::generic_array::GenericArray;
use anyhow::{anyhow, Result};

#[allow(clippy::module_inception)]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod biometric;

pub use biometric::Biometric;

use base64::{engine::general_purpose::STANDARD as base64_engine, Engine};
use sha2::{Digest, Sha256};

use crate::crypto::{self, CipherString};

pub struct KeyMaterial {
    pub os_key_part_b64: String,
    pub client_key_part_b64: Option<String>,
}

pub struct OsDerivedKey {
    pub key_b64: String,
    pub iv_b64: String,
}

#[allow(async_fn_in_trait)]
pub trait BiometricTrait {
    async fn prompt(hwnd: Vec<u8>, message: String) -> Result<bool>;
    async fn available() -> Result<bool>;
    fn derive_key_material(secret: Option<&str>) -> Result<OsDerivedKey>;
    async fn set_biometric_secret(
        service: &str,
        account: &str,
        secret: &str,
        key_material: Option<KeyMaterial>,
        iv_b64: &str,
    ) -> Result<String>;
    async fn get_biometric_secret(
        service: &str,
        account: &str,
        key_material: Option<KeyMaterial>,
    ) -> Result<String>;
}

#[allow(unused)]
fn encrypt(secret: &str, key_material: &KeyMaterial, iv_b64: &str) -> Result<String> {
    let iv = base64_engine
        .decode(iv_b64)?
        .try_into()
        .map_err(|e: Vec<_>| anyhow!("Expected length {}, got {}", 16, e.len()))?;

    let encrypted = crypto::encrypt_aes256(secret.as_bytes(), iv, key_material.derive_key()?)?;

    Ok(encrypted.to_string())
}

#[allow(unused)]
fn decrypt(secret: &CipherString, key_material: &KeyMaterial) -> Result<String> {
    if let CipherString::AesCbc256_B64 { iv, data } = secret {
        let decrypted = crypto::decrypt_aes256(iv, data, key_material.derive_key()?)?;

        Ok(String::from_utf8(decrypted)?)
    } else {
        Err(anyhow!("Invalid cipher string"))
    }
}

impl KeyMaterial {
    fn digest_material(&self) -> String {
        match self.client_key_part_b64.as_deref() {
            Some(client_key_part_b64) => {
                format!("{}|{}", self.os_key_part_b64, client_key_part_b64)
            }
            None => self.os_key_part_b64.clone(),
        }
    }

    pub fn derive_key(&self) -> Result<GenericArray<u8, typenum::U32>> {
        Ok(Sha256::digest(self.digest_material()))
    }
}

#[cfg(test)]
mod tests {
    use crate::biometric::{decrypt, encrypt, KeyMaterial};
    use crate::crypto::CipherString;
    use base64::{engine::general_purpose::STANDARD as base64_engine, Engine};
    use std::str::FromStr;

    fn key_material() -> KeyMaterial {
        KeyMaterial {
            os_key_part_b64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned(),
            client_key_part_b64: Some("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned()),
        }
    }

    #[test]
    fn test_encrypt() {
        let key_material = key_material();
        let iv_b64 = "l9fhDUP/wDJcKwmEzcb/3w==".to_owned();
        let secret = encrypt("secret", &key_material, &iv_b64)
            .unwrap()
            .parse::<CipherString>()
            .unwrap();

        match secret {
            CipherString::AesCbc256_B64 { iv, data: _ } => {
                assert_eq!(iv_b64, base64_engine.encode(iv));
            }
            _ => panic!("Invalid cipher string"),
        }
    }

    #[test]
    fn test_decrypt() {
        let secret =
            CipherString::from_str("0.l9fhDUP/wDJcKwmEzcb/3w==|uP4LcqoCCj5FxBDP77NV6Q==").unwrap(); // output from test_encrypt
        let key_material = key_material();
        assert_eq!(decrypt(&secret, &key_material).unwrap(), "secret")
    }

    #[test]
    fn key_material_produces_valid_key() {
        let result = key_material().derive_key().unwrap();
        assert_eq!(result.len(), 32);
    }

    #[test]
    fn key_material_uses_os_part() {
        let mut key_material = key_material();
        let result = key_material.derive_key().unwrap();
        key_material.os_key_part_b64 = "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned();
        let result2 = key_material.derive_key().unwrap();
        assert_ne!(result, result2);
    }

    #[test]
    fn key_material_uses_client_part() {
        let mut key_material = key_material();
        let result = key_material.derive_key().unwrap();
        key_material.client_key_part_b64 =
            Some("BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned());
        let result2 = key_material.derive_key().unwrap();
        assert_ne!(result, result2);
    }

    #[test]
    fn key_material_produces_consistent_os_only_key() {
        let mut key_material = key_material();
        key_material.client_key_part_b64 = None;
        let result = key_material.derive_key().unwrap();
        assert_eq!(
            result,
            [
                81, 100, 62, 172, 151, 119, 182, 58, 123, 38, 129, 116, 209, 253, 66, 118, 218,
                237, 236, 155, 201, 234, 11, 198, 229, 171, 246, 144, 71, 188, 84, 246
            ]
            .into()
        );
    }

    #[test]
    fn key_material_produces_unique_os_only_key() {
        let mut key_material = key_material();
        key_material.client_key_part_b64 = None;
        let result = key_material.derive_key().unwrap();
        key_material.os_key_part_b64 = "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned();
        let result2 = key_material.derive_key().unwrap();
        assert_ne!(result, result2);
    }
}
