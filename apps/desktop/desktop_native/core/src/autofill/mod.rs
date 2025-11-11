#[allow(clippy::module_inception)]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod autofill;
pub use autofill::*;
use serde::{de::Visitor, Deserialize, Deserializer, Serialize};
use serde_json::Value;

#[derive(Deserialize)]
struct RunCommandRequest {
    #[serde(rename = "namespace")]
    namespace: String,
    #[serde(rename = "command")]
    command: RunCommand,
    #[serde(rename = "params")]
    params: Value,
}

#[derive(Deserialize)]
enum RunCommand {
    #[serde(rename = "status")]
    Status,
    #[serde(rename = "sync")]
    Sync,
    #[serde(rename = "user-verification")]
    UserVerification,
}

#[derive(Debug, Deserialize)]
struct SyncParameters {
    #[serde(rename = "credentials")]
    pub(crate) credentials: Vec<SyncCredential>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum SyncCredential {
    #[serde(rename = "login")]
    Login {
        #[serde(rename = "cipherId")]
        cipher_id: String,
        password: String,
        uri: String,
        username: String,
    },
    #[serde(rename = "fido2")]
    Fido2 {
        #[serde(rename = "cipherId")]
        cipher_id: String,

        #[serde(rename = "rpId")]
        rp_id: String,

        /// Base64-encoded
        #[serde(rename = "credentialId")]
        credential_id: String,

        #[serde(rename = "userName")]
        user_name: String,

        /// Base64-encoded
        #[serde(rename = "userHandle")]
        user_handle: String,
    },
}

#[derive(Serialize)]
struct StatusResponse {
    support: StatusSupport,
    state: StatusState,
}

#[derive(Serialize)]
struct StatusSupport {
    fido2: bool,
    password: bool,
    #[serde(rename = "incrementalUpdates")]
    incremental_updates: bool,
}

#[derive(Serialize)]
struct StatusState {
    enabled: bool,
}

#[derive(Serialize)]
struct SyncResponse {
    added: u32,
}

#[derive(Debug, Deserialize)]
struct UserVerificationParameters {
    #[serde(rename = "windowHandle", deserialize_with = "deserialize_b64")]
    window_handle: Vec<u8>,
    #[serde(rename = "transactionContext", deserialize_with = "deserialize_b64")]
    pub(crate) transaction_context: Vec<u8>,
    #[serde(rename = "displayHint")]
    pub(crate) display_hint: String,
    pub(crate) username: String,
}
#[derive(Serialize)]
struct UserVerificationResponse {}

#[derive(Serialize)]
#[serde(tag = "type")]
enum CommandResponse {
    #[serde(rename = "success")]
    Success { value: Value },
    #[serde(rename = "error")]
    Error { error: String },
}

impl From<anyhow::Result<Value>> for CommandResponse {
    fn from(value: anyhow::Result<Value>) -> Self {
        match value {
            Ok(response) => Self::Success { value: response },
            Err(err) => Self::Error {
                error: err.to_string(),
            },
        }
    }
}

impl TryFrom<StatusResponse> for CommandResponse {
    type Error = anyhow::Error;

    fn try_from(response: StatusResponse) -> Result<Self, anyhow::Error> {
        Ok(Self::Success {
            value: serde_json::to_value(response)?,
        })
    }
}

impl TryFrom<SyncResponse> for CommandResponse {
    type Error = anyhow::Error;

    fn try_from(response: SyncResponse) -> Result<Self, anyhow::Error> {
        Ok(Self::Success {
            value: serde_json::to_value(response)?,
        })
    }
}

impl TryFrom<UserVerificationResponse> for CommandResponse {
    type Error = anyhow::Error;

    fn try_from(response: UserVerificationResponse) -> Result<Self, anyhow::Error> {
        Ok(Self::Success {
            value: serde_json::to_value(response)?,
        })
    }
}

fn deserialize_b64<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
    deserializer.deserialize_str(Base64Visitor {})
}

struct Base64Visitor;
impl<'de> Visitor<'de> for Base64Visitor {
    type Value = Vec<u8>;

    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str("A valid base64 string")
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        STANDARD.decode(v).map_err(|err| E::custom(err))
    }
}
