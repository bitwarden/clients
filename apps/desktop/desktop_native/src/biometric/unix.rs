use async_trait::async_trait;
use anyhow::{bail, Result};

use crate::biometrics::{KeyMaterial, OsDerivedKey};
use zbus::Connection;
use zbus_polkit::policykit1::*;
/// The Unix implementation of the biometric trait.
pub struct Biometric {}

#[async_trait]
impl super::BiometricTrait for Biometric {
    async fn prompt(_hwnd: Vec<u8>, _message: String) -> Result<bool> {
        let connection = Connection::system().await?;
        let proxy = AuthorityProxy::new(&connection).await?;
        let subject = Subject::new_for_owner(std::process::id(), None, None)?;
        let result = proxy.check_authorization(
            &subject,
            "com.bitwarden.Bitwarden.unlock",
            &std::collections::HashMap::new(),
            CheckAuthorizationFlags::AllowUserInteraction.into(),
            "",
        ).await?;

        return Ok(result.is_authorized);
    }

    fn available() -> Result<bool> {
        bail!("available not implemented");
    }

    fn derive_key_material(_iv_str: Option<&str>) -> Result<OsDerivedKey> {
        bail!("derive_key_material not implemented");
    }

    fn get_biometric_secret(
        _service: &str,
        _account: &str,
        _key_material: Option<KeyMaterial>,
    ) -> Result<String> {
        bail!("get_biometric_secret not implemented");
    }

    fn set_biometric_secret(
        _service: &str,
        _account: &str,
        _secret: &str,
        _key_material: Option<KeyMaterial>,
        _iv_b64: &str,
    ) -> Result<String> {
        bail!("set_biometric_secret not implemented");
    }
}