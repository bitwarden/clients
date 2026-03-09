#[napi]
pub mod biometrics {
    use desktop_core::biometric::{Biometric, BiometricTrait, KeyMaterial, OsDerivedKey};

    // Prompt for biometric confirmation
    #[napi]
    pub async fn prompt(
        hwnd: napi::bindgen_prelude::Buffer,
        message: String,
    ) -> napi::Result<bool> {
        Biometric::prompt(hwnd.into(), message)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn available() -> napi::Result<bool> {
        Biometric::available()
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn set_biometric_secret(
        service: String,
        account: String,
        secret: String,
        key_material: Option<KeyMaterial>,
        iv_b64: String,
    ) -> napi::Result<String> {
        Biometric::set_biometric_secret(&service, &account, &secret, key_material, &iv_b64)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Retrieves the biometric secret for the given service and account.
    /// Throws Error with message [`passwords::PASSWORD_NOT_FOUND`] if the secret does not exist.
    #[napi]
    pub async fn get_biometric_secret(
        service: String,
        account: String,
        key_material: Option<KeyMaterial>,
    ) -> napi::Result<String> {
        Biometric::get_biometric_secret(&service, &account, key_material)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Derives key material from biometric data. Returns a string encoded with a
    /// base64 encoded key and the base64 encoded challenge used to create it
    /// separated by a `|` character.
    ///
    /// If the iv is provided, it will be used as the challenge. Otherwise a random challenge will
    /// be generated.
    ///
    /// `format!("<key_base64>|<iv_base64>")`
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn derive_key_material(iv: Option<String>) -> napi::Result<OsDerivedKey> {
        Biometric::derive_key_material(iv.as_deref())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
