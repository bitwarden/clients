use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, Position, UserVerification};

#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationRequest {
    pub rp_id: String,
    pub user_name: String,
    pub user_handle: Vec<u8>,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerification,
    pub supported_algorithms: Vec<i32>,
    pub window_xy: Position,
    pub excluded_credentials: Vec<Vec<u8>>,
    #[cfg(not(target_os = "macos"))]
    pub client_window_handle: Vec<u8>,
    #[cfg(not(target_os = "macos"))]
    pub context: String,
}

#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationResponse {
    pub rp_id: String,
    pub client_data_hash: Vec<u8>,
    pub credential_id: Vec<u8>,
    pub attestation_object: Vec<u8>,
}

#[cfg_attr(target_os = "macos", uniffi::export(with_foreign))]
pub trait PreparePasskeyRegistrationCallback: Send + Sync {
    fn on_complete(&self, credential: PasskeyRegistrationResponse);
    fn on_error(&self, error: BitwardenError);
}

impl Callback for Arc<dyn PreparePasskeyRegistrationCallback> {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error> {
        let credential = serde_json::from_value(credential)?;
        PreparePasskeyRegistrationCallback::on_complete(self.as_ref(), credential);
        Ok(())
    }

    fn error(&self, error: BitwardenError) {
        PreparePasskeyRegistrationCallback::on_error(self.as_ref(), error);
    }
}
