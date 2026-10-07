//! Local wire protocol: one JSON line in, one out, then the connection closes.
//!
//! Payloads mirror Agent Access §5 (`ap_client::CredentialQuery` / `CredentialData`), so a local
//! request can be forwarded over AAP unchanged. Only Noise, pairing and the relay are absent.
//!
//! ```text
//! -> {"v":1,"type":"credential-request","requestId":"r1","query":{"domain":"github.com"}}
//! <- {"v":1,"type":"credential-response","requestId":"r1","status":"approved","credential":{...}}
//! ```

use std::{collections::BTreeMap, fmt};

use serde::{Deserialize, Serialize};

pub const PROTOCOL_VERSION: u32 = 1;

/// Bounds a request line so a client cannot make the agent buffer without limit.
pub(crate) const MAX_REQUEST_LEN: usize = 64 * 1024;

#[derive(Debug, Deserialize)]
pub struct Envelope {
    pub v: u32,
    #[serde(flatten)]
    pub request: Request,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Request {
    CredentialRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        query: CredentialQuery,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        purpose: Option<Purpose>,
    },
    /// Generic human-in-the-loop prompt; answered by whoever answers credential requests.
    ApprovalRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        prompt: ApprovalPrompt,
    },
}

impl Request {
    pub fn request_id(&self) -> &str {
        match self {
            Self::CredentialRequest { request_id, .. }
            | Self::ApprovalRequest { request_id, .. } => request_id,
        }
    }
}

/// Wire-identical to `ap_client::CredentialQuery`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CredentialQuery {
    Domain(String),
    Id(String),
    Search(String),
}

impl CredentialQuery {
    fn value(&self) -> &str {
        match self {
            Self::Domain(value) | Self::Id(value) | Self::Search(value) => value,
        }
    }
}

/// Client-reported and display-only; never used for trust.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Purpose {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    /// Environment variable → credential field, as `bw-access run --env` will set them.
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ApprovalPrompt {
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
}

/// Wire-identical to `ap_client::CredentialData`; `notes` is never sent locally.
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialData {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub totp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub domain: Option<String>,
}

impl fmt::Debug for CredentialData {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("CredentialData")
            .field("credential_id", &self.credential_id)
            .field("domain", &self.domain)
            .field("username", &"<redacted>")
            .field("password", &"<redacted>")
            .field("totp", &"<redacted>")
            .finish()
    }
}

/// The structured outcome AAP §5.4 leaves open; sent on every response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Approved,
    Denied,
    NotFound,
    Locked,
    Timeout,
    Error,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Response {
    CredentialResponse {
        #[serde(rename = "requestId")]
        request_id: String,
        status: Status,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        credential: Option<CredentialData>,
        /// Never contains vault data.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    ApprovalResponse {
        #[serde(rename = "requestId")]
        request_id: String,
        status: Status,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    /// The request could not be parsed, so its kind and id are unknown.
    Error { status: Status, error: String },
}

#[derive(Serialize)]
pub(crate) struct Versioned<'a> {
    pub v: u32,
    #[serde(flatten)]
    pub response: &'a Response,
}

/// Errors are fixed strings so nothing from the request is echoed back.
pub(crate) fn parse_request(line: &str) -> Result<Request, &'static str> {
    #[derive(Deserialize)]
    struct Version {
        v: u32,
    }

    let Version { v } = serde_json::from_str(line).map_err(|_| "malformed request")?;
    if v != PROTOCOL_VERSION {
        return Err("unsupported protocol version; expected v1");
    }

    let Envelope { request, .. } = serde_json::from_str(line).map_err(|_| "malformed request")?;
    if let Request::CredentialRequest { query, .. } = &request {
        if query.value().trim().is_empty() {
            return Err("the query must not be empty");
        }
    }
    Ok(request)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parses_credential_request() {
        let raw = r#"{"v":1,"type":"credential-request","requestId":"r1","query":{"domain":"github.com"}}"#;

        let envelope: Envelope = serde_json::from_str(raw).unwrap();

        assert_eq!(envelope.v, PROTOCOL_VERSION);
        let Request::CredentialRequest {
            request_id, query, ..
        } = envelope.request
        else {
            panic!("expected a credential request");
        };
        assert_eq!(request_id, "r1");
        assert_eq!(query, CredentialQuery::Domain("github.com".into()));
    }

    #[test]
    fn test_query_matches_aap_external_tagging() {
        // AAP §5.1 serializes CredentialQuery externally tagged.
        for (query, json) in [
            (
                CredentialQuery::Domain("a.com".into()),
                r#"{"domain":"a.com"}"#,
            ),
            (CredentialQuery::Id("1".into()), r#"{"id":"1"}"#),
            (CredentialQuery::Search("x".into()), r#"{"search":"x"}"#),
        ] {
            assert_eq!(serde_json::to_string(&query).unwrap(), json);
        }
    }

    #[test]
    fn test_parses_purpose() {
        let raw = r#"{"v":1,"type":"credential-request","requestId":"r1","query":{"id":"x"},"purpose":{"command":"gh pr create","env":{"GH_TOKEN":"password"}}}"#;

        let Request::CredentialRequest { purpose, .. } = parse_request(raw).unwrap() else {
            panic!("expected a credential request");
        };

        let purpose = purpose.unwrap();
        assert_eq!(purpose.command.as_deref(), Some("gh pr create"));
        assert_eq!(
            purpose.env.get("GH_TOKEN").map(String::as_str),
            Some("password")
        );
    }

    #[test]
    fn test_rejects_bad_requests_with_fixed_messages() {
        for (raw, error) in [
            ("not json", "malformed request"),
            (
                r#"{"v":2,"type":"future"}"#,
                "unsupported protocol version; expected v1",
            ),
            (
                r#"{"v":1,"type":"nope","requestId":"r"}"#,
                "malformed request",
            ),
            (
                r#"{"v":1,"type":"credential-request","requestId":"r","query":{"domain":" "}}"#,
                "the query must not be empty",
            ),
        ] {
            assert_eq!(parse_request(raw).unwrap_err(), error, "for {raw}");
        }
    }

    #[test]
    fn test_ignores_unknown_fields() {
        let raw = r#"{"v":1,"type":"approval-request","requestId":"r","prompt":{"title":"t","x":1},"client":"y"}"#;

        assert!(parse_request(raw).is_ok());
    }

    #[test]
    fn test_parses_approval_request() {
        let raw =
            r#"{"v":1,"type":"approval-request","requestId":"r2","prompt":{"title":"Deploy?"}}"#;

        let envelope: Envelope = serde_json::from_str(raw).unwrap();

        assert!(matches!(envelope.request, Request::ApprovalRequest { .. }));
    }

    #[test]
    fn test_response_carries_version_and_status() {
        let response = Response::CredentialResponse {
            request_id: "r1".into(),
            status: Status::Denied,
            credential: None,
            error: None,
        };

        let json = serde_json::to_string(&Versioned {
            v: PROTOCOL_VERSION,
            response: &response,
        })
        .unwrap();

        assert_eq!(
            json,
            r#"{"v":1,"type":"credential-response","requestId":"r1","status":"denied"}"#
        );
    }

    #[test]
    fn test_debug_redacts_secrets() {
        let credential = CredentialData {
            password: Some("hunter2".into()),
            ..Default::default()
        };

        assert!(!format!("{credential:?}").contains("hunter2"));
    }
}
