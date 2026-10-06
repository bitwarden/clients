//! Bitwarden Agent Access desktop integration.
//!
//! Wraps the Agent Access SDK (`ap-client`) into the "UserClient" (listener) role for the
//! desktop app: remote agents pair through a relay and request individual credentials,
//! answered from the logged-in user's unlocked vault (no `bw` CLI, no BWS access token
//! involved). This mirrors the SSH agent v2 integration: all business logic lives in this
//! crate, and `napi/src/agent_access.rs` only converts DTOs and enforces per-callback
//! timeouts — see that file's module docs for the split.
//!
//! # Zero-knowledge invariants
//! - This crate performs no cryptography of its own — `ap-client` owns the Noise Protocol
//!   handshake and all encryption/decryption. We only move opaque blobs (transport session
//!   state, PSK bytes, identity COSE bytes) between `ap-client`'s storage traits and the
//!   host-provided [`KvStorage`].
//! - Credential values, PSKs, and identity key material must never be logged or surfaced to
//!   the host. `audit`'s `ForwardingAuditLog` forwards only event names, connection types, and
//!   field *presence* flags — both to `tracing` and, as an [`AgentAccessEvent`], to the
//!   host-provided [`EventSink`] that backs the desktop activity log.
//! - Rendezvous connections always go through [`FingerprintVerifier`] — there is no
//!   auto-accept path in this crate, unlike the upstream `ap-uniffi` reference adapter.
//! - Any callback timeout or failure denies the request; the remote peer is never left
//!   hanging and never receives partial data. See [`client::DesktopAgentAccess`].

mod attestation;
mod audit;
mod callbacks;
mod client;
mod error;
mod local_listener;
mod peer_info;
mod storage;

pub use attestation::{ParentProcessInfo, SignatureInfo, SignatureKind};
pub use callbacks::{
    AgentAccessEvent, CallbackError, CredentialDenialReason, CredentialQueryKind,
    CredentialRequestData, CredentialRequestHandler, CredentialRequestOrigin,
    CredentialResponseData, DeliveryMode, EventSink, FingerprintVerificationData,
    FingerprintVerificationResponse, FingerprintVerifier, KvStorage, OpenShellContext,
    OpenShellEndpoint, OpenShellEndpointSource, OpenShellLifetime, OpenShellLifetimeMode,
    OpenShellResolution, ProjectEntry, ProviderField, ProviderTarget, ProviderValue,
    RequestOperation, ResourceKind, SecretEntry,
};
pub use client::{AgentAccessConfig, DesktopAgentAccess};
pub use error::AgentAccessError;
pub use peer_info::LocalPeerInfo;
pub use storage::ConnectionSummary;
