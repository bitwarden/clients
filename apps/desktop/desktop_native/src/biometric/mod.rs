use async_trait::async_trait;
use anyhow::Result;

#[cfg_attr(target_os = "linux", path = "unix.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod biometric;

pub use biometric::Biometric;

use crate::biometrics::{KeyMaterial, OsDerivedKey};

#[async_trait]
pub trait BiometricTrait {
    async fn prompt(hwnd: Vec<u8>, message: String) -> Result<bool>;
    fn available() -> Result<bool>;
    fn derive_key_material(secret: Option<&str>) -> Result<OsDerivedKey>;
    fn set_biometric_secret(
        service: &str,
        account: &str,
        secret: &str,
        key_material: Option<KeyMaterial>,
        iv_b64: &str,
    ) -> Result<String>;
    fn get_biometric_secret(
        service: &str,
        account: &str,
        key_material: Option<KeyMaterial>,
    ) -> Result<String>;
}
