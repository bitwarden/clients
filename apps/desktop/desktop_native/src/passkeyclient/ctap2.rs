use napi::threadsafe_function::ErrorStrategy::CalleeHandled;
use napi::threadsafe_function::ThreadsafeFunction;
use serde::{Deserialize, Serialize};
use serde;
use webauthn_authenticator_rs::{ctap2::CtapAuthenticator, transport::{AnyTransport, TokenEvent, Transport}, types::{CableRequestType, CableState, EnrollSampleStatus}, ui::UiCallback, AuthenticatorBackend};
use webauthn_rs::prelude::{Base64UrlSafeData, Url};
use std::fmt::Debug;
use std::sync::{Arc, Mutex};
use futures::StreamExt;

// 3 minutes
const TIMEOUT: u32 = 3 * 60_000;

pub async fn authenticate(challenge: String, origin: String, pin: Option<String>, touch_required_callback: ThreadsafeFunction<(), CalleeHandled>, no_devices_callback: ThreadsafeFunction<(), CalleeHandled>) -> Result<String, anyhow::Error> {
    let pinentry = Pinentry {
        pin: Arc::new(Mutex::new(pin)),
        pin_required: Arc::new(Mutex::new(false)),
        touch_required_callback: touch_required_callback,
        no_devices_callback: no_devices_callback,
    };

    let mut auth = get_authenticator(&pinentry).await?;
    
    let origin = Url::parse(origin.as_str())?;
    let options = serde_json::from_str(challenge.as_str())?;
    let auth_result = auth.perform_auth(origin, options, TIMEOUT);
    if auth_result.is_err() && *pinentry.pin_required.lock().map_err(|e| anyhow::Error::msg(format!("Error: {:?}", e)))? {
        return Err(anyhow::Error::msg("Pin required"));
    }
    serialize_publickeycredential(auth_result.map_err(|e| anyhow::Error::msg(format!("Error: {:?}", e)))?)
}

struct Pinentry {
    pin: Arc<Mutex<Option<String>>>,
    pin_required: Arc<Mutex<bool>>,
    touch_required_callback: ThreadsafeFunction<(), CalleeHandled>,
    no_devices_callback: ThreadsafeFunction<(), CalleeHandled>,
}

// can't derive Debug because of the callbacks
impl Debug for Pinentry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Pinentry")
            .field("pin", &self.pin)
            .field("pin_required", &self.pin_required)
            .finish()
    }
}

async fn get_authenticator(ui: &Pinentry) -> Result<impl AuthenticatorBackend + '_, anyhow::Error> {
    let trans = AnyTransport::new().await.unwrap();
    match trans.watch().await {
        Ok(mut tokens) => {
            while let Some(event) =
            tokens.next().await {
                match event {
                    TokenEvent::Added(token) => {
                        let auth = CtapAuthenticator::new(token, ui).await;

                        if let Some(auth) = auth {
                            return Ok(auth);
                        }
                    }

                    TokenEvent::EnumerationComplete => {
                        ui.no_devices_callback.call(Ok(()), napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking);
                    }

                    TokenEvent::Removed(_) => {
                    }
                }
            }
        }
        Err(e) => {
            return Err(anyhow::Error::msg(format!("Error: {:?}", e)));
        }
    }
    Err(anyhow::Error::msg("No authenticator found"))
}

impl UiCallback for Pinentry {
    fn request_pin(&self) -> Option<String> {
        let mut pin_required = self.pin_required.lock().unwrap();
        *pin_required = true;

        let pin = self.pin.lock().unwrap().clone();
        pin
    }

    fn request_touch(&self) {
        self.touch_required_callback.call(Ok(()), napi::threadsafe_function::ThreadsafeFunctionCallMode::NonBlocking);
    }

    fn processing(&self) {
        println!("Unimplemented method processing called")
    }
    
    fn fingerprint_enrollment_feedback(
        &self,
        _remaining_samples: u32,
        _feedback: Option<EnrollSampleStatus>,
    ) {
        println!("Unimplemented method fingerprint_enrollment_feedback called")
    }
    
    fn cable_qr_code(&self, _request_type: CableRequestType, _url: String) {
        println!("Unimplemented method cable_qr_code called")
    }
    
    fn dismiss_qr_code(&self) {
        println!("Unimplemented method dismiss_qr_code called")
    }
    
    fn cable_status_update(&self, _state: CableState) {
        println!("Unimplemented method cable_status_update called")
    }
}

fn serialize_publickeycredential(credential: webauthn_rs::prelude::PublicKeyCredential) -> Result<String, anyhow::Error> {
    serde_json::to_string(&TwoFactorAuthToken {
        id: credential.id,
        raw_id: credential.raw_id,
        type_: credential.type_,
        response: WebauthnResponseData {
            authenticator_data: credential.response.authenticator_data,
            client_data_json: credential.response.client_data_json,
            signature: credential.response.signature,
        },
        extensions: WebauthnExtensions {
            appid: Some(false),
        },
    }).map_err(|e| anyhow::Error::msg(format!("Error: {:?}", e)))
}

#[derive(Debug, Serialize, Deserialize)]
struct WebauthnResponseData {
    #[serde(rename = "authenticatorData")]
    authenticator_data: Base64UrlSafeData,
    #[serde(rename = "clientDataJson")]
    client_data_json: Base64UrlSafeData,
    signature: Base64UrlSafeData,
}

#[derive(Debug, Serialize, Deserialize)]
struct WebauthnExtensions {
    appid: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
struct TwoFactorAuthToken {
    id: String,
    #[serde(rename = "rawId")]
    raw_id: Base64UrlSafeData,
    #[serde(rename = "type")]
    type_: String,
    #[serde(rename = "response")]
    response: WebauthnResponseData,
    extensions: WebauthnExtensions,
}

pub async fn supports_native_webauthn() -> Result<bool, anyhow::Error> {
    Ok(true)
}
