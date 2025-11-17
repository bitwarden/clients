use base64::{prelude::BASE64_URL_SAFE_NO_PAD, Engine};
use ctap_hid_fido2::{
    fidokey::{AssertionExtension, GetAssertionArgsBuilder},
    Cfg, FidoKeyHidFactory,
};
use pinentry::PassphraseInput;
use secrecy::ExposeSecret;

use crate::{
    prf_to_hmac, AuthenticatorAssertionResponse, Fido2ClientError, PublicKeyCredential,
    PublicKeyCredentialRequestOptions,
};

fn get_pin() -> Option<String> {
    if let Some(mut input) = PassphraseInput::with_default_binary() {
        input
            .with_description("Enter your FIDO2 Authenticator PIN:")
            .with_prompt("PIN:")
            .interact()
            .ok()
            .map(|p| p.expose_secret().to_owned())
    } else {
        None
    }
}

pub fn available() -> bool {
    true
}

fn make_assertion(
    options: PublicKeyCredentialRequestOptions,
    client_data_json: String,
    credential: Option<&[u8]>,
) -> Result<GetAssertionArgsBuilder, Fido2ClientError> {
    let mut get_assertion_args =
        GetAssertionArgsBuilder::new(options.rp_id.as_str(), client_data_json.as_bytes())
            .extensions(&[AssertionExtension::HmacSecret(Some(prf_to_hmac(
                &options.prf_eval_first,
            )))]);

    if let Some(cred) = credential {
        get_assertion_args = get_assertion_args.credential_id(cred);
    }
    Ok(get_assertion_args)
}

pub fn get(
    options: PublicKeyCredentialRequestOptions,
) -> Result<PublicKeyCredential, Fido2ClientError> {
    let device = FidoKeyHidFactory::create(&Cfg::init()).map_err(|_| Fido2ClientError::NoDevice)?;

    let client_data_json = format!(
        r#"{{"type":"webauthn.get","challenge":"{}","origin":"https://{}","crossOrigin": true}}"#,
        BASE64_URL_SAFE_NO_PAD.encode(&options.challenge),
        options.rp_id
    );

    let mut get_assertion_args = make_assertion(
        options.clone(),
        client_data_json.clone(),
        options.allow_credentials.get(0).map(|v| v.as_slice()),
    )?;

    let pin: String;
    if options.user_verification == crate::UserVerification::Required
        || options.user_verification == crate::UserVerification::Preferred
    {
        pin = get_pin().ok_or(Fido2ClientError::WrongPin)?;
        get_assertion_args = get_assertion_args.pin(pin.as_str());
    }

    let mut assertions = device
        .get_assertion_with_args(&get_assertion_args.build())
        .map_err(|_e| Fido2ClientError::AssertionError)?;

    let assertion = if assertions.len() > 1 {
        let first_assertion = &assertions[0];
        let mut get_assertion_args = make_assertion(
            options.clone(),
            client_data_json.clone(),
            Some(&first_assertion.credential_id),
        )?;
        let pin: String;
        if options.user_verification == crate::UserVerification::Required
            || options.user_verification == crate::UserVerification::Preferred
        {
            pin = get_pin().ok_or(Fido2ClientError::WrongPin)?;
            get_assertion_args = get_assertion_args.pin(pin.as_str());
        }

        assertions = device
            .get_assertion_with_args(&get_assertion_args.build())
            .map_err(|_e| Fido2ClientError::AssertionError)?;
        assertions.get(0).ok_or(Fido2ClientError::AssertionError)?
    } else {
        assertions.get(0).ok_or(Fido2ClientError::AssertionError)?
    };

    let prf_extension = assertion
        .extensions
        .iter()
        .find_map(|ext| {
            if let AssertionExtension::HmacSecret(results) = ext {
                Some(*results)
            } else {
                None
            }
        })
        .flatten();

    Ok(PublicKeyCredential {
        authenticator_attachment: "cross-platform".to_string(),
        id: BASE64_URL_SAFE_NO_PAD.encode(&assertion.credential_id),
        raw_id: assertion.credential_id.clone(),
        response: AuthenticatorAssertionResponse {
            authenticator_data: assertion.auth_data.clone(),
            client_data_json: client_data_json.as_bytes().to_vec(),
            signature: assertion.signature.clone(),
            user_handle: assertion.user.id.clone(),
        },
        r#type: "public-key".to_string(),
        prf: prf_extension,
    })
}

#[cfg(test)]
mod tests {
    use crate::{ctap_hid_fido2::get, PublicKeyCredentialRequestOptions};

    #[test]
    #[ignore]
    fn assertion() {
        get(PublicKeyCredentialRequestOptions {
            challenge: vec![],
            timeout: 0,
            rp_id: "vault.usdev.bitwarden.pw".to_string(),
            user_verification: crate::UserVerification::Required,
            allow_credentials: vec![],
            prf_eval_first: [0u8; 32],
            prf_eval_second: None,
        })
        .unwrap();
    }
}
