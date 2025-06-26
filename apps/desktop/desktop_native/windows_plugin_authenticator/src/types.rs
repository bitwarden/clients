use tokio::sync::oneshot;

/// Assertion request structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyAssertionRequest {
    pub rp_id: String,
    pub transaction_id: String,
    pub client_data_hash: Vec<u8>,
    pub allowed_credentials: Vec<Vec<u8>>,
    pub user_verification: bool,
}

/// Registration request structure
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PasskeyRegistrationRequest {
    pub rp_id: String,
    pub transaction_id: String,
    pub user_id: Vec<u8>,
    pub user_name: String,
    pub client_data_hash: Vec<u8>,
    pub user_verification: bool,
    pub supported_algorithms: Vec<i32>,  // COSE algorithm identifiers
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
    #[serde(rename = "assertion_response",rename_all = "camelCase")]
    AssertionResponse {
        credential_id: Vec<u8>,
        authenticator_data: Vec<u8>,
        signature: Vec<u8>,
        user_handle: Vec<u8>,
    },
    #[serde(rename = "registration_response",rename_all = "camelCase")]
    RegistrationResponse {
        credential_id: Vec<u8>,
        attestation_object: Vec<u8>,
    },
    #[serde(rename = "sync_response",rename_all = "camelCase")]
    SyncResponse {
        credentials: Vec<SyncedCredential>,
    },
    #[serde(rename = "error",rename_all = "camelCase")]
    Error {
        message: String,
    },
}

/// Credential data for sync operations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncedCredential {
    pub credential_id: Vec<u8>,
    pub rp_id: String,
    pub user_name: String,
    pub user_id: Vec<u8>,
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