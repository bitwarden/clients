//! Forwards `ap_client::AuditLog` events to both `tracing` and a host-facing [`EventSink`].
//!
//! Only event names, connection types, request IDs, identity fingerprints, and field
//! *presence* flags are logged/forwarded — never credential values, PSKs, or identity key
//! material. Identity fingerprints are safe to forward: they're stable per-device public
//! identifiers (a SHA-256 hash of a public key), not secrets. User-supplied connection names
//! are only forwarded when `ap_client` itself already attaches one to the event (the name
//! chosen at pairing time) — this module never looks one up just to populate an event.
//!
//! [`ForwardingAuditLog::write`] runs synchronously on `ap_client`'s event-loop task (see
//! `ap-client`'s `UserClientInner::handle_incoming`), so the [`EventSink`] half of the work is
//! detached onto its own task rather than awaited inline: a slow or hung host callback must
//! never stall the protocol event loop. `tracing` output stays inline since it's local and
//! fast.

use std::sync::Arc;

use ap_client::{AuditConnectionType, AuditEvent, AuditLog, CredentialFieldSet};
use async_trait::async_trait;
use tracing::info;

use crate::callbacks::{AgentAccessEvent, EventSink};

/// `AuditLog` implementation that logs presence-only summaries to `tracing` and forwards the
/// same information to an [`EventSink`] for the host's activity log.
pub struct ForwardingAuditLog {
    sink: Arc<dyn EventSink>,
}

impl ForwardingAuditLog {
    pub fn new(sink: Arc<dyn EventSink>) -> Self {
        Self { sink }
    }

    /// Hands `event` to the sink on its own detached task — see the module docs for why this
    /// must not be awaited inline from [`AuditLog::write`].
    fn forward(&self, event: AgentAccessEvent) {
        let sink = Arc::clone(&self.sink);
        tokio::spawn(async move {
            sink.on_event(event).await;
        });
    }
}

#[async_trait]
impl AuditLog for ForwardingAuditLog {
    async fn write(&self, event: AuditEvent<'_>) {
        match event {
            AuditEvent::ConnectionEstablished {
                remote_identity,
                remote_name,
                connection_type,
            } => {
                info!(
                    remote_identity = %remote_identity.to_hex(),
                    has_name = remote_name.is_some(),
                    connection_type = ?connection_type,
                    "agent_access: connection established"
                );
                self.forward(AgentAccessEvent {
                    kind: "connection_established".to_string(),
                    timestamp_ms: AgentAccessEvent::now_ms(),
                    peer_fingerprint: Some(remote_identity.to_hex()),
                    peer_name: remote_name.map(str::to_string),
                    detail: Some(connection_type_label(connection_type).to_string()),
                    fields_shared: None,
                });
            }
            AuditEvent::SessionRefreshed { remote_identity } => {
                info!(
                    remote_identity = %remote_identity.to_hex(),
                    "agent_access: session refreshed"
                );
                self.forward(AgentAccessEvent {
                    kind: "session_refreshed".to_string(),
                    timestamp_ms: AgentAccessEvent::now_ms(),
                    peer_fingerprint: Some(remote_identity.to_hex()),
                    peer_name: None,
                    detail: None,
                    fields_shared: None,
                });
            }
            AuditEvent::ConnectionRejected { remote_identity } => {
                info!(
                    remote_identity = %remote_identity.to_hex(),
                    "agent_access: connection rejected"
                );
                self.forward(AgentAccessEvent {
                    kind: "connection_rejected".to_string(),
                    timestamp_ms: AgentAccessEvent::now_ms(),
                    peer_fingerprint: Some(remote_identity.to_hex()),
                    peer_name: None,
                    detail: None,
                    fields_shared: None,
                });
            }
            AuditEvent::CredentialRequested {
                query,
                remote_identity,
                request_id,
            } => {
                info!(
                    remote_identity = %remote_identity.to_hex(),
                    request_id,
                    query_kind = query_kind(query),
                    "agent_access: credential requested"
                );
                self.forward(AgentAccessEvent {
                    kind: "credential_requested".to_string(),
                    timestamp_ms: AgentAccessEvent::now_ms(),
                    peer_fingerprint: Some(remote_identity.to_hex()),
                    peer_name: None,
                    detail: Some(query_kind(query).to_string()),
                    fields_shared: None,
                });
            }
            AuditEvent::CredentialApproved {
                remote_identity,
                request_id,
                fields,
                ..
            } => {
                info!(
                    remote_identity = %remote_identity.to_hex(),
                    request_id,
                    has_username = fields.has_username,
                    has_password = fields.has_password,
                    has_totp = fields.has_totp,
                    has_uri = fields.has_uri,
                    has_notes = fields.has_notes,
                    "agent_access: credential approved"
                );
                self.forward(AgentAccessEvent {
                    kind: "credential_approved".to_string(),
                    timestamp_ms: AgentAccessEvent::now_ms(),
                    peer_fingerprint: Some(remote_identity.to_hex()),
                    peer_name: None,
                    detail: None,
                    fields_shared: fields_shared_list(&fields),
                });
            }
            AuditEvent::CredentialDenied {
                remote_identity,
                request_id,
                ..
            } => {
                info!(
                    remote_identity = %remote_identity.to_hex(),
                    request_id,
                    "agent_access: credential denied"
                );
                self.forward(AgentAccessEvent {
                    kind: "credential_denied".to_string(),
                    timestamp_ms: AgentAccessEvent::now_ms(),
                    peer_fingerprint: Some(remote_identity.to_hex()),
                    peer_name: None,
                    detail: None,
                    fields_shared: None,
                });
            }
            // `AuditEvent` is `#[non_exhaustive]` upstream — ignore unknown future variants
            // rather than fail closed on logging/forwarding. A logging gap must never affect
            // the deny/allow decision, which has already been made by the time this runs.
            _ => {}
        }
    }
}

fn query_kind(query: &ap_client::CredentialQuery) -> &'static str {
    match query {
        ap_client::CredentialQuery::Domain(_) => "domain",
        ap_client::CredentialQuery::Id(_) => "id",
        ap_client::CredentialQuery::Search(_) => "search",
    }
}

fn connection_type_label(connection_type: AuditConnectionType) -> &'static str {
    match connection_type {
        AuditConnectionType::Rendezvous => "rendezvous",
        AuditConnectionType::Psk => "psk",
    }
}

/// Comma-joins the field names present in `fields` (e.g. `"username,password,totp"`), or
/// `None` if nothing was shared. Never carries field *values* — only which fields were
/// present, matching `fields`'s own presence-only contract.
fn fields_shared_list(fields: &CredentialFieldSet) -> Option<String> {
    let mut shared = Vec::new();
    if fields.has_username {
        shared.push("username");
    }
    if fields.has_password {
        shared.push("password");
    }
    if fields.has_totp {
        shared.push("totp");
    }
    if fields.has_uri {
        shared.push("uri");
    }
    if fields.has_notes {
        shared.push("notes");
    }
    (!shared.is_empty()).then(|| shared.join(","))
}

#[cfg(test)]
mod tests {
    use ap_relay_protocol::IdentityFingerprint;
    use tokio::sync::mpsc;

    use super::*;

    /// Forwards every event to an unbounded channel so tests can `recv().await` it — this
    /// naturally waits out the detached-task hop in [`ForwardingAuditLog::forward`], instead
    /// of racing the test against tokio's scheduler.
    struct ChannelEventSink(mpsc::UnboundedSender<AgentAccessEvent>);

    #[async_trait]
    impl EventSink for ChannelEventSink {
        async fn on_event(&self, event: AgentAccessEvent) {
            let _ = self.0.send(event);
        }
    }

    fn harness() -> (
        ForwardingAuditLog,
        mpsc::UnboundedReceiver<AgentAccessEvent>,
    ) {
        let (tx, rx) = mpsc::unbounded_channel();
        (ForwardingAuditLog::new(Arc::new(ChannelEventSink(tx))), rx)
    }

    #[tokio::test]
    async fn connection_established_maps_kind_and_peer_fields() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x11; 32]);
        log.write(AuditEvent::ConnectionEstablished {
            remote_identity: &fp,
            remote_name: Some("Work Laptop"),
            connection_type: AuditConnectionType::Rendezvous,
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert_eq!(event.kind, "connection_established");
        assert_eq!(
            event.peer_fingerprint.as_deref(),
            Some(fp.to_hex()).as_deref()
        );
        assert_eq!(event.peer_name.as_deref(), Some("Work Laptop"));
        assert_eq!(event.detail.as_deref(), Some("rendezvous"));
        assert!(event.fields_shared.is_none());
        assert!(!event.timestamp_ms.is_empty());
    }

    #[tokio::test]
    async fn session_refreshed_maps_kind() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x22; 32]);
        log.write(AuditEvent::SessionRefreshed {
            remote_identity: &fp,
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert_eq!(event.kind, "session_refreshed");
        assert_eq!(
            event.peer_fingerprint.as_deref(),
            Some(fp.to_hex()).as_deref()
        );
        assert!(event.peer_name.is_none());
    }

    #[tokio::test]
    async fn connection_rejected_maps_kind() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x33; 32]);
        log.write(AuditEvent::ConnectionRejected {
            remote_identity: &fp,
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert_eq!(event.kind, "connection_rejected");
    }

    #[tokio::test]
    async fn credential_requested_maps_kind_and_query_detail() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x44; 32]);
        let query = ap_client::CredentialQuery::Domain("example.com".to_string());
        log.write(AuditEvent::CredentialRequested {
            query: &query,
            remote_identity: &fp,
            request_id: "req-1",
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert_eq!(event.kind, "credential_requested");
        assert_eq!(event.detail.as_deref(), Some("domain"));
        // The domain/search text itself must never leak into the event.
        assert!(event
            .detail
            .as_deref()
            .is_some_and(|d| !d.contains("example.com")));
    }

    #[tokio::test]
    async fn credential_approved_maps_kind_and_fields_shared() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x55; 32]);
        let query = ap_client::CredentialQuery::Domain("example.com".to_string());
        log.write(AuditEvent::CredentialApproved {
            query: &query,
            domain: Some("example.com"),
            remote_identity: &fp,
            request_id: "req-2",
            credential_id: Some("cipher-1"),
            fields: CredentialFieldSet {
                has_username: true,
                has_password: true,
                has_totp: true,
                has_uri: false,
                has_notes: false,
            },
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert_eq!(event.kind, "credential_approved");
        assert_eq!(
            event.fields_shared.as_deref(),
            Some("username,password,totp")
        );
    }

    #[tokio::test]
    async fn credential_approved_with_no_fields_has_no_fields_shared() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x66; 32]);
        let query = ap_client::CredentialQuery::Id("cipher-1".to_string());
        log.write(AuditEvent::CredentialApproved {
            query: &query,
            domain: None,
            remote_identity: &fp,
            request_id: "req-3",
            credential_id: Some("cipher-1"),
            fields: CredentialFieldSet::default(),
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert!(event.fields_shared.is_none());
    }

    #[tokio::test]
    async fn credential_denied_maps_kind() {
        let (log, mut rx) = harness();
        let fp = IdentityFingerprint([0x77; 32]);
        let query = ap_client::CredentialQuery::Search("bank".to_string());
        log.write(AuditEvent::CredentialDenied {
            query: &query,
            domain: None,
            remote_identity: &fp,
            request_id: "req-4",
            credential_id: None,
        })
        .await;

        let event = rx.recv().await.unwrap();
        assert_eq!(event.kind, "credential_denied");
        assert!(event.fields_shared.is_none());
    }
}
