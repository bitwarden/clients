use std::sync::Arc;

use serde::{Deserialize, Serialize};

#[cfg(not(target_os = "macos"))]
use crate::TimedCallback;
use crate::{BitwardenError, Callback, Position, UserVerification};

#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionRequest {
    pub rp_id: String,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerification,
    pub allowed_credentials: Vec<Vec<u8>>,
    pub window_xy: Position,
    #[cfg(not(target_os = "macos"))]
    pub client_window_handle: Vec<u8>,
    #[cfg(not(target_os = "macos"))]
    pub context: String,
    // pub extension_input: Vec<u8>, TODO: Implement support for extensions
}

#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionWithoutUserInterfaceRequest {
    pub rp_id: String,
    pub credential_id: Vec<u8>,
    #[cfg(target_os = "macos")]
    pub user_name: String,
    #[cfg(target_os = "macos")]
    pub user_handle: Vec<u8>,
    #[cfg(target_os = "macos")]
    pub record_identifier: Option<String>,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerification,
    pub window_xy: Position,
    #[cfg(not(target_os = "macos"))]
    pub client_window_handle: Vec<u8>,
    #[cfg(not(target_os = "macos"))]
    pub context: String,
}

#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionResponse {
    pub rp_id: String,
    pub user_handle: Vec<u8>,
    pub signature: Vec<u8>,
    pub client_data_hash: Vec<u8>,
    pub authenticator_data: Vec<u8>,
    pub credential_id: Vec<u8>,
}

#[cfg_attr(target_os = "macos", uniffi::export(with_foreign))]
pub trait PreparePasskeyAssertionCallback: Send + Sync {
    fn on_complete(&self, credential: PasskeyAssertionResponse);
    fn on_error(&self, error: BitwardenError);
}

impl Callback for Arc<dyn PreparePasskeyAssertionCallback> {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error> {
        let credential = serde_json::from_value(credential)?;
        PreparePasskeyAssertionCallback::on_complete(self.as_ref(), credential);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        PreparePasskeyAssertionCallback::on_error(self.as_ref(), error);
    }
}

#[cfg(not(target_os = "macos"))]
impl PreparePasskeyAssertionCallback for TimedCallback<PasskeyAssertionResponse> {
    fn on_complete(&self, credential: PasskeyAssertionResponse) {
        self.send(Ok(credential));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error))
    }
}
