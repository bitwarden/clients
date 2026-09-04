//! Wire protocol spoken between the credential agent and its clients.
//!
//! The transport is newline-delimited JSON over a Unix domain socket (or a Windows named pipe).
//! A client writes exactly one [`Request`] line and reads exactly one [`Response`] line back.
//!
//! ```text
//! -> {"version":1,"action":"getCredential","uri":"https://github.com"}
//! <- {"status":"ok","credential":{"cipherId":"...","name":"GitHub","username":"me","password":"..."}}
//! ```

use std::fmt;

use serde::{Deserialize, Serialize};

/// The only protocol version this agent understands.
pub const PROTOCOL_VERSION: u32 = 1;

/// Upper bound on a single request line, guarding against unbounded buffering
/// by a malicious or broken client.
pub(crate) const MAX_REQUEST_LEN: usize = 64 * 1024;

/// A request sent by a client.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    /// Must equal [`PROTOCOL_VERSION`].
    pub version: u32,
    #[serde(flatten)]
    pub action: Action,
}

/// The operation a client is asking for.
#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum Action {
    /// Look up a single login credential.
    GetCredential(CredentialQuery),
}

/// Selects which vault item a client wants. At least one field must be set;
/// when both are set the item must match both.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialQuery {
    /// A URI to match against the item's configured login URIs.
    pub uri: Option<String>,
    /// A (case-insensitive, substring) match against the item's name.
    pub name: Option<String>,
}

impl CredentialQuery {
    pub(crate) fn is_empty(&self) -> bool {
        self.uri.is_none() && self.name.is_none()
    }
}

/// A login credential returned to a client.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Credential {
    pub cipher_id: String,
    pub name: String,
    pub username: Option<String>,
    pub password: Option<String>,
    /// Current TOTP code, when the item has a TOTP seed and the client asked for it.
    pub totp: Option<String>,
}

// Hand-written so a stray `{:?}` can never spill a password into the logs.
impl fmt::Debug for Credential {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Credential")
            .field("cipher_id", &self.cipher_id)
            .field("name", &self.name)
            .field("username", &"<redacted>")
            .field("password", &"<redacted>")
            .field("totp", &"<redacted>")
            .finish()
    }
}

/// The reply written back to a client.
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub enum Response {
    Ok {
        credential: Credential,
    },
    /// The user (or their configured approval policy) refused the request.
    Denied,
    /// No vault item matched the query.
    NotFound,
    /// The request could not be served; `message` never contains vault data.
    Error {
        message: String,
    },
}

impl Response {
    pub(crate) fn error(message: impl Into<String>) -> Self {
        Self::Error {
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parses_get_credential_request() {
        let raw = r#"{"version":1,"action":"getCredential","uri":"https://github.com"}"#;

        let request: Request = serde_json::from_str(raw).unwrap();

        assert_eq!(request.version, PROTOCOL_VERSION);
        let Action::GetCredential(query) = request.action;
        assert_eq!(query.uri.as_deref(), Some("https://github.com"));
        assert!(query.name.is_none());
    }

    #[test]
    fn test_rejects_unknown_action() {
        let raw = r#"{"version":1,"action":"deleteEverything"}"#;

        assert!(serde_json::from_str::<Request>(raw).is_err());
    }

    #[test]
    fn test_empty_query_is_detected() {
        assert!(CredentialQuery::default().is_empty());
        assert!(!CredentialQuery {
            name: Some("GitHub".to_string()),
            ..Default::default()
        }
        .is_empty());
    }

    #[test]
    fn test_credential_debug_redacts_secrets() {
        let credential = Credential {
            cipher_id: "id".to_string(),
            name: "GitHub".to_string(),
            username: Some("me".to_string()),
            password: Some("hunter2".to_string()),
            totp: Some("123456".to_string()),
        };

        let rendered = format!("{credential:?}");

        assert!(!rendered.contains("hunter2"));
        assert!(!rendered.contains("123456"));
        assert!(rendered.contains("GitHub"));
    }

    #[test]
    fn test_response_serialization_is_tagged() {
        let denied = serde_json::to_string(&Response::Denied).unwrap();

        assert_eq!(denied, r#"{"status":"denied"}"#);
    }
}
