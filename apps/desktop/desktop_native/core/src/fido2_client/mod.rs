use base64::{prelude::BASE64_URL_SAFE_NO_PAD, Engine};
use ctap_hid_fido2::{fidokey::GetAssertionArgsBuilder, Cfg, FidoKeyHidFactory};
use serde::{Deserialize, Serialize};

#[derive(Debug)]
pub enum Fido2ClientError {
    WrongPin,
    NoCredentials,
    NoDevice,
    InvalidInput,
    AssertionError,
}

pub fn authenticate(challenge: String, credentials: Vec<String>, rpid: String, pin: Option<String>) -> Result<String, Fido2ClientError> {
    let device = FidoKeyHidFactory::create(&Cfg::init()).map_err(|_| Fido2ClientError::NoDevice)?;
    let clientdata = format!(r#"{{"type":"webauthn.get","challenge":"{}","origin":"https://{}","crossOrigin": true}}"#, challenge, rpid);

    let mut get_assertion_args = GetAssertionArgsBuilder::new(rpid.as_str(), clientdata.as_bytes());

    let result = if let Some(pin) = pin {
        get_assertion_args = get_assertion_args.pin(&pin.as_str());
        let get_assertion_args = get_assertion_args.build();
        device.get_assertion_with_args(&get_assertion_args)
    } else {
        let mut get_assertion_args = get_assertion_args
            .without_pin_and_uv();
        for cred in credentials {
            let credid_bytes = BASE64_URL_SAFE_NO_PAD.decode(cred.as_bytes()).map_err(|_| Fido2ClientError::InvalidInput)?;
            get_assertion_args = get_assertion_args.credential_id(&credid_bytes);
        }
        let get_assertion_args = get_assertion_args.build();
        device.get_assertion_with_args(&get_assertion_args)
    };

    let assertion = match result {
        Ok(assertion) => assertion,
        Err(_) => {
            return Err(Fido2ClientError::NoCredentials);
        }
    };

    let assertion = assertion.get(0).ok_or(Fido2ClientError::AssertionError)?;

    let twofa_token = TwoFactorAuthToken{
        id: BASE64_URL_SAFE_NO_PAD.encode(assertion.credential_id.as_slice()),
        raw_id: BASE64_URL_SAFE_NO_PAD.encode(assertion.credential_id.as_slice()),
        type_: "public-key".to_string(),
        response: WebauthnResponseData {
            authenticator_data: BASE64_URL_SAFE_NO_PAD.encode(
                &assertion.auth_data.as_slice()
            ),
            client_data_json: BASE64_URL_SAFE_NO_PAD.encode(
                &clientdata.as_bytes()
            ),
            signature: BASE64_URL_SAFE_NO_PAD.encode(
                &assertion.signature.as_slice()
            ),
        },
        extensions: WebauthnExtensions {
            appid: Some(false),
        },
    };
    let twofa_token = serde_json::to_string(&twofa_token).map_err(|_| Fido2ClientError::AssertionError)?;

    Ok(twofa_token)
}

#[derive(Debug, Serialize, Deserialize)]
struct TwoFactorAuthToken {
    id: String,
    #[serde(rename = "rawId")]
    raw_id: String,
    #[serde(rename = "type")]
    type_: String,
    extensions: WebauthnExtensions,
    #[serde(rename = "response")]
    response: WebauthnResponseData,
}

#[derive(Debug, Serialize, Deserialize)]
struct WebauthnExtensions {
    appid: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct WebauthnResponseData {
    #[serde(rename = "authenticatorData")]
    authenticator_data: String,
    #[serde(rename = "clientDataJson")]
    client_data_json: String,
    signature: String,
}
