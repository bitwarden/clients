use aes::cipher::generic_array::GenericArray;
use anyhow::{anyhow, Result};

#[allow(clippy::module_inception)]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
mod biometric;

pub use biometric::Biometric;

#[cfg(target_os = "windows")]
pub mod windows_focus;

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
