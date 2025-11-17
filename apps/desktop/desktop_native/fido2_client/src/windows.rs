use webauthn_authenticator_rs::{AuthenticatorBackend, prelude::Url, win10::Win10};
use webauthn_rs_proto::{HmacGetSecretInput, PublicKeyCredentialRequestOptions, RequestAuthenticationExtensions};

use crate::{AssertionOptions, Fido2ClientError, PublicKeyCredential};

pub fn get(options: AssertionOptions) -> Result<PublicKeyCredential, Fido2ClientError> {
    let uv = match options.user_verification {
        crate::UserVerification::Required => webauthn_rs_proto::UserVerificationPolicy::Required,
        crate::UserVerification::Preferred => webauthn_rs_proto::UserVerificationPolicy::Preferred,
        crate::UserVerification::Discouraged => webauthn_rs_proto::UserVerificationPolicy::Discouraged_DO_NOT_USE,
    };
    println!("User verification policy: {:?}", uv);

    let opts = PublicKeyCredentialRequestOptions {
        challenge: base64urlsafedata::Base64UrlSafeData::from(options.challenge),
        timeout: Some(options.timeout as u32),
        rp_id: options.rpid,
        allow_credentials: vec![],
        user_verification: uv,
        hints: None,
        extensions: Some(RequestAuthenticationExtensions {
            hmac_get_secret: Some(HmacGetSecretInput {
                output1: base64urlsafedata::Base64UrlSafeData::from(&options.prf_eval_first),
                output2: None,
            }),
            appid: None,
            uvm: None,
        })
    };
    println!("Prepared PublicKeyCredentialRequestOptions: {:?}", opts);
    let public_key_credential = Win10::default().perform_auth(Url::parse(
        "https://vault.usdev.bitwarden.pw",
    ).unwrap(), opts, 60000)
        .map_err(|_e| Fido2ClientError::AssertionError)?;
    println!("PublicKeyCredential: {:?}", public_key_credential);

    Ok(PublicKeyCredential {
        id: public_key_credential.id,
        raw_id: public_key_credential.raw_id.to_vec(),
        response: crate::AuthenticatorAssertionResponse {
            authenticator_data: public_key_credential.response.authenticator_data.to_vec(),
            client_data_json: public_key_credential.response.client_data_json.to_vec(),
            signature: public_key_credential.response.signature.to_vec(),
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