//! Host-facing callback traits.
//!
//! The napi layer (`napi/src/agent_access.rs`) implements these by invoking a JS callback
//! under a timeout and converting the result. This crate contains no JS/napi-specific code —
//! it only defines the seam, so the dispatch logic in [`crate::client`] can be unit-tested
//! with plain Rust mocks.
//!
//! None of these types carry the decrypted vault: [`CredentialResponseData`] holds only the
//! single credential the host chose to release for one request, and its `Debug` impl redacts
//! secret fields so an accidental `{:?}` in a log statement can't leak them.

use std::time::{SystemTime, UNIX_EPOCH};

use async_trait::async_trait;
use thiserror::Error;
use zeroize::Zeroizing;

use crate::peer_info::LocalPeerInfo;

/// Failure returned by a host callback.
///
/// Carries no detail by design — callback failures (a JS exception, a closed window, a
/// timeout) must never leak host-side state into the audit trail or back to the remote peer.
/// Callers should treat any `Err` the same way they treat a timeout: deny.
#[derive(Debug, Error, Clone, Copy, PartialEq, Eq)]
pub enum CallbackError {
    /// The callback did not complete within the allowed time.
    #[error("callback timed out")]
    Timeout,
    /// The callback completed but reported failure (JS threw, or returned an error).
    #[error("callback failed")]
    Failed,
}

/// Which field of a [`CredentialRequestData`] the query matches against.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CredentialQueryKind {
    /// Look up by domain / URL.
    Domain,
    /// Look up by vault item ID.
    Id,
    /// Free-text search.
    Search,
    /// Look up by exact (or unique case-insensitive) Secrets Manager secret key. Only valid for
    /// [`ResourceKind::Secret`] requests — see `local_listener::local_protocol::validate`'s
    /// op/query-type matrix.
    Name,
}

impl From<&ap_client::CredentialQuery> for CredentialQueryKind {
    fn from(query: &ap_client::CredentialQuery) -> Self {
        match query {
            ap_client::CredentialQuery::Domain(_) => Self::Domain,
            ap_client::CredentialQuery::Id(_) => Self::Id,
            ap_client::CredentialQuery::Search(_) => Self::Search,
        }
    }
}

/// Which kind of vault data a [`CredentialRequestData`] is asking for: a login credential (the
/// original v1 shape) or a Secrets Manager secret (M4). Determined entirely by the wire `op`
/// (`"credentialRequest"` vs `"secretRequest"`) for local requests, and always
/// [`Credential`](Self::Credential) on the relay path — secrets are local-transport-only (see
/// agent-access-architecture.md, "M4 — Secrets Manager secrets over user auth", invariant 6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ResourceKind {
    #[default]
    Credential,
    Secret,
}

/// Which ingress a [`CredentialRequestData`] arrived through. The single enforcement point
/// invariant (agent-access-architecture.md, "Component overview") requires that this never
/// changes *how* authorization is decided — only what identity context is available to the
/// host callback, and (for [`Local`](Self::Local)) which value-stripping rule applies to the
/// reply on the way back out (see `local_listener`'s reply construction).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CredentialRequestOrigin {
    /// A paired remote agent, connected through the relay (`ap_client`).
    Relay,
    /// The local `aac` CLI, connected through the Unix-socket / named-pipe listener.
    Local,
}

/// Whether a [`CredentialRequestData`] is asking to look up existing vault data (the original
/// v1 shape, and every [`ResourceKind::Credential`] request) or to create a new Secrets Manager
/// secret (M4b, `secretCreate` — local-transport-only, always [`ResourceKind::Secret`]).
/// Determined entirely by the wire `op` (`"secretCreate"` vs everything else) for local
/// requests, and always [`Request`](Self::Request) on the relay path — creates are
/// local-transport-only, mirroring [`ResourceKind::Secret`]'s relay restriction (see
/// agent-access-architecture.md, "M4b — secret creation").
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RequestOperation {
    #[default]
    Request,
    Create,
    /// `describeFillTarget` (M5, "Browser fill delivery") — a vault-free, approval-free read of
    /// the active browser tab's fillable fields. Local-transport-only, always paired with
    /// [`ResourceKind::Credential`] (the default) even though no vault lookup happens: there is
    /// no resource-less variant of [`ResourceKind`] to reach for, and describe-target requests
    /// are conceptually credential-adjacent (the same op family as a `credentialRequest`, never
    /// a `secretRequest`). `CredentialRequestData::query_type`/`query_value` carry no meaningful
    /// data for this operation — mirrors [`Create`](Self::Create)'s treatment of
    /// `delivery_mode` (always `None`).
    DescribeFillTarget,
}

/// How the requester wants an approved credential delivered. Only meaningful for
/// [`CredentialRequestOrigin::Local`] — the relay path has no local-injection story, so
/// [`CredentialRequestData::delivery_mode`] is `None` there.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryMode {
    /// Values are returned to the caller for exec-time injection into a child process; never
    /// printed. The local protocol still strips `notes` unconditionally (see
    /// `local_listener::local_protocol`) but otherwise returns whatever the host released.
    Inject,
    /// No secret values in the reply, ever — only an opaque `bw://item/<id>` reference and the
    /// matched item's display metadata. Enforced by construction in the local protocol's reply
    /// builder, not by a runtime filter.
    Reference,
    /// The credential value never rides the local socket at all (M5, "Browser fill delivery").
    /// The host resolves the credential and pushes it directly to the browser extension over
    /// the desktop↔extension channel; the wire reply carries only a value-free execution
    /// outcome (`CredentialResponseData::fill_result`). Credential resource only —
    /// `local_listener::local_protocol::validate` rejects `Fill` for [`ResourceKind::Secret`].
    Fill,
}

/// A credential lookup — or, for `secretCreate`, a proposed secret creation — requested by a
/// paired remote agent or the local `aac` CLI.
///
/// Never `#[derive(Debug)]`: `new_secret_value` (and, per the same "can reveal what an agent is
/// up to" reasoning as [`CredentialResponseData::item_name`], `new_secret_name`/`project_hint`)
/// must never land in a log line. See the manual `Debug` impl below.
#[derive(Clone)]
pub struct CredentialRequestData {
    /// Which field `query_value` should be matched against. For [`RequestOperation::Create`]
    /// requests (which have no query) this is [`CredentialQueryKind::Name`], mirroring
    /// `query_value` below.
    pub query_type: CredentialQueryKind,
    /// The domain, vault item ID, or search text to match. For [`RequestOperation::Create`]
    /// requests (which have no query on the wire) this carries the new secret's name, so a
    /// handler that inspects `query_value` before branching on `operation` still sees something
    /// meaningful rather than an empty string.
    pub query_value: String,
    /// Stable identity fingerprint (64-char hex) of the requesting device. `None` for
    /// [`CredentialRequestOrigin::Local`] — local requesters have no cryptographic identity;
    /// their identity is the OS-attested [`local_peer`](Self::local_peer) instead.
    pub requester_fingerprint: Option<String>,
    /// Friendly name assigned to this connection during pairing, if any. `None` for local
    /// requests — there is no pairing/naming step for the local path (see plan §F1).
    pub requester_name: Option<String>,
    /// Which ingress this request arrived through.
    pub origin: CredentialRequestOrigin,
    /// OS-verified identity of the local peer (captured at accept time from peer credentials,
    /// never self-reported — see the crate-level "requester identity never self-reported"
    /// invariant). `None` on the relay path.
    pub local_peer: Option<LocalPeerInfo>,
    /// How the requester wants the credential delivered, if approved. `None` on the relay path,
    /// and for [`RequestOperation::Create`] requests (the create response never carries a value
    /// to deliver — see `local_listener::local_protocol`'s create-response builder).
    pub delivery_mode: Option<DeliveryMode>,
    /// Whether this request is asking for a login credential or a Secrets Manager secret.
    /// Always [`ResourceKind::Credential`] on the relay path (see [`ResourceKind`]'s docs).
    pub resource: ResourceKind,
    /// Whether this is a lookup against existing vault data, or a proposal to create a new
    /// Secrets Manager secret. Always [`RequestOperation::Request`] on the relay path (see
    /// [`RequestOperation`]'s docs).
    pub operation: RequestOperation,
    /// Proposed name for a new Secrets Manager secret. Only set for
    /// [`RequestOperation::Create`] requests.
    pub new_secret_name: Option<String>,
    /// Proposed value for a new Secrets Manager secret. `Zeroizing` so it's scrubbed on drop,
    /// matching every other in-memory secret value in this crate. Only set for
    /// [`RequestOperation::Create`] requests.
    pub new_secret_value: Option<Zeroizing<String>>,
    /// Proposed note for a new Secrets Manager secret. Only set for [`RequestOperation::Create`]
    /// requests.
    pub new_secret_note: Option<String>,
    /// Optional project-name hint for a new Secrets Manager secret — never trusted silently, the
    /// renderer's project picker only preselects a writable project whose decrypted name matches
    /// exactly (agent-access-architecture.md, "M4b — secret creation"). Only set for
    /// [`RequestOperation::Create`] requests.
    pub project_hint: Option<String>,
    /// Requested field roles (`"username"`/`"password"`/`"totp"`) for a `delivery: "fill"`
    /// request (M5). `None` means "default: all fields present and safe", per the wire
    /// contract. Value-free — role names, never a credential value — so it's printed directly
    /// in `Debug` rather than presence-only. Only set when `delivery_mode` is
    /// `Some(DeliveryMode::Fill)`; validated against the fixed role set by
    /// `local_listener::local_protocol::validate` before this struct is ever constructed.
    pub fill_fields: Option<Vec<String>>,
    /// Optional `targetToken` from a prior `describeFillTarget` call (M5), binding this fill to
    /// a specific extension-produced field plan. Value-free — an opaque token, not a credential
    /// — so it's printed directly in `Debug`. Only set when `delivery_mode` is
    /// `Some(DeliveryMode::Fill)`.
    pub fill_target_token: Option<String>,
}

impl std::fmt::Debug for CredentialRequestData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CredentialRequestData")
            .field("query_type", &self.query_type)
            .field("query_value", &self.query_value)
            .field("requester_fingerprint", &self.requester_fingerprint)
            .field("requester_name", &self.requester_name)
            .field("origin", &self.origin)
            .field("local_peer", &self.local_peer)
            .field("delivery_mode", &self.delivery_mode)
            .field("resource", &self.resource)
            .field("operation", &self.operation)
            .field("has_new_secret_name", &self.new_secret_name.is_some())
            .field("has_new_secret_value", &self.new_secret_value.is_some())
            .field("has_new_secret_note", &self.new_secret_note.is_some())
            .field("has_project_hint", &self.project_hint.is_some())
            .field("fill_fields", &self.fill_fields)
            .field("fill_target_token", &self.fill_target_token)
            .finish()
    }
}

/// Why a credential request was denied without the host ever making an approve/deny decision on
/// a *found* item — distinguishes "nothing matched the query" from "the user (or an automatic
/// gate) said no," and, critically, from "no decision was ever made because the vault wasn't
/// available." `None` on `approved: false` means the generic/default denial: the local protocol
/// maps it the same as [`Denied`](Self::Denied).
///
/// [`Locked`](Self::Locked) and [`Internal`](Self::Internal) exist so a locked vault or a
/// lookup/internal failure is never reported to the requester as "Denied by user" — that string
/// asserts a user decision that never happened. See `local_listener::local_protocol`'s mapping
/// of this type to `WireStatus`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CredentialDenialReason {
    /// No active login cipher matched the request's query.
    NotFound,
    /// The user explicitly rejected the approval dialog, or an automatic gate denied on their
    /// behalf for a reason not distinguished by a more specific variant below.
    Denied,
    /// The vault is locked (or the user is otherwise not in a state to serve the request) — the
    /// user was never asked, so this must never be reported as a denial decision.
    Locked,
    /// A non-user failure occurred while trying to satisfy the request (feature disabled,
    /// storage/lookup error, ...) — distinct from [`Denied`](Self::Denied) for the same reason
    /// as [`Locked`](Self::Locked): no user decision was made.
    Internal,
    /// M5, "Browser fill delivery": the extension-reported active-tab origin matches no
    /// resolved item's saved URIs. A pre-prompt, mechanical refusal — the user is never asked,
    /// so (like [`Locked`](Self::Locked)) this must never be reported as a denial decision.
    /// `CredentialResponseData::denial_detail` carries the value-free origin.
    OriginMismatch,
    /// M5, "Browser fill delivery": the origin matched but no requested field has a
    /// §4.1-safe target (registration form, ambiguous candidates, hidden-only fields, ...).
    /// Also a pre-prompt, mechanical refusal. `CredentialResponseData::denial_detail` carries
    /// the value-free, machine-readable reason code.
    NoSafeTarget,
}

/// The host's answer to a [`CredentialRequestData`].
///
/// Only the fields the host explicitly chooses to release are populated. `approved: false`
/// (or a callback error/timeout, handled by the caller) sends no vault data at all.
#[derive(Clone, Default)]
pub struct CredentialResponseData {
    pub approved: bool,
    pub username: Option<String>,
    pub password: Option<String>,
    pub totp: Option<String>,
    pub uri: Option<String>,
    pub notes: Option<String>,
    /// Vault item ID, echoed back for audit correlation on the remote's audit trail.
    pub credential_id: Option<String>,
    /// Set when `approved: false` to distinguish "no match" from "denied" for the local
    /// protocol's `status` field. Ignored on the relay path (the remote protocol has no
    /// equivalent yet).
    pub reason: Option<CredentialDenialReason>,
    /// Display name of the matched item, for the local protocol's reference-mode reply
    /// (`item.name`). Never used outside `delivery_mode: Reference` — the inject-mode reply
    /// carries no item metadata beyond the credential itself. Also doubles as the Secrets
    /// Manager secret's display name (`secret.name`) for [`ResourceKind::Secret`] requests —
    /// there is no separate "secret name" field.
    pub item_name: Option<String>,
    /// The Secrets Manager secret's decrypted value, for [`ResourceKind::Secret`] requests.
    /// `Zeroizing` so it's scrubbed on drop, matching the same-shaped credential secrets
    /// elsewhere in this crate (e.g. `client.rs`'s relay-path `password` handling). Unset for
    /// credential requests.
    pub secret_value: Option<Zeroizing<String>>,
    /// Secrets Manager secret ID, echoed back for the `bw://secret/<id>` reference and audit
    /// correlation — the secret analogue of [`credential_id`](Self::credential_id). Unset for
    /// credential requests.
    pub secret_id: Option<String>,
    /// Value-free JSON pass-through describing a `delivery: "fill"` request's execution outcome
    /// (M5's `fill` response object: `{status, origin, fields: [...]}`) — produced by the TS
    /// host, parsed into a `serde_json::Value` by `local_listener::local_protocol`. Set for
    /// `delivery_mode: Fill` responses, approved or denied — an `originMismatch`/`noSafeTarget`
    /// denial can still carry the extension-reported origin here (agent-access-architecture.md,
    /// "M5" wire section). This crate treats it as opaque JSON and never reads a field out of it
    /// that could carry a credential value — the value-absence guarantee is the TS host's
    /// contract to keep, not something parsed/enforced here.
    pub fill_result: Option<String>,
    /// Value-free JSON pass-through describing the active browser tab for a
    /// `describeFillTarget` request (M5's `fillTarget` response object) — produced by the TS
    /// host, parsed into a `serde_json::Value` by
    /// `local_protocol::build_approved_describe_fill_target`. Set only for
    /// `operation: DescribeFillTarget` responses.
    pub fill_target: Option<String>,
    /// Machine-readable, value-free detail for an [`OriginMismatch`](CredentialDenialReason::OriginMismatch)/
    /// [`NoSafeTarget`](CredentialDenialReason::NoSafeTarget) denial (the mismatched origin, or
    /// a `looks-like-registration`/`ambiguous-target`/... reason code). `None` for every other
    /// reason.
    pub denial_detail: Option<String>,
    /// Field roles (`"username"`/`"password"`/`"totp"`) actually filled by an approved
    /// `delivery: "fill"` request, for the activity log's `fields_shared` (M5). Supplied
    /// directly by the TS host rather than derived by parsing `fill_result`, so the activity
    /// event never depends on this crate understanding the pass-through's JSON shape. Unset for
    /// every other delivery mode.
    pub fill_fields_shared: Option<Vec<String>>,
}

impl std::fmt::Debug for CredentialResponseData {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CredentialResponseData")
            .field("approved", &self.approved)
            .field("has_username", &self.username.is_some())
            .field("has_password", &self.password.is_some())
            .field("has_totp", &self.totp.is_some())
            .field("has_uri", &self.uri.is_some())
            .field("has_notes", &self.notes.is_some())
            .field("credential_id", &self.credential_id)
            .field("reason", &self.reason)
            .field("has_item_name", &self.item_name.is_some())
            .field("has_secret_value", &self.secret_value.is_some())
            .field("secret_id", &self.secret_id)
            .field("has_fill_result", &self.fill_result.is_some())
            .field("has_fill_target", &self.fill_target.is_some())
            .field("has_denial_detail", &self.denial_detail.is_some())
            .field("has_fill_fields_shared", &self.fill_fields_shared.is_some())
            .finish()
    }
}

/// A handshake fingerprint pending user verification (rendezvous pairing only; PSK pairing
/// is pre-authenticated by the shared secret and never reaches this callback).
#[derive(Debug, Clone)]
pub struct FingerprintVerificationData {
    /// 6-character hex fingerprint for out-of-band/visual verification.
    pub fingerprint: String,
    /// Stable identity fingerprint (64-char hex) of the remote device.
    pub identity_fingerprint: String,
}

/// The host's answer to a [`FingerprintVerificationData`].
#[derive(Debug, Clone, Default)]
pub struct FingerprintVerificationResponse {
    pub approved: bool,
    /// Friendly name to assign to the connection, chosen by the user at verification time.
    pub name: Option<String>,
}

/// Serves credential requests from paired remote agents by looking them up in the unlocked
/// vault and prompting the user for approval.
///
/// A user-initiated denial is `Ok(CredentialResponseData { approved: false, .. })`, not an
/// `Err` — `Err` is reserved for callback-level failures (JS exception, disconnected window).
/// The caller in [`crate::client`] treats both the same way: deny, and never surface the
/// distinction to the remote peer.
#[async_trait]
pub trait CredentialRequestHandler: Send + Sync {
    async fn handle_credential_request(
        &self,
        request: CredentialRequestData,
    ) -> Result<CredentialResponseData, CallbackError>;
}

/// Verifies rendezvous handshake fingerprints out-of-band with the user.
///
/// There is intentionally no default/no-op implementation in this crate. Every rendezvous
/// connection must be verified by a real user-facing callback, or the connection must be
/// rejected — never wire an implementation that unconditionally approves (see the MITM gap
/// this closes, noted against `ap-uniffi`'s reference adapter in the integration plan).
#[async_trait]
pub trait FingerprintVerifier: Send + Sync {
    async fn verify_fingerprint(
        &self,
        request: FingerprintVerificationData,
    ) -> Result<FingerprintVerificationResponse, CallbackError>;
}

/// Generic string key-value storage, provided by the host.
///
/// The host decides where bytes live (OS keychain, encrypted file, ...); this crate only
/// reads/writes opaque strings under a handful of well-known keys (`"identity"`,
/// `"connections"`, `"psks"`) and does its own serialization (base64 or JSON) — the storage
/// layer itself never parses the values.
#[async_trait]
pub trait KvStorage: Send + Sync {
    async fn get(&self, key: &str) -> Result<Option<String>, CallbackError>;
    async fn set(&self, key: &str, value: Option<&str>) -> Result<(), CallbackError>;
}

/// A single agent-access activity event, surfaced to the host for a live activity log (e.g. a
/// desktop "agent access events" panel).
///
/// SECURITY: never populate these fields with credential values, PSKs, tokens, or key
/// material — only identity fingerprints, already-known friendly names, field *presence*
/// info, and `ap_client`-generated protocol/error strings. See [`crate::audit::ForwardingAuditLog`]
/// and [`crate::client`]'s notification drain, the only two producers of this type.
#[derive(Debug, Clone)]
pub struct AgentAccessEvent {
    /// Stable snake_case event identifier (e.g. `"connection_established"`,
    /// `"credential_approved"`). Treat this as a small closed vocabulary the host can switch
    /// on — new kinds may be added over time, but existing ones won't be renamed.
    pub kind: String,
    /// Unix epoch milliseconds, stringified (to avoid JS numeric-precision surprises),
    /// captured at event-creation time via [`AgentAccessEvent::now_ms`].
    pub timestamp_ms: String,
    /// Stable identity fingerprint (64-char hex) of the remote peer, when the event is
    /// associated with one.
    pub peer_fingerprint: Option<String>,
    /// Friendly connection name, when one is already known at event-creation time. This crate
    /// never looks a name up just to populate this field.
    pub peer_name: Option<String>,
    /// Free-text context. Only ever an `ap_client`-generated protocol/error string (connection
    /// type, query kind, notification error message) — never anything that could carry
    /// credential data.
    pub detail: Option<String>,
    /// Comma-joined field names released by a `credential_approved` event (e.g.
    /// `"username,password,totp"`), derived from `ap_client`'s `CredentialFieldSet` presence
    /// flags. `None` for every other kind.
    pub fields_shared: Option<String>,
}

impl AgentAccessEvent {
    /// Current unix time in milliseconds, stringified. Called at the point each event is
    /// created so `timestamp_ms` reflects when the underlying action happened, not when it was
    /// eventually delivered to the host.
    pub(crate) fn now_ms() -> String {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .to_string()
    }
}

/// Receives [`AgentAccessEvent`]s for a host-facing activity log.
///
/// Fire-and-forget from the caller's perspective: an `EventSink` must never fail, block, or
/// otherwise affect the operation that produced the event. The napi layer's `ElectronEventSink`
/// (see `napi/src/agent_access.rs`) enforces this by invoking the JS callback under a short
/// timeout and discarding the outcome entirely — an activity-log delivery failure must never
/// change protocol behavior.
#[async_trait]
pub trait EventSink: Send + Sync {
    async fn on_event(&self, event: AgentAccessEvent);
}
