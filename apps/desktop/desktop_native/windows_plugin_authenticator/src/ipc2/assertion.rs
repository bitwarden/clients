use std::sync::Arc;

use serde::{Deserialize, Serialize};

use super::{BitwardenError, Callback, Position, UserVerification};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionRequest {
    pub rp_id: String,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerification,
    pub allowed_credentials: Vec<Vec<u8>>,
    pub window_xy: Position,
    // pub extension_input: Vec<u8>, TODO: Implement support for extensions
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionWithoutUserInterfaceRequest {
    pub rp_id: String,
    pub credential_id: Vec<u8>,
    // pub user_name: String,
    // pub user_handle: Vec<u8>,
    // pub record_identifier: Option<String>,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerification,
    pub window_xy: Position,
}

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
