use std::str::FromStr;

use anyhow::{bail, Result};

use crate::biometric::{KeyMaterial, OsDerivedKey};
use zbus::Connection;
use zbus_polkit::policykit1::*;

use super::{decrypt, encrypt};
use anyhow::anyhow;
use crate::crypto::CipherString;

/// The Unix implementation of the biometric trait.
pub struct Biometric {}

impl super::BiometricTrait for Biometric {
    async fn prompt(_hwnd: Vec<u8>, _message: String) -> Result<bool> {
        let connection = Connection::system().await?;
        let proxy = AuthorityProxy::new(&connection).await?;
        let subject = Subject::new_for_owner(std::process::id(), None, None)?;
        let details = std::collections::HashMap::new();
        let result = proxy.check_authorization(
            &subject,
            "com.bitwarden.Bitwarden.unlock",
            &details,
            CheckAuthorizationFlags::AllowUserInteraction.into(),
            "",
        ).await;

        match result {
            Ok(result) => {
                return Ok(result.is_authorized);
            }
            Err(e) => {
                println!("polkit biometric error: {:?}", e);
                return Ok(false);
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
        return Ok(false);
    }

    fn derive_key_material(_iv_str: Option<&str>) -> Result<OsDerivedKey> {
        bail!("derive_key_material not implemented");
    }

    fn set_biometric_secret(
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
        crate::password::set_password(service, account, &encrypted_secret)?;
        Ok(encrypted_secret)
    }

    fn get_biometric_secret(
        service: &str,
        account: &str,
        key_material: Option<KeyMaterial>,
    ) -> Result<String> {
        let key_material = key_material.ok_or(anyhow!(
            "Key material is required for polkit protected keys"
        ))?;

        let encrypted_secret = crate::password::get_password(service, account)?;
        match CipherString::from_str(&encrypted_secret) {
            Ok(secret) => {
                // If the secret is a CipherString, it is encrypted and we need to decrypt it.
                let secret = decrypt(&secret, &key_material)?;
                return Ok(secret);
            }
            Err(_) => {
                // If the secret is not a CipherString, it is not encrypted and we can return it
                //  directly.
                return Ok(encrypted_secret);
            }
        }
    }
}