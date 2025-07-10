use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;

/// User verification requirement as defined by WebAuthn spec
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserVerificationRequirement {
    Required,
    Preferred,
    Discouraged,
}

impl Default for UserVerificationRequirement {
    fn default() -> Self {
        UserVerificationRequirement::Preferred
    }
}

impl From<u32> for UserVerificationRequirement {
    fn from(value: u32) -> Self {
        match value {
            1 => UserVerificationRequirement::Required,
            2 => UserVerificationRequirement::Preferred,
            3 => UserVerificationRequirement::Discouraged,
            _ => UserVerificationRequirement::Preferred, // Default fallback
        }
    }
}

impl Into<String> for UserVerificationRequirement {
    fn into(self) -> String {
        match self {
            UserVerificationRequirement::Required => "required".to_string(),
            UserVerificationRequirement::Preferred => "preferred".to_string(),
            UserVerificationRequirement::Discouraged => "discouraged".to_string(),
        }
    }
}

/// IDENTICAL to napi/lib.rs/PasskeyAssertionRequest
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionRequest {
    pub rp_id: String,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerificationRequirement,
    pub allowed_credentials: Vec<Vec<u8>>,
    pub window_xy: Position,

    pub transaction_id: String,
}

// Identical to napi/lib.rs/Position
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

/// IDENTICAL to napi/lib.rs/PasskeyRegistrationRequest
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationRequest {
    pub rp_id: String,
    pub user_name: String,
    pub user_handle: Vec<u8>,
    pub client_data_hash: Vec<u8>,
    pub user_verification: UserVerificationRequirement,
    pub supported_algorithms: Vec<i32>,
    pub window_xy: Position,
    pub excluded_credentials: Vec<Vec<u8>>,

    pub transaction_id: String,
}

/// Sync request structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeySyncRequest {
    pub rp_id: String,
}

/// Union type for different request types
#[derive(Debug, Clone)]
pub enum PasskeyRequest {
    AssertionRequest(PasskeyAssertionRequest),
    RegistrationRequest(PasskeyRegistrationRequest),
    SyncRequest(PasskeySyncRequest),
}

/// Response types for different operations - kept as tagged enum for JSON compatibility
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PasskeyResponse {
    #[serde(rename = "assertion_response", rename_all = "camelCase")]
    AssertionResponse {
        rp_id: String,
        user_handle: Vec<u8>,
        signature: Vec<u8>,
        client_data_hash: Vec<u8>,
        authenticator_data: Vec<u8>,
        credential_id: Vec<u8>,
    },
    #[serde(rename = "registration_response", rename_all = "camelCase")]
    RegistrationResponse {
        rp_id: String,
        client_data_hash: Vec<u8>,
        credential_id: Vec<u8>,
        attestation_object: Vec<u8>,
    },
    #[serde(rename = "sync_response", rename_all = "camelCase")]
    SyncResponse { credentials: Vec<SyncedCredential> },
    #[serde(rename = "error", rename_all = "camelCase")]
    Error { message: String },
}

/// Credential data for sync operations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedCredential {
    pub credential_id: Vec<u8>,
    pub rp_id: String,
    pub user_name: String,
    pub user_handle: Vec<u8>,
}

/// Request type enumeration for type discrimination
#[derive(Debug, Clone)]
pub enum RequestType {
    Assertion,
    Registration,
    Sync,
}

/// Internal request event with response channel and serializable request data
#[derive(Debug)]
pub struct RequestEvent {
    pub request_type: RequestType,
    pub request_json: String,
    pub response_sender: oneshot::Sender<PasskeyResponse>,
}
