use std::{ffi::c_void, str::FromStr};

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as base64_engine, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use windows::{
    core::{factory, HSTRING},
    Security::Credentials::UI::{
        UserConsentVerificationResult, UserConsentVerifier, UserConsentVerifierAvailability,
    },
    Win32::{
        Foundation::HWND, System::WinRT::IUserConsentVerifierInterop,
        UI::WindowsAndMessaging::GetForegroundWindow,
    },
};
use windows_future::IAsyncOperation;

use crate::{
    biometric::{KeyMaterial, OsDerivedKey},
    crypto::CipherString,
};

use super::{decrypt, encrypt, windows_focus::set_focus};

/// The Windows OS implementation of the biometric trait.
pub struct Biometric {}

impl super::BiometricTrait for Biometric {
    async fn prompt(hwnd: Vec<u8>, message: String) -> Result<bool> {
        let h = isize::from_le_bytes(hwnd.clone().try_into().unwrap());

        let h = h as *mut c_void;
        let window = HWND(h);

        // The Windows Hello prompt is displayed inside the application window. For best result we
        //  should set the window to the foreground and focus it.
        set_focus(window);

        // Windows Hello prompt must be in foreground, focused, otherwise the face or fingerprint
        //  unlock will not work. We get the current foreground window, which will either be the
        //  Bitwarden desktop app or the browser extension.
        let foreground_window = unsafe { GetForegroundWindow() };

        let interop = factory::<UserConsentVerifier, IUserConsentVerifierInterop>()?;
        let operation: IAsyncOperation<UserConsentVerificationResult> = unsafe {
            interop.RequestVerificationForWindowAsync(foreground_window, &HSTRING::from(message))?
        };
        let result = operation.get()?;

        match result {
            UserConsentVerificationResult::Verified => Ok(true),
            _ => Ok(false),
        }
    }

    async fn available() -> Result<bool> {
        let ucv_available = UserConsentVerifier::CheckAvailabilityAsync()?.get()?;

        match ucv_available {
            UserConsentVerifierAvailability::Available => Ok(true),
            UserConsentVerifierAvailability::DeviceBusy => Ok(true), // TODO: Look into removing this and making the check more ad-hoc
            _ => Ok(false),
        }
    }

    fn derive_key_material(challenge_str: Option<&str>) -> Result<OsDerivedKey> {
        let challenge: [u8; 16] = match challenge_str {
            Some(challenge_str) => base64_engine
                .decode(challenge_str)?
                .try_into()
                .map_err(|e: Vec<_>| anyhow!("Expect length {}, got {}", 16, e.len()))?,
            None => random_challenge(),
        };

        // Uses a key derived from the iv. This key is not intended to add any security
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
            "Key material is required for Windows Hello protected keys"
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
            "Key material is required for Windows Hello protected keys"
        ))?;

        let encrypted_secret = crate::password::get_password(service, account).await?;
        match CipherString::from_str(&encrypted_secret) {
            Ok(secret) => {
                // If the secret is a CipherString, it is encrypted and we need to decrypt it.
                let secret = decrypt(&secret, &key_material)?;
                Ok(secret)
            }
            Err(_) => {
                // If the secret is not a CipherString, it is not encrypted and we can return it
                //  directly.
                Ok(encrypted_secret)
            }
        }
    }
}

fn random_challenge() -> [u8; 16] {
    let mut challenge = [0u8; 16];
    rand::rng().fill_bytes(&mut challenge);
    challenge
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::biometric::BiometricTrait;

    #[test]
    fn test_derive_key_material() {
        let iv_input = "l9fhDUP/wDJcKwmEzcb/3w==";
        let result = <Biometric as BiometricTrait>::derive_key_material(Some(iv_input)).unwrap();
        let key = base64_engine.decode(result.key_b64).unwrap();
        assert_eq!(key.len(), 32);
        assert_eq!(result.iv_b64, iv_input)
    }

    #[test]
    fn test_derive_key_material_no_iv() {
        let result = <Biometric as BiometricTrait>::derive_key_material(None).unwrap();
        let key = base64_engine.decode(result.key_b64).unwrap();
        assert_eq!(key.len(), 32);
        let iv = base64_engine.decode(result.iv_b64).unwrap();
        assert_eq!(iv.len(), 16);
    }

    #[tokio::test]
    #[cfg(feature = "manual_test")]
    async fn test_prompt() {
        <Biometric as BiometricTrait>::prompt(
            vec![0, 0, 0, 0, 0, 0, 0, 0],
            String::from("Hello from Rust"),
        )
        .await
        .unwrap();
    }

    #[tokio::test]
    #[cfg(feature = "manual_test")]
    async fn test_available() {
        assert!(<Biometric as BiometricTrait>::available().await.unwrap())
    }

    #[tokio::test]
    #[cfg(feature = "manual_test")]
    async fn get_biometric_secret_requires_key() {
        let result = <Biometric as BiometricTrait>::get_biometric_secret("", "", None).await;
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Key material is required for Windows Hello protected keys"
        );
    }

    #[tokio::test]
    #[cfg(feature = "manual_test")]
    async fn get_biometric_secret_handles_unencrypted_secret() {
        let test = "test";
        let secret = "password";
        let key_material = KeyMaterial {
            os_key_part_b64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned(),
            client_key_part_b64: Some("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned()),
        };
        crate::password::set_password(test, test, secret)
            .await
            .unwrap();
        let result =
            <Biometric as BiometricTrait>::get_biometric_secret(test, test, Some(key_material))
                .await
                .unwrap();
        crate::password::delete_password("test", "test")
            .await
            .unwrap();
        assert_eq!(result, secret);
    }

    #[tokio::test]
    #[cfg(feature = "manual_test")]
    async fn get_biometric_secret_handles_encrypted_secret() {
        let test = "test";
        let secret =
            CipherString::from_str("0.l9fhDUP/wDJcKwmEzcb/3w==|uP4LcqoCCj5FxBDP77NV6Q==").unwrap(); // output from test_encrypt
        let key_material = KeyMaterial {
            os_key_part_b64: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned(),
            client_key_part_b64: Some("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".to_owned()),
        };
        crate::password::set_password(test, test, &secret.to_string())
            .await
            .unwrap();

        let result =
            <Biometric as BiometricTrait>::get_biometric_secret(test, test, Some(key_material))
                .await
                .unwrap();
        crate::password::delete_password("test", "test")
            .await
            .unwrap();
        assert_eq!(result, "secret");
    }

    #[tokio::test]
    async fn set_biometric_secret_requires_key() {
        let result =
            <Biometric as BiometricTrait>::set_biometric_secret("", "", "", None, "").await;
        assert!(result.is_err());
        assert_eq!(
            result.unwrap_err().to_string(),
            "Key material is required for Windows Hello protected keys"
        );
    }
}
