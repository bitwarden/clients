use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, Position, UserVerification};

#[derive(uniffi::Record, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionRequest {
    rp_id: String,
    client_data_hash: Vec<u8>,
    user_verification: UserVerification,
    allowed_credentials: Vec<Vec<u8>>,
    window_xy: Position,
    //extension_input: Vec<u8>, TODO: Implement support for extensions
}

#[derive(uniffi::Record, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionWithoutUserInterfaceRequest {
    rp_id: String,
    credential_id: Vec<u8>,
    user_name: String,
    user_handle: Vec<u8>,
    record_identifier: Option<String>,
    client_data_hash: Vec<u8>,
    user_verification: UserVerification,
    window_xy: Position,
}

#[derive(uniffi::Record, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionResponse {
    rp_id: String,
    user_handle: Vec<u8>,
    signature: Vec<u8>,
    client_data_hash: Vec<u8>,
    authenticator_data: Vec<u8>,
    credential_id: Vec<u8>,
}

#[uniffi::export(with_foreign)]
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
