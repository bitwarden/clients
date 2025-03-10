use std::str::FromStr;

use anyhow::Result;
use base64::Engine;
use rand::RngCore;
use sha2::{Digest, Sha256};

use crate::biometric::{base64_engine, KeyMaterial, OsDerivedKey};
use zbus::Connection;
use zbus_polkit::policykit1::*;

use super::{decrypt, encrypt};
use crate::crypto::CipherString;
use anyhow::anyhow;

/// The Unix implementation of the biometric trait.
pub struct Biometric {}

impl super::BiometricTrait for Biometric {
    async fn prompt(_hwnd: Vec<u8>, _message: String) -> Result<bool> {
        let connection = Connection::system().await?;
        let proxy = AuthorityProxy::new(&connection).await?;
        let subject = Subject::new_for_owner(std::process::id(), None, None)?;
        let details = std::collections::HashMap::new();
        let result = proxy
            .check_authorization(
                &subject,
                "com.bitwarden.Bitwarden.unlock",
                &details,
                CheckAuthorizationFlags::AllowUserInteraction.into(),
                "",
            )
            .await;

        match result {
            Ok(result) => Ok(result.is_authorized),
            Err(e) => {
                println!("polkit biometric error: {:?}", e);
                Ok(false)
            }
        }
    }

    async fn available() -> Result<bool> {
        let connection = Connection::system().await?;
        let proxy = AuthorityProxy::new(&connection).await?;
        let res = proxy.enumerate_actions("en").await?;
        for action in res {
            if action.action_id == "com.bitwarden.Bitwarden.unlock" {
                return Ok(true);
            }
        }
        Ok(false)
    }

    fn derive_key_material(challenge_str: Option<&str>) -> Result<OsDerivedKey> {
        let challenge: [u8; 16] = match challenge_str {
            Some(challenge_str) => base64_engine
                .decode(challenge_str)?
                .try_into()
                .map_err(|e: Vec<_>| anyhow!("Expect length {}, got {}", 16, e.len()))?,
            None => random_challenge(),
        };

        // there is no windows hello like interactive bio protected secret at the moment on linux
        // so we use a a key derived from the iv. this key is not intended to add any security
        // but only a place-holder
        let key = Sha256::digest(challenge);
        let key_b64 = base64_engine.encode(key);
        let iv_b64 = base64_engine.encode(challenge);
        Ok(OsDerivedKey { key_b64, iv_b64 })
    }

    async fn set_biometric_secret(
        service: &str,
        account: &str,
        secret: &str,
        key_material: Option<KeyMaterial>,
        iv_b64: &str,
    ) -> Result<String> {
        let key_material = key_material.ok_or(anyhow!(
            "Key material is required for polkit protected keys"
        ))?;

        let encrypted_secret = encrypt(secret, &key_material, iv_b64)?;
        crate::password::set_password(service, account, &encrypted_secret).await?;
        Ok(encrypted_secret)
    }

    async fn get_biometric_secret(
        service: &str,
        account: &str,
        key_material: Option<KeyMaterial>,
    ) -> Result<String> {
        let key_material = key_material.ok_or(anyhow!(
            "Key material is required for polkit protected keys"
        ))?;

        let encrypted_secret = crate::password::get_password(service, account).await?;
        let secret = CipherString::from_str(&encrypted_secret)?;
        decrypt(&secret, &key_material)
    }
}

fn random_challenge() -> [u8; 16] {
    let mut challenge = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut challenge);
    challenge
}
