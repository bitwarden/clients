use base64::{Engine, prelude::BASE64_URL_SAFE_NO_PAD};
use windows::{Win32::{Foundation::BOOL, Networking::WindowsWebServices::{WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS, WEBAUTHN_AUTHENTICATOR_GET_ASSERTION_OPTIONS_CURRENT_VERSION, WEBAUTHN_CLIENT_DATA, WEBAUTHN_CLIENT_DATA_CURRENT_VERSION, WEBAUTHN_CREDENTIAL_LIST, WEBAUTHN_CREDENTIALS, WEBAUTHN_EXTENSION, WEBAUTHN_EXTENSIONS, WEBAUTHN_HMAC_SECRET_SALT, WEBAUTHN_HMAC_SECRET_SALT_VALUES, WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED, WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED, WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED}, UI::WindowsAndMessaging::GetForegroundWindow}, core::{HSTRING, PCWSTR, w}};

use crate::{AssertionOptions, Fido2ClientError, PublicKeyCredential};

pub fn get(options: AssertionOptions) -> Result<PublicKeyCredential, Fido2ClientError> {
    let uv = match options.user_verification {
        crate::UserVerification::Required => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_REQUIRED,
        crate::UserVerification::Preferred => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_PREFERRED,
        crate::UserVerification::Discouraged => WEBAUTHN_USER_VERIFICATION_REQUIREMENT_DISCOURAGED,
    };
    let rp_id: HSTRING = options.rpid.clone().into();
    
    let client_data_json = format!(
        r#"{{"type":"webauthn.get","challenge":"{}","origin":"https://{}","crossOrigin": true}}"#,
        BASE64_URL_SAFE_NO_PAD.encode(&options.challenge),
        options.rpid
    );
   
    let salt_first = vec![0u8; options.prf_eval_first.len()];
    let mut hmac_secret_salt = WEBAUTHN_HMAC_SECRET_SALT {
        cbFirst: salt_first.len() as u32,
        pbFirst: salt_first.as_ptr() as *mut _,
        cbSecond: 0,
        pbSecond: std::ptr::null_mut(),
    };
    let mut hmac_secret_salt_values = WEBAUTHN_HMAC_SECRET_SALT_VALUES {
        pGlobalHmacSalt: std::ptr::addr_of_mut!(hmac_secret_salt) as *mut _,
        pCredWithHmacSecretSaltList: [].as_mut_ptr(),
        cCredWithHmacSecretSaltList: 0,
    };
    let mut app_id_used: BOOL = false.into();

    let used: BOOL = true.into();
    let extension: WEBAUTHN_EXTENSION = WEBAUTHN_EXTENSION {
        pwszExtensionIdentifier: w!("hmacGetSecret"),
        cbExtension: 1,
        pvExtension: &used as *const _ as *mut _,
    };
    let mut extensions: WEBAUTHN_EXTENSIONS = WEBAUTHN_EXTENSIONS {
        cExtensions: 1,
        pExtensions: &extension as *const _ as *mut _,
    };
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
        let a = windows::Win32::Networking::WindowsWebServices::WebAuthNAuthenticatorGetAssertion(
            unsafe { GetForegroundWindow() },
            &rp_id,
            std::ptr::addr_of!(client_data) as *const _,
            Some(&getassertopts),
        )
        .unwrap();
        *a
    };

    let id = unsafe {
        std::slice::from_raw_parts(
            assertion.Credential.pbId as *const u8,
            assertion.Credential.cbId as usize,
        )
    };

    let signature = unsafe {
        std::slice::from_raw_parts(
            assertion.pbSignature as *const u8,
            assertion.cbSignature as usize,
        )
    };

    let authenticator_data = unsafe {
        std::slice::from_raw_parts(
            assertion.pbAuthenticatorData as *const u8,
            assertion.cbAuthenticatorData as usize,
        )
    };

    Ok(PublicKeyCredential {
        id: BASE64_URL_SAFE_NO_PAD.encode(id),
        raw_id: id.to_vec(),
        response: crate::AuthenticatorAssertionResponse {
            authenticator_data: public_key_credential.response.authenticator_data.to_vec(),
            client_data_json: public_key_credential.response.client_data_json.to_vec(),
            signature: signature.to_vec(),
            user_handle: public_key_credential.response.user_handle.map(|h| h.to_vec()).unwrap_or_default(),
        },
        prf: public_key_credential.extensions.hmac_get_secret.map(|hmac| {
            let mut prf_bytes = [0u8; 32];
            prf_bytes.copy_from_slice(&hmac.output1.to_vec().as_slice()[..32]);
            prf_bytes
        }),
        authenticator_attachment: "cross-platform".to_string(),
        r#type: public_key_credential.type_,
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
        let options = 
AssertionOptions {
            challenge: vec![0u8; 32],
            timeout: 0,
            rpid: "vault.usdev.bitwarden.pw".to_string(),
            user_verification: crate::UserVerification::Required,
            allow_credentials: vec![],
            prf_eval_first: [0u8; 32],
            prf_eval_second: None,
        };
        let result = get(options);
        println!("{:?}", result.unwrap());
    }
}