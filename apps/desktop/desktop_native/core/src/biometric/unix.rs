use anyhow::Result;

use crate::biometric::{KeyMaterial, OsDerivedKey};
use zbus::Connection;
use zbus_polkit::policykit1::*;

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

    fn derive_key_material(_challenge_str: Option<&str>) -> Result<OsDerivedKey> {
        unimplemented!();
    }

    async fn set_biometric_secret(
        _service: &str,
        _account: &str,
        _secret: &str,
        _key_material: Option<KeyMaterial>,
        _iv_b64: &str,
    ) -> Result<String> {
        unimplemented!();
    }

    async fn get_biometric_secret(
        _service: &str,
        _account: &str,
        _key_material: Option<KeyMaterial>,
    ) -> Result<String> {
        unimplemented!();
    }
}
