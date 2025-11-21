use base64::{prelude::BASE64_URL_SAFE_NO_PAD, Engine};
use ctap_hid_fido2::{
    Cfg, FidoKeyHid, FidoKeyHidFactory, fidokey::{AssertionExtension, GetAssertionArgsBuilder, get_assertion::get_assertion_params::GetAssertionArgs}
};
use pinentry::PassphraseInput;
use secrecy::ExposeSecret;

use crate::{
    prf_to_hmac, AssertionOptions, AuthenticatorAssertionResponse, Fido2ClientError,
    PublicKeyCredential,
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

fn make_assertion(options: AssertionOptions, client_data_json: String, credential: Option<&[u8]>, pin: Option<String>) -> Result<GetAssertionArgs, Fido2ClientError> {
    let mut get_assertion_args =
        GetAssertionArgsBuilder::new(options.rpid.as_str(), client_data_json.as_bytes())
            .extensions(&[AssertionExtension::HmacSecret(Some(prf_to_hmac(
                &options.prf_eval_first,
            )))]);

    if pin.is_some() {
        get_assertion_args = get_assertion_args.pin(pin.as_ref().unwrap());
    }

    if let Some(cred) = credential {
        get_assertion_args = get_assertion_args.credential_id(cred);
    }

    Ok(get_assertion_args.build())
}

pub fn get(options: AssertionOptions) -> Result<PublicKeyCredential, Fido2ClientError> {
    let device = FidoKeyHidFactory::create(&Cfg::init()).map_err(|_| Fido2ClientError::NoDevice)?;

    let client_data_json = format!(
        r#"{{"type":"webauthn.get","challenge":"{}","origin":"https://{}","crossOrigin": true}}"#,
        BASE64_URL_SAFE_NO_PAD.encode(&options.challenge),
        options.rpid
    );

    let pin: Option<String>;
    if options.user_verification == crate::UserVerification::Required
        || options.user_verification == crate::UserVerification::Preferred
    {
        pin = Some(get_pin().ok_or(Fido2ClientError::WrongPin)?);
    }
    

    let assertions = device
        .get_assertion_with_args(&get_assertion_args.build())
        .map_err(|_e| {
            Fido2ClientError::AssertionError
        })?;

    let assertion = if assertions.len() > 1 {
        let first_assertion = &assertions[0];
        let mut get_assertion_args = get_assertion_args.credential_id(&first_assertion.credential_id);
        let assertions = device
            .get_assertion_with_args(&get_assertion_args.build())
            .map_err(|_e| {
                Fido2ClientError::AssertionError
            })?;
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
    use crate::{ctap_hid_fido2::get, AssertionOptions};

    #[test]
    #[ignore]
    fn assertion() {
        get(AssertionOptions {
            challenge: vec![],
            timeout: 0,
            rpid: "vault.usdev.bitwarden.pw".to_string(),
            user_verification: crate::UserVerification::Required,
            allow_credentials: vec![],
            prf_eval_first: [0u8; 32],
            prf_eval_second: None,
        })
        .unwrap();
    }
}
