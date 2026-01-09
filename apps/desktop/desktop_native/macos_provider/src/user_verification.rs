use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserVerificationRequest {
    pub(crate) transaction_id: u32,
    pub(crate) display_hint: String,
    pub(crate) username: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserVerificationResponse {
    pub(crate) user_verified: bool,
}
