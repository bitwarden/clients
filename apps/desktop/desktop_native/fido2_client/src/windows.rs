use base64::{prelude::BASE64_URL_SAFE_NO_PAD, Engine};
use windows::{
    core::{w, HSTRING, PCWSTR},
    Win32::{
        Foundation::BOOL,
        Networking::WindowsWebServices::{
            WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS,
            WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_CURRENT_VERSION, WEBAUTHN_CLIENT_DATA,
            WEBAUTHN_CLIENT_DATA_CURRENT_VERSION, WEBAUTHN_CREDENTIALS, WEBAUTHN_CREDENTIAL_LIST,
            WEBAUTHN_EXTENSION, WEBAUTHN_EXTENSIONS, WEBAUTHN_HMAC_SECRET_SALT,
            WEBAUTHN_HMAC_SECRET_SALT_VALUES, WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
            WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
            WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
        },
        UI::WindowsAndMessaging::GetForegroundWindow,
    },
};

use crate::{AssertionOptions, Fido2ClientError, PublicKeyCredential};

fn to_native_uv(uv: crate::UserVerification) -> u32 {
    match uv {
        crate::UserVerification::Required => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
        crate::UserVerification::Preferred => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
        crate::UserVerification::Discouraged => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
    }
}

fn client_data_json(options: &AssertionOptions) -> String {
    format!(
        r#"{{"type":"webauthn.get","challenge":"{}","origin":"https://{}","crossOrigin": true}}"#,
        BASE64_URL_SAFE_NO_PAD.encode(&options.challenge),
        options.rpid
    )
}

fn hmac_secret_salt(options: &AssertionOptions) -> WEBAUTHN_HMAC_SECRET_SALT {
    let mut hmac_secret_salt = WEBAUTHN_HMAC_SECRET_SALT {
        cbFirst: 0,
        pbFirst: std::ptr::null_mut(),
        cbSecond: 0,
        pbSecond: std::ptr::null_mut(),
    };
    if let Some(first) = &options.prf_eval_first {
        hmac_secret_salt.cbFirst = first.len() as u32;
        hmac_secret_salt.pbFirst = first.as_ptr() as *mut _;
    }
    if let Some(second) = &options.prf_eval_second {
        hmac_secret_salt.cbSecond = second.len() as u32;
        hmac_secret_salt.pbSecond = second.as_ptr() as *mut _;
    }
    hmac_secret_salt
}

pub fn get(options: AssertionOptions) -> Result<PublicKeyCredential, Fido2ClientError> {
    let uv = to_native_uv(options.user_verification);
    let rp_id: HSTRING = options.rpid.clone().into();

    // HMAC secret extension
    let hmac_extension_enabled = options.prf_eval_first.is_some();
    let mut hmac_secret_salt = hmac_secret_salt(&options);
    let mut hmac_secret_salt_values = WEBAUTHN_HMAC_SECRET_SALT_VALUES {
        pGlobalHmacSalt: std::ptr::addr_of_mut!(hmac_secret_salt) as *mut _,
        pCredWithHmacSecretSaltList: [].as_mut_ptr(),
        cCredWithHmacSecretSaltList: 0,
    };
    let used: BOOL = true.into();
    let hmac_extension: WEBAUTHN_EXTENSION = WEBAUTHN_EXTENSION {
        pwszExtensionIdentifier: w!("hmacGetSecret"),
        cbExtension: 1,
        pvExtension: &used as *const _ as *mut _,
    };
    let extensions: WEBAUTHN_EXTENSIONS = if hmac_extension_enabled {
        WEBAUTHN_EXTENSIONS {
            cExtensions: 1,
            pExtensions: &hmac_extension as *const _ as *mut _,
        }
    } else {
        WEBAUTHN_EXTENSIONS {
            cExtensions: 0,
            pExtensions: std::ptr::null_mut(),
        }
    };

    let client_data_json = client_data_json(&options.clone());
    let client_data = WEBAUTHN_CLIENT_DATA {
        dwVersion: WEBAUTHN_CLIENT_DATA_CURRENT_VERSION,
        cbClientDataJSON: client_data_json.len() as u32,
        pbClientDataJSON: client_data_json.as_ptr() as *mut _,
        pwszHashAlgId: w!("SHA-256"),
    };

    let mut list = WEBAUTHN_CREDENTIAL_LIST {
        cCredentials: 0,
        ppCredentials: std::ptr::null_mut(),
    };

    let mut app_id_used: BOOL = false.into();
    let getassertopts = WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS {
        dwVersion: WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_CURRENT_VERSION,
        dwTimeoutMilliseconds: options.timeout as u32,
        CredentialList: WEBAUTHN_CREDENTIALS {
            cCredentials: 0,
            pCredentials: [].as_mut_ptr(),
        },
        Extensions: extensions,
        dwAuthenticatorAttachment: 0,
        dwUserVerificationRequirement: uv,
        dwFlags: 0,
        pwszU2fAppId: PCWSTR::null(),
        pbU2fAppId: std::ptr::addr_of_mut!(app_id_used),
        pCancellationId: std::ptr::null_mut(),
        pAllowCredentialList: std::ptr::addr_of_mut!(list),
        dwCredLargeBlobOperation: 0,
        cbCredLargeBlob: 0,
        pbCredLargeBlob: std::ptr::null_mut(),
        bBrowserInPrivateMode: false.into(),
        pHmacSecretSaltValues: if true {
            std::ptr::addr_of_mut!(hmac_secret_salt_values) as *mut _
        } else {
            std::ptr::null_mut()
        },
    };

    let assertion = unsafe {
        *windows::Win32::Networking::WindowsWebServices::WebAuthNAuthenticatorGetAssertion(
            GetForegroundWindow(),
            &rp_id,
            std::ptr::addr_of!(client_data) as *const _,
            Some(&getassertopts),
        )
        .map_err(|_| Fido2ClientError::AssertionError)?
    };

    let id = unsafe {
        std::slice::from_raw_parts(
            assertion.Credential.pbId as *const u8,
            assertion.Credential.cbId as usize,
        )
    };

    let hmac = if hmac_extension_enabled {
        Some(unsafe {
            let hmac_secret = *assertion.pHmacSecret;
            std::slice::from_raw_parts(
                hmac_secret.pbFirst as *const u8,
                hmac_secret.cbFirst as usize,
            )
        })
    } else {
        None
    };

    Ok(PublicKeyCredential {
        id: BASE64_URL_SAFE_NO_PAD.encode(id),
        raw_id: id.to_vec(),
        response: crate::AuthenticatorAssertionResponse {
            authenticator_data: unsafe {
                std::slice::from_raw_parts(
                    assertion.pbAuthenticatorData as *const u8,
                    assertion.cbAuthenticatorData as usize,
                )
            }
            .to_vec(),
            client_data_json: client_data_json.as_bytes().to_vec(),
            signature: unsafe {
                std::slice::from_raw_parts(
                    assertion.pbSignature as *const u8,
                    assertion.cbSignature as usize,
                )
            }
            .to_vec(),
            user_handle: unsafe {
                std::slice::from_raw_parts(
                    assertion.pbUserId as *const u8,
                    assertion.cbUserId as usize,
                )
            }
            .to_vec(),
        },
        // PRF (hmac-get-secret) extension parsing is not implemented here yet; return None.
        prf: hmac
            .map(|h| h.try_into().map_err(|_| Fido2ClientError::AssertionError))
            .transpose()?,
        authenticator_attachment: "cross-platform".to_string(),
        r#type: "public-key".to_string(),
    })
}

pub fn available() -> bool {
    false
}

#[cfg(test)]
mod tests {
    use crate::AssertionOptions;

    use super::*;

    #[test]
    fn test_get() {
        let options = AssertionOptions {
            challenge: vec![0u8; 32],
            timeout: 0,
            rpid: "vault.usdev.bitwarden.pw".to_string(),
            user_verification: crate::UserVerification::Required,
            allow_credentials: vec![],
            prf_eval_first: Some([0u8; 32]),
            prf_eval_second: None,
        };
        let result = get(options);
        println!("{:?}", result.unwrap());
    }
}
