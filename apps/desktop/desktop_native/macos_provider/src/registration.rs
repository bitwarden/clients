use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::{BitwardenError, Callback, UserVerification};

#[derive(uniffi::Record, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationRequest {
    rp_id: String,
    user_name: String,
    user_handle: Vec<u8>,
    client_data_hash: Vec<u8>,
    user_verification: UserVerification,
    supported_algorithms: Vec<i32>,
}

#[derive(uniffi::Record, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationResponse {
    rp_id: String,
    client_data_hash: Vec<u8>,
    credential_id: Vec<u8>,
    attestation_object: Vec<u8>,
}

#[uniffi::export(with_foreign)]
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
