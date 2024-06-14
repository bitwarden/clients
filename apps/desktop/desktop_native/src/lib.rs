#[macro_use]
extern crate napi_derive;

mod biometric;
mod clipboard;
mod crypto;
mod error;
mod password;
mod passkeyclient;
#[napi]
pub mod passwords {
    /// Fetch the stored password from the keychain.
    #[napi]
    pub async fn get_password(service: String, account: String) -> napi::Result<String> {
        super::password::get_password(&service, &account)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Fetch the stored password from the keychain that was stored with Keytar.
    #[napi]
    pub async fn get_password_keytar(service: String, account: String) -> napi::Result<String> {
        super::password::get_password_keytar(&service, &account)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Save the password to the keychain. Adds an entry if none exists otherwise updates the existing entry.
    #[napi]
    pub async fn set_password(
        service: String,
        account: String,
        password: String,
    ) -> napi::Result<()> {
        super::password::set_password(&service, &account, &password)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Delete the stored password from the keychain.
    #[napi]
    pub async fn delete_password(service: String, account: String) -> napi::Result<()> {
        super::password::delete_password(&service, &account)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod biometrics {
    use super::biometric::{Biometric, BiometricTrait};

    // Prompt for biometric confirmation
    #[napi]
    pub async fn prompt(
        hwnd: napi::bindgen_prelude::Buffer,
        message: String,
    ) -> napi::Result<bool> {
        Biometric::prompt(hwnd.into(), message).map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn available() -> napi::Result<bool> {
        Biometric::available().map_err(|e| napi::Error::from_reason(e.to_string()))
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
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn get_biometric_secret(
        service: String,
        account: String,
        key_material: Option<KeyMaterial>,
    ) -> napi::Result<String> {
        let result = Biometric::get_biometric_secret(&service, &account, key_material)
            .map_err(|e| napi::Error::from_reason(e.to_string()));
        result
    }

    /// Derives key material from biometric data. Returns a string encoded with a
    /// base64 encoded key and the base64 encoded challenge used to create it
    /// separated by a `|` character.
    ///
    /// If the iv is provided, it will be used as the challenge. Otherwise a random challenge will be generated.
    ///
    /// `format!("<key_base64>|<iv_base64>")`
    #[napi]
    pub async fn derive_key_material(iv: Option<String>) -> napi::Result<OsDerivedKey> {
        Biometric::derive_key_material(iv.as_deref())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi(object)]
    pub struct KeyMaterial {
        pub os_key_part_b64: String,
        pub client_key_part_b64: Option<String>,
    }

    #[napi(object)]
    pub struct OsDerivedKey {
        pub key_b64: String,
        pub iv_b64: String,
    }
}

#[napi]
pub mod clipboards {
    #[napi]
    pub async fn read() -> napi::Result<String> {
        super::clipboard::read().map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        super::clipboard::write(&text, password)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod passkeyclients {
    use napi::threadsafe_function::{ErrorStrategy::CalleeHandled, ThreadsafeFunction};

    #[napi]
    pub async fn authenticate(challenge: String, origin: String, pin: Option<String>, touch_required_callback: ThreadsafeFunction<(), CalleeHandled>, no_devices_callback: ThreadsafeFunction<(), CalleeHandled>) -> napi::Result<String> {
        super::passkeyclient::authenticate(challenge, origin, pin, touch_required_callback, no_devices_callback)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn supports_native_webauthn() -> napi::Result<bool> {
        super::passkeyclient::supports_native_webauthn()
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
