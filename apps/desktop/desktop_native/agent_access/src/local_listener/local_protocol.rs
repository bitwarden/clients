//! "Local wire protocol v1" (agent-access-architecture.md) — the JSON-line request/response
//! exchanged with the `aac` CLI over the Unix socket / named pipe.
//!
//! One connection per request: the client sends one `\n`-terminated JSON line, the server
//! replies with one JSON line and closes. Unknown JSON fields are ignored on deserialize
//! (forward compatibility — no `#[serde(deny_unknown_fields)]` anywhere in this module,
//! deliberately). `version` is echoed back as this server's protocol version (currently always
//! `1`), not the client's requested version.

use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use crate::callbacks::{
    CallbackError, CredentialDenialReason, CredentialQueryKind, CredentialResponseData,
    DeliveryMode, RequestOperation, ResourceKind,
};

/// The only protocol version this server understands. Requests with a different `version` are
/// rejected with `status: "error"` rather than guessed at.
pub(super) const VERSION: u32 = 1;

/// Hard cap on a single request line, matching "Local wire protocol v1" in the architecture
/// doc. Enforced while reading, before any JSON parsing is attempted.
pub(super) const MAX_LINE_LEN: usize = 64 * 1024;

// ---------------------------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireRequest {
    pub(super) version: u32,
    pub(super) op: String,
    #[serde(default)]
    pub(super) query: Option<WireQuery>,
    #[serde(default)]
    pub(super) delivery: Option<WireDelivery>,
    /// Present only on a `secretCreate` request (agent-access-architecture.md, "M4b — secret
    /// creation"). [`validate`] rejects it as a protocol error on every other `op` — a
    /// `credentialRequest`/`secretRequest` silently ignoring a `create` object would be a cheap
    /// but confusing way for a client bug to go unnoticed.
    #[serde(default)]
    pub(super) create: Option<WireCreate>,
    /// Present only on a `credentialRequest` with `delivery: "fill"` (agent-access-architecture
    /// .md, "M5 — Browser fill delivery"). [`validate`] rejects it on every other delivery mode
    /// and on `secretRequest`/`secretCreate` — a `fill` object silently ignored elsewhere would
    /// be the same class of confusing client-bug-goes-unnoticed as an ignored `create` object.
    #[serde(default)]
    pub(super) fill: Option<WireFillParams>,
    #[serde(default)]
    pub(super) client: Option<WireClientInfo>,
}

/// The `fill` object on a `credentialRequest` with `delivery: "fill"` (M5). Both fields are
/// optional per the wire contract (`fields` defaults to "all present and safe",
/// `targetToken` is only present when echoing a prior `describeFillTarget` plan). Value-free —
/// role names and an opaque token, never a credential value — so unlike [`WireCreate`] a
/// derived `Debug` is fine here.
#[derive(Debug, Deserialize, Clone, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireFillParams {
    #[serde(default)]
    pub(super) fields: Option<Vec<String>>,
    #[serde(default)]
    pub(super) target_token: Option<String>,
}

/// The `create` object on a `secretCreate` request. `name`/`value` are required non-empty by
/// [`validate`]; `note`/`project` are optional. `project` is a HINT only — never trusted
/// silently, see `agent-access-architecture.md`'s "M4b — secret creation" wire section.
///
/// Never `#[derive(Debug)]` — `value`/`note` must never be logged, and `name`/`project` are
/// redacted the same presence-only way `CredentialRequestData`'s `new_secret_name`/
/// `project_hint` are (they can reveal what an agent is up to). This struct is short-lived
/// (consumed by [`validate`] into a `Zeroizing` field), but a landmine-free `Debug` costs
/// nothing and matches this crate's blanket "incoming secret values are never logged" rule.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireCreate {
    pub(super) name: String,
    pub(super) value: String,
    #[serde(default)]
    pub(super) note: Option<String>,
    #[serde(default)]
    pub(super) project: Option<String>,
}

impl std::fmt::Debug for WireCreate {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WireCreate")
            .field("has_name", &!self.name.is_empty())
            .field("has_value", &!self.value.is_empty())
            .field("has_note", &self.note.is_some())
            .field("has_project", &self.project.is_some())
            .finish()
    }
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
pub(super) struct WireQuery {
    #[serde(rename = "type")]
    pub(super) kind: WireQueryType,
    pub(super) value: String,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) enum WireQueryType {
    Domain,
    Id,
    Search,
    /// Exact (or unique case-insensitive) Secrets Manager secret key match. Valid only on a
    /// `secretRequest` — see [`validate`]'s op/query-type matrix.
    Name,
}

impl From<WireQueryType> for CredentialQueryKind {
    fn from(kind: WireQueryType) -> Self {
        match kind {
            WireQueryType::Domain => Self::Domain,
            WireQueryType::Id => Self::Id,
            WireQueryType::Search => Self::Search,
            WireQueryType::Name => Self::Name,
        }
    }
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) enum WireDelivery {
    Inject,
    Reference,
    /// M5, "Browser fill delivery". Credential resource only — [`validate`] rejects this on a
    /// `secretRequest`.
    Fill,
}

impl From<WireDelivery> for DeliveryMode {
    fn from(delivery: WireDelivery) -> Self {
        match delivery {
            WireDelivery::Inject => Self::Inject,
            WireDelivery::Reference => Self::Reference,
            WireDelivery::Fill => Self::Fill,
        }
    }
}

/// Self-reported by the client (`aac`) — diagnostic only. Never feeds into an authorization
/// decision or an activity-log field: requester identity comes exclusively from OS-verified
/// peer credentials (`LocalPeerInfo`), matching the crate-wide "requester identity never
/// self-reported" invariant (see plan.md F1/F2 — this is the exact failure mode the local
/// transport replaces).
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
pub(super) struct WireClientInfo {
    pub(super) name: String,
    pub(super) version: String,
}

/// The validated, op-specific shape of an incoming request — what [`validate`] produces once it
/// has resolved `op` into a [`ResourceKind`]/[`RequestOperation`] pair and enforced the fields
/// required for that combination. Kept as an enum (rather than a wider tuple/struct with
/// operation-specific fields left as `Option`) so `local_listener::mod`'s `handle_connection`
/// can match on it and the compiler enforces that a `Lookup`'s query/delivery and a `Create`'s
/// name/value are never accidentally treated as interchangeable.
pub(super) enum ValidatedRequest {
    /// `credentialRequest` / `secretRequest` — a lookup against existing vault data.
    Lookup {
        resource: ResourceKind,
        query: WireQuery,
        delivery: DeliveryMode,
        /// `Some` only when `delivery` is [`DeliveryMode::Fill`] — see [`FillParams`].
        fill: Option<FillParams>,
        client: Option<WireClientInfo>,
    },
    /// `secretCreate` — a proposal to create a new Secrets Manager secret. Always
    /// [`ResourceKind::Secret`]; no query, no delivery on the wire (see "Wire (local socket
    /// only)" in agent-access-architecture.md's "M4b — secret creation").
    Create {
        name: String,
        /// `Zeroizing` from the moment it leaves [`WireCreate`] — moved, never cloned, so there
        /// is never a second live copy of an incoming secret value sitting in a plain `String`.
        value: Zeroizing<String>,
        note: Option<String>,
        project: Option<String>,
        client: Option<WireClientInfo>,
    },
    /// `describeFillTarget` (M5) — vault-free, approval-free read of the active browser tab's
    /// fillable fields. No query, no delivery, no fill/create object on the wire — [`validate`]
    /// rejects a request that carries any of them under this op.
    DescribeFillTarget { client: Option<WireClientInfo> },
}

/// Requested field roles + optional target-token binding for a `delivery: "fill"` request (M5).
/// `fields` entries are restricted to `"username"`/`"password"`/`"totp"` by [`validate`] before
/// this struct is ever constructed, so downstream code can treat the list as already
/// well-formed. Value-free (role names + an opaque token, never a credential value), so unlike
/// [`ValidatedRequest::Create`]'s `name`/`value` a derived `Debug` is fine.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(super) struct FillParams {
    pub(super) fields: Option<Vec<String>>,
    pub(super) target_token: Option<String>,
}

/// Never derived — `Create`'s `name`/`value` are redacted the same way
/// `CredentialRequestData`'s `new_secret_name`/`new_secret_value` are (this enum is exactly the
/// pre-dispatch form of that data). `query`/`delivery`/`fill`/`client` are plain, non-sensitive
/// protocol metadata, same as everywhere else in this module.
impl std::fmt::Debug for ValidatedRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Lookup {
                resource,
                query,
                delivery,
                fill,
                client,
            } => f
                .debug_struct("ValidatedRequest::Lookup")
                .field("resource", resource)
                .field("query", query)
                .field("delivery", delivery)
                .field("fill", fill)
                .field("client", client)
                .finish(),
            Self::Create {
                note,
                project,
                client,
                ..
            } => f
                .debug_struct("ValidatedRequest::Create")
                .field("name", &"<redacted>")
                .field("value", &"<redacted>")
                .field("has_note", &note.is_some())
                .field("has_project", &project.is_some())
                .field("client", client)
                .finish(),
            Self::DescribeFillTarget { client } => f
                .debug_struct("ValidatedRequest::DescribeFillTarget")
                .field("client", client)
                .finish(),
        }
    }
}

/// Validates and unpacks a parsed [`WireRequest`], returning a human-readable (never
/// vault-data-carrying) rejection reason on failure. Never panics on any input — every rejection
/// path returns `Err`, which callers map to `WireStatus::Error` (see `local_listener::mod`'s
/// `handle_connection`), so a malformed, op/query-type-mismatched, or op/create-mismatched
/// request is always answered as a protocol error, never a crash.
///
/// The `op` field selects the [`ResourceKind`]/[`RequestOperation`] pair (`"credentialRequest"`
/// → `Credential`/`Request`, `"secretRequest"` → `Secret`/`Request`, `"secretCreate"` →
/// `Secret`/`Create`). For the two `Request` ops the query type is then cross-checked against
/// the resource per "M4 — Secrets Manager secrets over user auth": `domain` is only meaningful
/// for a login credential, `name` only for a secret; `id`/`search` are valid for both. A `create`
/// object on either `Request` op is rejected outright — silently ignoring it would let a client
/// bug (or a confused caller) believe a create happened when nothing was created.
pub(super) fn validate(request: WireRequest) -> Result<ValidatedRequest, &'static str> {
    if request.version != VERSION {
        return Err("unsupported protocol version");
    }
    match request.op.as_str() {
        "credentialRequest" | "secretRequest" => {
            if request.create.is_some() {
                return Err("create object is not valid for this operation");
            }
            let resource = if request.op == "credentialRequest" {
                ResourceKind::Credential
            } else {
                ResourceKind::Secret
            };
            let query = request.query.ok_or("missing query")?;
            match (resource, query.kind) {
                (ResourceKind::Credential, WireQueryType::Name) => {
                    return Err("query type \"name\" is only valid for secretRequest");
                }
                (ResourceKind::Secret, WireQueryType::Domain) => {
                    return Err("query type \"domain\" is only valid for credentialRequest");
                }
                // id/search are valid for both resource kinds; domain/name are already handled
                // above for the resource kind they *don't* belong to.
                _ => {}
            }
            let delivery = request
                .delivery
                .map(DeliveryMode::from)
                .ok_or("missing delivery mode")?;
            // M5: `fill` delivery is a credential-only concept — a secretRequest asking for it
            // is a protocol error, not a silent downgrade to some other delivery mode.
            if delivery == DeliveryMode::Fill && resource == ResourceKind::Secret {
                return Err("fill delivery is not supported for secrets");
            }
            // A `fill` object only makes sense alongside `delivery: "fill"` — present anywhere
            // else (inject/reference) it's the same "confusing client bug" class as an ignored
            // `create` object above, so it's rejected rather than silently dropped.
            if request.fill.is_some() && delivery != DeliveryMode::Fill {
                return Err("fill object is only valid with delivery \"fill\"");
            }
            let fill = if delivery == DeliveryMode::Fill {
                let params = request.fill.unwrap_or_default();
                if let Some(fields) = &params.fields {
                    for field in fields {
                        if !matches!(field.as_str(), "username" | "password" | "totp") {
                            return Err("unknown fill field role");
                        }
                    }
                }
                Some(FillParams {
                    fields: params.fields,
                    target_token: params.target_token,
                })
            } else {
                None
            };
            Ok(ValidatedRequest::Lookup {
                resource,
                query,
                delivery,
                fill,
                client: request.client,
            })
        }
        "secretCreate" => {
            if request.fill.is_some() {
                return Err("fill object is not valid for this operation");
            }
            let create = request.create.ok_or("missing create object")?;
            if create.name.is_empty() {
                return Err("create.name must not be empty");
            }
            if create.value.is_empty() {
                return Err("create.value must not be empty");
            }
            Ok(ValidatedRequest::Create {
                name: create.name,
                value: Zeroizing::new(create.value),
                note: create.note,
                project: create.project,
                client: request.client,
            })
        }
        "describeFillTarget" => {
            // M5: vault-free, approval-free — and, unlike `credentialRequest`, has nothing on
            // the wire *to* validate beyond "none of the other ops' fields snuck in." A stray
            // `query`/`delivery`/`fill`/`create` is a protocol error rather than being silently
            // ignored, matching this module's "an ignored field is a confusing client bug" rule.
            if request.query.is_some() {
                return Err("query is not valid for describeFillTarget");
            }
            if request.delivery.is_some() {
                return Err("delivery is not valid for describeFillTarget");
            }
            if request.fill.is_some() {
                return Err("fill object is not valid for describeFillTarget");
            }
            if request.create.is_some() {
                return Err("create object is not valid for describeFillTarget");
            }
            Ok(ValidatedRequest::DescribeFillTarget {
                client: request.client,
            })
        }
        _ => Err("unknown operation"),
    }
}

// ---------------------------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------------------------

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(super) enum WireStatus {
    Approved,
    Denied,
    NotFound,
    /// A vault-locked (or otherwise unavailable) local request — see
    /// [`CredentialDenialReason::Locked`]. Never asserted as a user decision.
    Locked,
    Timeout,
    /// The local listener is already servicing `MAX_CONCURRENT_CONNECTIONS` connections (see
    /// `local_listener::MAX_CONCURRENT_CONNECTIONS`) — this connection was closed immediately
    /// without ever being dispatched to the credential handler.
    RateLimited,
    /// M5: the extension-reported active-tab origin matches no resolved item's saved URIs. A
    /// pre-prompt, mechanical refusal — the desktop never shows an approval dialog for this
    /// status (agent-access-architecture.md, "M5" invariant 10).
    OriginMismatch,
    /// M5: the origin matched but no requested field has a §4.1-safe target. Also a pre-prompt,
    /// mechanical refusal.
    NoSafeTarget,
    Error,
}

/// Never `#[derive(Debug)]` — see [`CredentialResponseData`]'s docs for why. This impl mirrors
/// that struct's presence-only redaction so an accidental `{:?}` of a reply can't leak secret
/// values into logs, even though those same values are (correctly) present in the serialized
/// wire bytes sent to the peer.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireCredential {
    pub(super) username: Option<String>,
    pub(super) password: Option<String>,
    pub(super) totp: Option<String>,
    pub(super) uri: Option<String>,
    pub(super) credential_id: String,
}

impl std::fmt::Debug for WireCredential {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WireCredential")
            .field("has_username", &self.username.is_some())
            .field("has_password", &self.password.is_some())
            .field("has_totp", &self.totp.is_some())
            .field("has_uri", &self.uri.is_some())
            .field("credential_id", &self.credential_id)
            .finish()
    }
}

/// A Secrets Manager secret in an approved, inject-mode reply. Never `#[derive(Debug)]` — see
/// [`WireCredential`]'s docs for why; `value` is redacted the same way `WireCredential`'s
/// secret fields are.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireSecret {
    // Required, not Option: the M4 wire contract pins `secret.name` as always present in an
    // inject-mode reply, and the aac client deserializes it as a required field. A response
    // missing the name fails closed in `build_approved_secret` instead of omitting the key.
    pub(super) name: String,
    pub(super) value: String,
    pub(super) secret_id: String,
}

impl std::fmt::Debug for WireSecret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WireSecret")
            .field("name", &"<redacted>")
            .field("value", &"<redacted>")
            .field("secret_id", &self.secret_id)
            .finish()
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireItem {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) username: Option<String>,
}

impl std::fmt::Debug for WireItem {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("WireItem")
            .field("has_name", &self.name.is_some())
            .field("has_username", &self.username.is_some())
            .finish()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct WireResponse {
    pub(super) version: u32,
    pub(super) status: WireStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) credential: Option<WireCredential>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) secret: Option<WireSecret>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) reference: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) item: Option<WireItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) message: Option<String>,
    /// M5's `fill` response object (`delivery: "fill"`'s execution outcome) — a value-free
    /// pass-through of `CredentialResponseData::fill_result`, whose shape the TS side owns.
    /// This crate's job is transport: it parses the JSON into a `Value` and serializes it back
    /// out unchanged, and never reads a field out of it. **Contract**: no field of `fill`, at
    /// any depth, ever contains a credential value — that guarantee is upheld by the TS host
    /// that builds it, not by anything in this module.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) fill: Option<serde_json::Value>,
    /// `describeFillTarget`'s `fillTarget` response object — a value-free pass-through of
    /// `CredentialResponseData::fill_target`, same contract and same "this crate never reads a
    /// field out of it" treatment as [`fill`](Self::fill).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) fill_target: Option<serde_json::Value>,
}

impl WireResponse {
    pub(super) fn status(status: WireStatus, message: &str) -> Self {
        Self {
            version: VERSION,
            status,
            credential: None,
            secret: None,
            reference: None,
            item: None,
            message: Some(message.to_string()),
            fill: None,
            fill_target: None,
        }
    }

    pub(super) fn error(message: &str) -> Self {
        Self::status(WireStatus::Error, message)
    }
}

/// The dispatch decision produced by [`build_response`]: the wire reply to send back, plus what
/// to record in the desktop activity log.
pub(super) struct DispatchOutcome {
    pub(super) response: WireResponse,
    pub(super) event_kind: &'static str,
    pub(super) fields_shared: Option<String>,
}

/// Maps a [`CredentialRequestHandler`](crate::callbacks::CredentialRequestHandler) outcome to a
/// [`WireResponse`], deny-by-default on every non-approved path (timeout, callback error,
/// explicit denial) — mirrors `client::spawn_dispatch`'s relay-side mapping.
///
/// The approved branch for a [`RequestOperation::Request`] is built entirely by
/// [`build_approved`], whose `match` on `delivery` is the actual enforcement point for
/// "reference mode never carries secret values": there is no runtime filter here, only a code
/// path that never constructs a [`WireCredential`] for [`DeliveryMode::Reference`]. The approved
/// branch for a [`RequestOperation::Create`] is built by [`build_approved_create`], which never
/// constructs a `secret`/`credential` object at all — a create response has no delivery mode to
/// branch on in the first place (agent-access-architecture.md, "M4b — secret creation").
///
/// `delivery` is `None` for [`RequestOperation::Create`] (there is no delivery mode on that
/// request) and must be `Some` for [`RequestOperation::Request`]; a caller-side invariant
/// violation there fails closed with a generic error rather than panicking.
pub(super) fn build_response(
    outcome: Result<Result<CredentialResponseData, CallbackError>, tokio::time::error::Elapsed>,
    resource: ResourceKind,
    operation: RequestOperation,
    delivery: Option<DeliveryMode>,
) -> DispatchOutcome {
    match outcome {
        Ok(Ok(response)) if response.approved => {
            let (built, fields_shared) = match (operation, delivery) {
                // Nothing is released on a create — the response carries a reference and the
                // item name the caller already proposed, never the value it sent.
                (RequestOperation::Create, _) => (build_approved_create(&response), None),
                // A describe reply is page metadata, not vault data — no delivery mode to
                // branch on, same shape as a create in that respect.
                (RequestOperation::DescribeFillTarget, _) => {
                    (build_approved_describe_fill_target(&response), None)
                }
                (RequestOperation::Request, Some(delivery)) => (
                    build_approved(&response, resource, delivery),
                    fields_shared_list(&response, resource, delivery),
                ),
                (RequestOperation::Request, None) => (
                    WireResponse::status(WireStatus::Error, "Missing delivery mode"),
                    None,
                ),
            };
            DispatchOutcome {
                response: built,
                // Event-kind vocabulary is shared with the credential lifecycle by design —
                // see agent-access-architecture.md's "Sequencing & ownership" note that activity
                // events are metadata-only and `AgentAccessEvent::kind`'s closed-vocabulary
                // contract in callbacks.rs: a secret approval (lookup or create) is still, at
                // the audit-event level, a "credential_approved" event.
                event_kind: "credential_approved",
                fields_shared,
            }
        }
        Ok(Ok(response)) => {
            // Every arm here must tell the truth about *why* — a locked vault or an internal
            // failure is never a user decision, and reporting it as `WireStatus::Denied` /
            // "Denied by user" would assert a decision that never happened (the finding this
            // closes). Only `Denied`/`None` — an actual user rejection or an unspecified
            // default — maps to that status and message.
            let (status, message, event_kind) = match response.reason {
                Some(CredentialDenialReason::NotFound) => (
                    WireStatus::NotFound,
                    "No matching item found",
                    "credential_not_found",
                ),
                Some(CredentialDenialReason::Locked) => {
                    (WireStatus::Locked, "Vault is locked", "credential_denied")
                }
                // `denial_detail` is contractually value-free (machine-readable reasons,
                // origins, static guidance — never vault data; see
                // `CredentialResponseData::denial_detail`'s docs), so passing it through here is
                // the same trust boundary the `OriginMismatch`/`NoSafeTarget` arms below already
                // cross. A precise, actionable `Internal` detail (e.g. "the browser extension
                // isn't connected") was previously computed by the TS host and discarded here in
                // favor of a generic string — the finding this closes.
                Some(CredentialDenialReason::Internal) => (
                    WireStatus::Error,
                    response
                        .denial_detail
                        .as_deref()
                        .unwrap_or("Request could not be completed"),
                    "credential_denied",
                ),
                // M5, pre-prompt mechanical refusals: never a user decision either, same
                // "tell the truth about why" rule as Locked/Internal above.
                Some(CredentialDenialReason::OriginMismatch) => (
                    WireStatus::OriginMismatch,
                    response
                        .denial_detail
                        .as_deref()
                        .unwrap_or("No saved login matches this origin"),
                    "credential_denied",
                ),
                Some(CredentialDenialReason::NoSafeTarget) => (
                    WireStatus::NoSafeTarget,
                    response
                        .denial_detail
                        .as_deref()
                        .unwrap_or("No safe fill target on this page"),
                    "credential_denied",
                ),
                Some(CredentialDenialReason::Denied) | None => {
                    (WireStatus::Denied, "Denied by user", "credential_denied")
                }
            };
            let mut wire_response = WireResponse::status(status, message);
            // Best-effort, value-free pass-through: on `originMismatch` the extension-reported
            // origin rides here as `fill.origin` per agent-access-architecture.md's "M5" wire
            // section ("Response carries fill.origin"). A missing/malformed pass-through never
            // blocks the (already informative, via `message`) denial reply — unlike the
            // approved-fill path, this is optional decoration, not the primary payload.
            if let Some(raw) = response.fill_result.as_deref() {
                wire_response.fill = serde_json::from_str(raw).ok();
            }
            DispatchOutcome {
                response: wire_response,
                event_kind,
                fields_shared: None,
            }
        }
        // Callback-level failure: never surface details, same rule as the relay dispatch path.
        Ok(Err(_)) => DispatchOutcome {
            response: WireResponse::status(WireStatus::Error, "Request failed"),
            event_kind: "credential_denied",
            fields_shared: None,
        },
        Err(_) => DispatchOutcome {
            response: WireResponse::status(WireStatus::Timeout, "Request timed out"),
            event_kind: "credential_denied",
            fields_shared: None,
        },
    }
}

/// Builds the `status: "approved"` reply for either resource kind. `response.approved` is
/// `true` for every caller of this function (checked in [`build_response`]).
fn build_approved(
    response: &CredentialResponseData,
    resource: ResourceKind,
    delivery: DeliveryMode,
) -> WireResponse {
    match resource {
        ResourceKind::Credential => build_approved_credential(response, delivery),
        ResourceKind::Secret => build_approved_secret(response, delivery),
    }
}

/// The four credential field values actually released onto the wire for a given delivery mode
/// — `[username, password, totp, uri]`, each `None` unless that role is both present on the
/// handler's response and released by this delivery mode (`Reference` releases `username` only;
/// `Fill` releases none of these — see `build_approved_fill`/`fill_fields_shared` instead).
///
/// This is the single source of truth for the two call sites that must never drift apart:
/// [`build_approved_credential`]'s `Inject`/`Reference` arms build `WireCredential`/
/// `WireItem::username` from exactly these values, and [`fields_shared_list`] reports exactly
/// the roles among these that are `Some`. A role can therefore never be recorded as "shared" in
/// the activity log unless this function actually put it on the wire — the failure mode this
/// closes: `fields_shared_list` used to derive its own, separately-maintained list and reported
/// `password`/`totp`/`uri` as shared even in `Reference` mode, where they never leave the
/// desktop.
fn released_credential_fields(
    response: &CredentialResponseData,
    delivery: DeliveryMode,
) -> [Option<&str>; 4] {
    match delivery {
        DeliveryMode::Inject => [
            response.username.as_deref(),
            response.password.as_deref(),
            response.totp.as_deref(),
            response.uri.as_deref(),
        ],
        DeliveryMode::Reference => [response.username.as_deref(), None, None, None],
        DeliveryMode::Fill => [None, None, None, None],
    }
}

/// `notes` is never read here — it is never included in any local reply, regardless of delivery
/// mode (agent-access-architecture.md, "Local wire protocol v1").
fn build_approved_credential(
    response: &CredentialResponseData,
    delivery: DeliveryMode,
) -> WireResponse {
    let Some(credential_id) = response.credential_id.clone() else {
        // Handler contract violation (an approved response always carries a credential id —
        // the relay dispatch path assumes the same thing). Deny-safe: there is no reference we
        // can construct without an id.
        return WireResponse::status(WireStatus::Error, "Approved response missing credential id");
    };
    let reference = format!("bw://item/{credential_id}");

    match delivery {
        DeliveryMode::Inject => {
            let [username, password, totp, uri] = released_credential_fields(response, delivery);
            WireResponse {
                version: VERSION,
                status: WireStatus::Approved,
                credential: Some(WireCredential {
                    username: username.map(str::to_string),
                    password: password.map(str::to_string),
                    totp: totp.map(str::to_string),
                    uri: uri.map(str::to_string),
                    credential_id,
                }),
                secret: None,
                reference: Some(reference),
                item: None,
                message: None,
                fill: None,
                fill_target: None,
            }
        }
        DeliveryMode::Reference => {
            let [username, ..] = released_credential_fields(response, delivery);
            WireResponse {
                version: VERSION,
                status: WireStatus::Approved,
                credential: None,
                secret: None,
                reference: Some(reference),
                item: Some(WireItem {
                    name: response.item_name.clone(),
                    username: username.map(str::to_string),
                }),
                message: None,
                fill: None,
                fill_target: None,
            }
        }
        DeliveryMode::Fill => build_approved_fill(response, reference),
    }
}

/// Builds the `status: "approved"`, `delivery: "fill"` reply (M5). This function never reads
/// `response.password`/`response.totp`/`response.secret_value` — the only fields it releases
/// are `item` (name + username, the same display metadata a reference-mode reply carries — see
/// the wire example in agent-access-architecture.md's "M5" section, which shows `item.username`
/// in an approved-fill reply) and the `fill` pass-through the TS host already built. The
/// credential *value* never transits this function or the local socket at all — it goes
/// desktop→extension over a separate channel (M5, "Core property").
///
/// Missing/malformed `fill_result` fails closed: an approved-fill reply with no execution
/// outcome is a handler contract violation, not something to paper over with an empty object —
/// mirrors [`build_approved_credential`]'s missing-credential-id handling.
fn build_approved_fill(response: &CredentialResponseData, reference: String) -> WireResponse {
    let Some(fill_json) = response.fill_result.as_deref() else {
        return WireResponse::status(
            WireStatus::Error,
            "Approved fill response missing fill result",
        );
    };
    let Ok(fill) = serde_json::from_str::<serde_json::Value>(fill_json) else {
        return WireResponse::status(
            WireStatus::Error,
            "Approved fill response has malformed fill result",
        );
    };
    WireResponse {
        version: VERSION,
        status: WireStatus::Approved,
        credential: None,
        secret: None,
        reference: Some(reference),
        item: Some(WireItem {
            name: response.item_name.clone(),
            username: response.username.clone(),
        }),
        message: None,
        fill: Some(fill),
        fill_target: None,
    }
}

/// Builds the `status: "approved"` reply for `describeFillTarget` (M5). No `item`, no
/// `reference`, no `credential`/`secret` — a describe reply is page metadata only, never vault
/// data (agent-access-architecture.md's "M5" invariant 12: "`describeFillTarget` touches no
/// vault data and requires no approval; its reply describes the page only").
///
/// Missing/malformed `fill_target` fails closed, mirroring [`build_approved_fill`]'s handling of
/// `fill_result`.
fn build_approved_describe_fill_target(response: &CredentialResponseData) -> WireResponse {
    let Some(raw) = response.fill_target.as_deref() else {
        return WireResponse::status(
            WireStatus::Error,
            "Approved describeFillTarget response missing fill target",
        );
    };
    let Ok(fill_target) = serde_json::from_str::<serde_json::Value>(raw) else {
        return WireResponse::status(
            WireStatus::Error,
            "Approved describeFillTarget response has malformed fill target",
        );
    };
    WireResponse {
        version: VERSION,
        status: WireStatus::Approved,
        credential: None,
        secret: None,
        reference: None,
        item: None,
        message: None,
        fill: None,
        fill_target: Some(fill_target),
    }
}

/// `note` is never read here — the secrets analogue of `notes` above, never included in any
/// local reply (agent-access-architecture.md, "M4 — Secrets Manager secrets over user auth",
/// invariant 2).
fn build_approved_secret(
    response: &CredentialResponseData,
    delivery: DeliveryMode,
) -> WireResponse {
    match delivery {
        DeliveryMode::Inject => {
            // Handler contract violation (an approved inject-mode secret response always
            // carries a name, a value, and an id — the wire contract pins all three as
            // required). Deny-safe: fail closed rather than release a partial/malformed
            // secret payload — mirrors the missing-credential-id path above.
            let (Some(name), Some(secret_value), Some(secret_id)) = (
                response.item_name.clone(),
                response.secret_value.clone(),
                response.secret_id.clone(),
            ) else {
                return WireResponse::status(
                    WireStatus::Error,
                    "Approved response missing secret name, value, or id",
                );
            };
            WireResponse {
                version: VERSION,
                status: WireStatus::Approved,
                credential: None,
                secret: Some(WireSecret {
                    name,
                    value: secret_value.to_string(),
                    secret_id: secret_id.clone(),
                }),
                reference: Some(format!("bw://secret/{secret_id}")),
                item: None,
                message: None,
                fill: None,
                fill_target: None,
            }
        }
        DeliveryMode::Reference => {
            let Some(secret_id) = response.secret_id.clone() else {
                return WireResponse::status(
                    WireStatus::Error,
                    "Approved response missing secret id",
                );
            };
            WireResponse {
                version: VERSION,
                status: WireStatus::Approved,
                credential: None,
                // No `secret` object by construction — reference-mode replies never carry a
                // secret value, matching the credential path's reference-mode guarantee.
                secret: None,
                reference: Some(format!("bw://secret/{secret_id}")),
                item: Some(WireItem {
                    name: response.item_name.clone(),
                    // `item.username` is a credential-only concept; secrets never populate it.
                    username: None,
                }),
                message: None,
                fill: None,
                fill_target: None,
            }
        }
        // Unreachable in practice — `validate` rejects `delivery: "fill"` for
        // `ResourceKind::Secret` before a `ValidatedRequest::Lookup` (and therefore this call)
        // can ever be constructed. Handled explicitly (fail closed) rather than `unreachable!()`
        // so a future refactor that loosens that guarantee degrades safely instead of panicking
        // on a caller-controlled input.
        DeliveryMode::Fill => WireResponse::status(
            WireStatus::Error,
            "Fill delivery is not supported for secrets",
        ),
    }
}

/// Builds the `status: "approved"` reply for an approved `secretCreate`. Reference + item name
/// only — by construction there is no `secret` object and no `value` field anywhere in this
/// function, so the created value can never be echoed back (agent-access-architecture.md, "M4b —
/// secret creation": "The stored value is NEVER echoed back", and invariant 7). `note` is never
/// read here either, same as every other local reply.
///
/// Missing `secret_id` or `item_name` on an approved response is a handler contract violation
/// (mirrors [`build_approved_secret`]'s missing-id handling) — deny-safe: fail closed rather than
/// synthesize a reference or a name from nothing.
fn build_approved_create(response: &CredentialResponseData) -> WireResponse {
    let (Some(secret_id), Some(name)) = (response.secret_id.clone(), response.item_name.clone())
    else {
        return WireResponse::status(
            WireStatus::Error,
            "Approved response missing secret id or name",
        );
    };
    WireResponse {
        version: VERSION,
        status: WireStatus::Approved,
        credential: None,
        // No `secret` object, ever — a create response never carries a value, approved or not.
        secret: None,
        reference: Some(format!("bw://secret/{secret_id}")),
        item: Some(WireItem {
            name: Some(name),
            // `item.username` is a credential-only concept; secrets never populate it.
            username: None,
        }),
        message: None,
        fill: None,
        fill_target: None,
    }
}

/// Comma-joins the field names released in an approved reply (e.g. `"username,password,totp"`)
/// for the activity log's `fields_shared`. Deliberately omits `notes`/`note` — neither ever
/// rides on any local reply, so neither can ever be "shared" from this path either.
///
/// For `ResourceKind::Credential` the `Inject`/`Reference` arm draws on
/// [`released_credential_fields`] — the same function [`build_approved_credential`] uses to
/// populate `WireCredential`/`WireItem::username` — so this can only ever report a role as
/// shared if that role was actually put on the wire; see that function's docs for the drift
/// this closes. `delivery` matters here as well as `resource` for a second reason: an approved
/// `Fill` reply never carries `username`/`password`/`totp` on `response` at all (see
/// [`build_approved_fill`]'s docs — those fields are simply never populated for a fill
/// request), so the roles actually filled come from `response.fill_fields_shared` instead,
/// supplied directly by the TS host. Matching exhaustively on `delivery` (no wildcard) inside
/// the `Credential` arm means a future `DeliveryMode` variant fails to compile here rather than
/// silently falling into a branch that could under-report a real disclosure.
fn fields_shared_list(
    response: &CredentialResponseData,
    resource: ResourceKind,
    delivery: DeliveryMode,
) -> Option<String> {
    match resource {
        ResourceKind::Credential => match delivery {
            DeliveryMode::Fill => response
                .fill_fields_shared
                .as_ref()
                .filter(|fields| !fields.is_empty())
                .map(|fields| fields.join(",")),
            DeliveryMode::Inject | DeliveryMode::Reference => {
                const ROLE_NAMES: [&str; 4] = ["username", "password", "totp", "uri"];
                let shared: Vec<&str> = ROLE_NAMES
                    .into_iter()
                    .zip(released_credential_fields(response, delivery))
                    .filter_map(|(name, value)| value.is_some().then_some(name))
                    .collect();
                (!shared.is_empty()).then(|| shared.join(","))
            }
        },
        // `Fill` is credential-only (`validate` rejects it for `ResourceKind::Secret`), so a
        // secret's delivery is always `Inject`/`Reference` in practice; `secret_value` isn't
        // gated on delivery here (unchanged from before this fix — out of this bug's scope).
        ResourceKind::Secret => response.secret_value.is_some().then(|| "value".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approving_response() -> CredentialResponseData {
        CredentialResponseData {
            approved: true,
            username: Some("user@example.com".to_string()),
            password: Some("hunter2".to_string()),
            totp: Some("123456".to_string()),
            uri: Some("https://example.com".to_string()),
            notes: Some("do not leak me".to_string()),
            credential_id: Some("cipher-1".to_string()),
            ..Default::default()
        }
    }

    // --- deserialization -----------------------------------------------------------------

    #[test]
    fn deserializes_a_well_formed_request() {
        let json = r#"{"version":1,"op":"credentialRequest",
            "query":{"type":"domain","value":"github.com"},
            "delivery":"inject",
            "client":{"name":"aac","version":"0.1.0"}}"#;
        let request: WireRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.version, 1);
        assert_eq!(request.op, "credentialRequest");
        let query = request.query.unwrap();
        assert!(matches!(query.kind, WireQueryType::Domain));
        assert_eq!(query.value, "github.com");
        assert!(matches!(request.delivery.unwrap(), WireDelivery::Inject));
        assert_eq!(request.client.unwrap().name, "aac");
    }

    #[test]
    fn deserializes_a_well_formed_secret_request() {
        let json = r#"{"version":1,"op":"secretRequest",
            "query":{"type":"name","value":"DB_PASSWORD"},
            "delivery":"inject",
            "client":{"name":"aac","version":"0.1.0"}}"#;
        let request: WireRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.op, "secretRequest");
        let query = request.query.unwrap();
        assert!(matches!(query.kind, WireQueryType::Name));
        assert_eq!(query.value, "DB_PASSWORD");
    }

    /// The exact `secretCreate` request literal from agent-access-architecture.md's "M4b —
    /// secret creation" wire section.
    #[test]
    fn deserializes_a_well_formed_create_request() {
        let json = r#"{"version":1,"op":"secretCreate","create":{"name":"DB_PASSWORD",
            "value":"hunter2","note":"prod db","project":"my-app"},
            "client":{"name":"aac","version":"0.1.0"}}"#;
        let request: WireRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.op, "secretCreate");
        assert!(request.query.is_none());
        assert!(request.delivery.is_none());
        let create = request.create.unwrap();
        assert_eq!(create.name, "DB_PASSWORD");
        assert_eq!(create.value, "hunter2");
        assert_eq!(create.note.as_deref(), Some("prod db"));
        assert_eq!(create.project.as_deref(), Some("my-app"));
    }

    /// `note`/`project` are optional on the wire.
    #[test]
    fn deserializes_a_create_request_without_note_or_project() {
        let json = r#"{"version":1,"op":"secretCreate",
            "create":{"name":"DB_PASSWORD","value":"hunter2"}}"#;
        let request: WireRequest = serde_json::from_str(json).unwrap();
        let create = request.create.unwrap();
        assert!(create.note.is_none());
        assert!(create.project.is_none());
    }

    #[test]
    fn unknown_fields_are_ignored() {
        let json = r#"{"version":1,"op":"credentialRequest",
            "query":{"type":"id","value":"cipher-1","futureField":"x"},
            "delivery":"reference",
            "futureTopLevelField":42}"#;
        let request: WireRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.query.unwrap().value, "cipher-1");
    }

    #[test]
    fn malformed_json_fails_to_parse() {
        let result: Result<WireRequest, _> = serde_json::from_str("not json");
        assert!(result.is_err());
    }

    // --- validate --------------------------------------------------------------------------

    /// Asserts `validate(request)` fails with exactly `expected`. A free function rather than
    /// `.unwrap_err()` because [`ValidatedRequest`]'s `Create` arm carries a `Zeroizing<String>`
    /// (no `PartialEq`, and a deliberately redacting `Debug`), so `assert_eq!` on the whole
    /// `Result` doesn't apply here the way it does for the plain-`&str`-keyed error side.
    fn assert_validation_error(request: WireRequest, expected: &str) {
        match validate(request) {
            Err(message) => assert_eq!(message, expected),
            Ok(_) => panic!("expected validation error {expected:?}, got Ok"),
        }
    }

    fn base_lookup_request() -> WireRequest {
        WireRequest {
            version: 1,
            op: "credentialRequest".to_string(),
            query: Some(WireQuery {
                kind: WireQueryType::Domain,
                value: "x".to_string(),
            }),
            delivery: Some(WireDelivery::Inject),
            create: None,
            fill: None,
            client: None,
        }
    }

    #[test]
    fn validate_rejects_unsupported_version() {
        let request = WireRequest {
            version: 2,
            ..base_lookup_request()
        };
        assert_validation_error(request, "unsupported protocol version");
    }

    #[test]
    fn validate_rejects_unknown_op() {
        let request = WireRequest {
            op: "somethingElse".to_string(),
            ..base_lookup_request()
        };
        assert_validation_error(request, "unknown operation");
    }

    #[test]
    fn validate_rejects_missing_query() {
        let request = WireRequest {
            query: None,
            ..base_lookup_request()
        };
        assert_validation_error(request, "missing query");
    }

    #[test]
    fn validate_rejects_missing_delivery() {
        let request = WireRequest {
            delivery: None,
            ..base_lookup_request()
        };
        assert_validation_error(request, "missing delivery mode");
    }

    #[test]
    fn validate_accepts_a_well_formed_request() {
        let request = WireRequest {
            query: Some(WireQuery {
                kind: WireQueryType::Search,
                value: "bank".to_string(),
            }),
            delivery: Some(WireDelivery::Reference),
            ..base_lookup_request()
        };
        match validate(request).unwrap() {
            ValidatedRequest::Lookup {
                resource,
                query,
                delivery,
                ..
            } => {
                assert_eq!(resource, ResourceKind::Credential);
                assert_eq!(query.value, "bank");
                assert_eq!(delivery, DeliveryMode::Reference);
            }
            other => panic!("expected a Lookup, got {other:?}"),
        }
    }

    #[test]
    fn validate_accepts_a_well_formed_secret_request() {
        let request = WireRequest {
            op: "secretRequest".to_string(),
            query: Some(WireQuery {
                kind: WireQueryType::Name,
                value: "DB_PASSWORD".to_string(),
            }),
            delivery: Some(WireDelivery::Inject),
            ..base_lookup_request()
        };
        match validate(request).unwrap() {
            ValidatedRequest::Lookup {
                resource,
                query,
                delivery,
                ..
            } => {
                assert_eq!(resource, ResourceKind::Secret);
                assert_eq!(query.value, "DB_PASSWORD");
                assert_eq!(delivery, DeliveryMode::Inject);
            }
            other => panic!("expected a Lookup, got {other:?}"),
        }
    }

    /// Full op/query-type combination matrix from "M4 — Secrets Manager secrets over user
    /// auth": `domain` only for `credentialRequest`, `name` only for `secretRequest`, `id`/
    /// `search` valid for both. Every invalid combination must be a protocol error
    /// (`Err`), never a panic.
    #[test]
    fn validate_enforces_op_query_type_matrix() {
        let combinations = [
            ("credentialRequest", WireQueryType::Domain, true),
            ("credentialRequest", WireQueryType::Id, true),
            ("credentialRequest", WireQueryType::Search, true),
            ("credentialRequest", WireQueryType::Name, false),
            ("secretRequest", WireQueryType::Domain, false),
            ("secretRequest", WireQueryType::Id, true),
            ("secretRequest", WireQueryType::Search, true),
            ("secretRequest", WireQueryType::Name, true),
        ];

        for (op, query_type, expect_ok) in combinations {
            let request = WireRequest {
                op: op.to_string(),
                query: Some(WireQuery {
                    kind: query_type,
                    value: "x".to_string(),
                }),
                ..base_lookup_request()
            };
            let result = validate(request);
            assert_eq!(
                result.is_ok(),
                expect_ok,
                "op={op:?} query_type={query_type:?} expected ok={expect_ok}"
            );
        }
    }

    // --- validate: secretCreate --------------------------------------------------------------

    fn base_create_request() -> WireRequest {
        WireRequest {
            version: 1,
            op: "secretCreate".to_string(),
            query: None,
            delivery: None,
            create: Some(WireCreate {
                name: "DB_PASSWORD".to_string(),
                value: "hunter2".to_string(),
                note: Some("prod db".to_string()),
                project: Some("my-app".to_string()),
            }),
            fill: None,
            client: None,
        }
    }

    #[test]
    fn validate_accepts_a_well_formed_create_request() {
        let request = base_create_request();
        match validate(request).unwrap() {
            ValidatedRequest::Create {
                name,
                value,
                note,
                project,
                ..
            } => {
                assert_eq!(name, "DB_PASSWORD");
                assert_eq!(value.as_str(), "hunter2");
                assert_eq!(note.as_deref(), Some("prod db"));
                assert_eq!(project.as_deref(), Some("my-app"));
            }
            other => panic!("expected a Create, got {other:?}"),
        }
    }

    #[test]
    fn validate_accepts_a_create_request_without_note_or_project() {
        let request = WireRequest {
            create: Some(WireCreate {
                name: "DB_PASSWORD".to_string(),
                value: "hunter2".to_string(),
                note: None,
                project: None,
            }),
            ..base_create_request()
        };
        match validate(request).unwrap() {
            ValidatedRequest::Create { note, project, .. } => {
                assert!(note.is_none());
                assert!(project.is_none());
            }
            other => panic!("expected a Create, got {other:?}"),
        }
    }

    #[test]
    fn validate_rejects_secret_create_with_no_create_object() {
        let request = WireRequest {
            create: None,
            ..base_create_request()
        };
        assert_validation_error(request, "missing create object");
    }

    #[test]
    fn validate_rejects_secret_create_with_empty_name() {
        let request = WireRequest {
            create: Some(WireCreate {
                name: String::new(),
                value: "hunter2".to_string(),
                note: None,
                project: None,
            }),
            ..base_create_request()
        };
        assert_validation_error(request, "create.name must not be empty");
    }

    #[test]
    fn validate_rejects_secret_create_with_empty_value() {
        let request = WireRequest {
            create: Some(WireCreate {
                name: "DB_PASSWORD".to_string(),
                value: String::new(),
                note: None,
                project: None,
            }),
            ..base_create_request()
        };
        assert_validation_error(request, "create.value must not be empty");
    }

    #[test]
    fn validate_rejects_a_create_object_on_credential_request() {
        let request = WireRequest {
            create: Some(WireCreate {
                name: "DB_PASSWORD".to_string(),
                value: "hunter2".to_string(),
                note: None,
                project: None,
            }),
            ..base_lookup_request()
        };
        assert_validation_error(request, "create object is not valid for this operation");
    }

    #[test]
    fn validate_rejects_a_create_object_on_secret_request() {
        let request = WireRequest {
            op: "secretRequest".to_string(),
            query: Some(WireQuery {
                kind: WireQueryType::Name,
                value: "DB_PASSWORD".to_string(),
            }),
            create: Some(WireCreate {
                name: "DB_PASSWORD".to_string(),
                value: "hunter2".to_string(),
                note: None,
                project: None,
            }),
            ..base_lookup_request()
        };
        assert_validation_error(request, "create object is not valid for this operation");
    }

    // --- validate: delivery "fill" (M5) -------------------------------------------------------

    #[test]
    fn validate_accepts_a_well_formed_fill_request() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Fill),
            fill: Some(WireFillParams {
                fields: Some(vec!["username".to_string(), "password".to_string()]),
                target_token: Some("ft_abc".to_string()),
            }),
            ..base_lookup_request()
        };
        match validate(request).unwrap() {
            ValidatedRequest::Lookup {
                resource,
                delivery,
                fill,
                ..
            } => {
                assert_eq!(resource, ResourceKind::Credential);
                assert_eq!(delivery, DeliveryMode::Fill);
                let fill = fill.expect("fill params expected for delivery \"fill\"");
                assert_eq!(
                    fill.fields,
                    Some(vec!["username".to_string(), "password".to_string()])
                );
                assert_eq!(fill.target_token.as_deref(), Some("ft_abc"));
            }
            other => panic!("expected a Lookup, got {other:?}"),
        }
    }

    /// `fill` is entirely optional on the wire — omitting it must not fail validation, and the
    /// resulting `FillParams` (still `Some`, since delivery is `"fill"`) must have both fields
    /// unset, matching the wire contract's "default: all present & safe" behavior.
    #[test]
    fn validate_accepts_a_fill_request_without_a_fill_object() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Fill),
            fill: None,
            ..base_lookup_request()
        };
        match validate(request).unwrap() {
            ValidatedRequest::Lookup { delivery, fill, .. } => {
                assert_eq!(delivery, DeliveryMode::Fill);
                let fill = fill.expect("fill params expected for delivery \"fill\"");
                assert!(fill.fields.is_none());
                assert!(fill.target_token.is_none());
            }
            other => panic!("expected a Lookup, got {other:?}"),
        }
    }

    /// A non-`"fill"` delivery never carries `FillParams`, even implicitly — asserting this
    /// alongside the "accepts" tests above pins the contract that `fill` is `None` exactly when
    /// delivery isn't `"fill"`.
    #[test]
    fn validate_leaves_fill_none_for_non_fill_deliveries() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Inject),
            fill: None,
            ..base_lookup_request()
        };
        match validate(request).unwrap() {
            ValidatedRequest::Lookup { delivery, fill, .. } => {
                assert_eq!(delivery, DeliveryMode::Inject);
                assert!(fill.is_none());
            }
            other => panic!("expected a Lookup, got {other:?}"),
        }
    }

    #[test]
    fn validate_rejects_fill_delivery_for_secret_request() {
        let request = WireRequest {
            op: "secretRequest".to_string(),
            query: Some(WireQuery {
                kind: WireQueryType::Name,
                value: "DB_PASSWORD".to_string(),
            }),
            delivery: Some(WireDelivery::Fill),
            ..base_lookup_request()
        };
        assert_validation_error(request, "fill delivery is not supported for secrets");
    }

    #[test]
    fn validate_rejects_a_fill_object_on_inject_delivery() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Inject),
            fill: Some(WireFillParams {
                fields: Some(vec!["username".to_string()]),
                target_token: None,
            }),
            ..base_lookup_request()
        };
        assert_validation_error(request, "fill object is only valid with delivery \"fill\"");
    }

    #[test]
    fn validate_rejects_a_fill_object_on_reference_delivery() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Reference),
            fill: Some(WireFillParams::default()),
            ..base_lookup_request()
        };
        assert_validation_error(request, "fill object is only valid with delivery \"fill\"");
    }

    #[test]
    fn validate_rejects_an_unknown_fill_field_role() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Fill),
            fill: Some(WireFillParams {
                fields: Some(vec!["username".to_string(), "notes".to_string()]),
                target_token: None,
            }),
            ..base_lookup_request()
        };
        assert_validation_error(request, "unknown fill field role");
    }

    #[test]
    fn validate_rejects_a_fill_object_on_secret_create() {
        let request = WireRequest {
            fill: Some(WireFillParams::default()),
            ..base_create_request()
        };
        assert_validation_error(request, "fill object is not valid for this operation");
    }

    // --- validate: describeFillTarget (M5) ------------------------------------------------------

    fn base_describe_fill_target_request() -> WireRequest {
        WireRequest {
            version: 1,
            op: "describeFillTarget".to_string(),
            query: None,
            delivery: None,
            create: None,
            fill: None,
            client: Some(WireClientInfo {
                name: "aac".to_string(),
                version: "0.1.0".to_string(),
            }),
        }
    }

    #[test]
    fn validate_accepts_a_well_formed_describe_fill_target_request() {
        let request = base_describe_fill_target_request();
        match validate(request).unwrap() {
            ValidatedRequest::DescribeFillTarget { client } => {
                assert_eq!(client.unwrap().name, "aac");
            }
            other => panic!("expected a DescribeFillTarget, got {other:?}"),
        }
    }

    #[test]
    fn validate_rejects_a_query_on_describe_fill_target() {
        let request = WireRequest {
            query: Some(WireQuery {
                kind: WireQueryType::Domain,
                value: "bitnotes.io".to_string(),
            }),
            ..base_describe_fill_target_request()
        };
        assert_validation_error(request, "query is not valid for describeFillTarget");
    }

    #[test]
    fn validate_rejects_a_delivery_on_describe_fill_target() {
        let request = WireRequest {
            delivery: Some(WireDelivery::Reference),
            ..base_describe_fill_target_request()
        };
        assert_validation_error(request, "delivery is not valid for describeFillTarget");
    }

    #[test]
    fn validate_rejects_a_fill_object_on_describe_fill_target() {
        let request = WireRequest {
            fill: Some(WireFillParams::default()),
            ..base_describe_fill_target_request()
        };
        assert_validation_error(request, "fill object is not valid for describeFillTarget");
    }

    #[test]
    fn validate_rejects_a_create_object_on_describe_fill_target() {
        let request = WireRequest {
            create: Some(WireCreate {
                name: "x".to_string(),
                value: "y".to_string(),
                note: None,
                project: None,
            }),
            ..base_describe_fill_target_request()
        };
        assert_validation_error(request, "create object is not valid for describeFillTarget");
    }

    // --- response construction --------------------------------------------------------------

    fn approving_secret_response() -> CredentialResponseData {
        CredentialResponseData {
            approved: true,
            item_name: Some("DB_PASSWORD".to_string()),
            secret_value: Some(zeroize::Zeroizing::new("super-secret".to_string())),
            secret_id: Some("secret-1".to_string()),
            notes: Some("do not leak me".to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn approved_inject_carries_credential_and_reference_never_notes() {
        let outcome = build_response(
            Ok(Ok(approving_response())),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.event_kind, "credential_approved");
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(json.contains("\"status\":\"approved\""));
        assert!(json.contains("\"reference\":\"bw://item/cipher-1\""));
        assert!(json.contains("hunter2"));
        assert!(!json.contains("\"item\""));
        assert!(
            !json.contains("do not leak me"),
            "notes must never appear in a local reply"
        );
        assert_eq!(
            outcome.fields_shared.as_deref(),
            Some("username,password,totp,uri")
        );
    }

    #[test]
    fn approved_reference_strips_credential_values_even_though_handler_returned_them() {
        let mut response = approving_response();
        response.item_name = Some("GitHub".to_string());
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Reference),
        );
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(json.contains("\"status\":\"approved\""));
        assert!(json.contains("\"reference\":\"bw://item/cipher-1\""));
        assert!(json.contains("\"item\""));
        assert!(json.contains("GitHub"));
        assert!(
            json.contains("user@example.com"),
            "item.username is expected"
        );
        assert!(!json.contains("\"credential\""));
        assert!(
            !json.contains("hunter2"),
            "the password must never appear in a reference-mode reply"
        );
        assert!(
            !json.contains("123456"),
            "the totp must never appear in a reference-mode reply"
        );
        assert!(
            !json.contains("do not leak me"),
            "notes must never appear in a local reply"
        );
    }

    #[test]
    fn approved_without_credential_id_denies_safely() {
        let mut response = approving_response();
        response.credential_id = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.credential.is_none());
        assert!(outcome.response.reference.is_none());
    }

    // --- fill response construction (M5) ------------------------------------------------------

    /// The exact approved-fill response literal from agent-access-architecture.md's "M5" wire
    /// section (`fill_result`), minus the top-level `version`/`status`/`item`/`reference` this
    /// crate builds itself.
    const FILL_RESULT_LITERAL: &str = r#"{"status":"filled","origin":"https://bitnotes.io",
        "fields":[{"role":"username","status":"filled","target":"input#email (login form)"},
        {"role":"password","status":"filled","target":"input[type=password]#pw"},
        {"role":"totp","status":"skipped","reason":"no one-time-code field"}]}"#;

    fn approving_fill_response() -> CredentialResponseData {
        CredentialResponseData {
            approved: true,
            username: Some("demo@bitnotes.io".to_string()),
            // A misbehaving handler that (incorrectly) populated these must still never see them
            // echoed back — see `approved_fill_never_reads_password_or_totp_from_response` below.
            password: Some("hunter2".to_string()),
            totp: Some("123456".to_string()),
            credential_id: Some("cipher-1".to_string()),
            item_name: Some("bitnotes.io".to_string()),
            notes: Some("do not leak me".to_string()),
            fill_result: Some(FILL_RESULT_LITERAL.to_string()),
            fill_fields_shared: Some(vec!["username".to_string(), "password".to_string()]),
            ..Default::default()
        }
    }

    #[test]
    fn approved_fill_carries_item_reference_and_fill_passthrough_never_notes() {
        let outcome = build_response(
            Ok(Ok(approving_fill_response())),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        assert_eq!(outcome.event_kind, "credential_approved");
        let value: serde_json::Value = serde_json::to_value(&outcome.response).unwrap();
        assert_eq!(value["status"], "approved");
        assert_eq!(value["reference"], "bw://item/cipher-1");
        assert_eq!(value["item"]["name"], "bitnotes.io");
        assert_eq!(value["item"]["username"], "demo@bitnotes.io");
        assert_eq!(value["fill"]["status"], "filled");
        assert_eq!(value["fill"]["origin"], "https://bitnotes.io");
        assert_eq!(value["fill"]["fields"][0]["role"], "username");
        assert!(value.get("credential").is_none());
        assert!(value.get("secret").is_none());
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(
            !json.contains("do not leak me"),
            "notes must never appear in a local reply"
        );
        assert_eq!(outcome.fields_shared.as_deref(), Some("username,password"));
    }

    /// The whole point of `delivery: "fill"`: the credential value never rides this reply, even
    /// though the (misbehaving) handler in [`approving_fill_response`] populated
    /// `password`/`totp` on the response it returned.
    #[test]
    fn approved_fill_never_echoes_password_or_totp_even_if_the_handler_returned_them() {
        let outcome = build_response(
            Ok(Ok(approving_fill_response())),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(
            !json.contains("hunter2"),
            "the password must never appear in a fill-delivery reply"
        );
        assert!(
            !json.contains("123456"),
            "the totp must never appear in a fill-delivery reply"
        );
    }

    #[test]
    fn approved_fill_missing_fill_result_denies_safely() {
        let mut response = approving_fill_response();
        response.fill_result = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.fill.is_none());
        assert!(outcome.response.reference.is_none());
        assert!(outcome.response.item.is_none());
    }

    #[test]
    fn approved_fill_malformed_fill_result_denies_safely() {
        let mut response = approving_fill_response();
        response.fill_result = Some("not json".to_string());
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.fill.is_none());
    }

    /// Bug fix regression guard: `Reference` mode never releases password/totp/uri (see
    /// `build_approved_credential`'s `Reference` arm), so a fully-populated response must still
    /// report only `username` as shared — the false-audit-evidence finding this closes.
    #[test]
    fn fields_shared_list_reference_arm_reports_username_only() {
        assert_eq!(
            fields_shared_list(
                &approving_response(),
                ResourceKind::Credential,
                DeliveryMode::Reference
            ),
            Some("username".to_string())
        );

        let mut without_username = approving_response();
        without_username.username = None;
        assert_eq!(
            fields_shared_list(
                &without_username,
                ResourceKind::Credential,
                DeliveryMode::Reference
            ),
            None,
            "no field is shared in reference mode when even username is absent"
        );
    }

    /// Regression guard: `Inject` mode must keep reporting every present field, unlike
    /// `Reference` above — pins that the Bug 1 fix split the two apart rather than narrowing
    /// both.
    #[test]
    fn fields_shared_list_inject_arm_reports_all_present_fields() {
        assert_eq!(
            fields_shared_list(
                &approving_response(),
                ResourceKind::Credential,
                DeliveryMode::Inject
            ),
            Some("username,password,totp,uri".to_string())
        );
    }

    #[test]
    fn fields_shared_list_fill_arm_reports_the_filled_roles() {
        assert_eq!(
            fields_shared_list(
                &approving_fill_response(),
                ResourceKind::Credential,
                DeliveryMode::Fill
            ),
            Some("username,password".to_string())
        );

        let mut without_fields = approving_fill_response();
        without_fields.fill_fields_shared = None;
        assert_eq!(
            fields_shared_list(
                &without_fields,
                ResourceKind::Credential,
                DeliveryMode::Fill
            ),
            None
        );
    }

    #[test]
    fn origin_mismatch_reason_maps_to_origin_mismatch_status_with_value_free_message() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::OriginMismatch),
            denial_detail: Some("https://evil.example".to_string()),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        assert_eq!(outcome.response.status, WireStatus::OriginMismatch);
        assert_eq!(
            outcome.response.message.as_deref(),
            Some("https://evil.example")
        );
        assert_ne!(
            outcome.response.message.as_deref(),
            Some("Denied by user"),
            "a mechanical origin refusal must never be reported as a user decision"
        );
        assert!(outcome.fields_shared.is_none());
    }

    #[test]
    fn no_safe_target_reason_maps_to_no_safe_target_status_with_value_free_message() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::NoSafeTarget),
            denial_detail: Some("looks-like-registration".to_string()),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        assert_eq!(outcome.response.status, WireStatus::NoSafeTarget);
        assert_eq!(
            outcome.response.message.as_deref(),
            Some("looks-like-registration")
        );
        assert_ne!(
            outcome.response.message.as_deref(),
            Some("Denied by user"),
            "a mechanical no-safe-target refusal must never be reported as a user decision"
        );
    }

    /// `originMismatch`'s denial reply may also carry the extension-reported origin as
    /// `fill.origin` (agent-access-architecture.md's "M5" wire section) — a best-effort,
    /// value-free pass-through of `fill_result`, distinct from the `message` string.
    #[test]
    fn origin_mismatch_denial_carries_fill_origin_passthrough_when_supplied() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::OriginMismatch),
            denial_detail: Some("https://evil.example".to_string()),
            fill_result: Some(r#"{"origin":"https://evil.example"}"#.to_string()),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        let value: serde_json::Value = serde_json::to_value(&outcome.response).unwrap();
        assert_eq!(value["fill"]["origin"], "https://evil.example");
    }

    #[test]
    fn fill_delivery_for_secret_resource_denies_safely() {
        // `validate` never actually constructs this combination (it rejects `delivery: "fill"`
        // for `ResourceKind::Secret` outright), but `build_response` must still degrade safely
        // rather than panic if it's ever reached some other way — mirrors the crate-wide
        // "never panic on a caller-controlled input" rule.
        let outcome = build_response(
            Ok(Ok(approving_secret_response())),
            ResourceKind::Secret,
            RequestOperation::Request,
            Some(DeliveryMode::Fill),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.secret.is_none());
    }

    // --- describeFillTarget response construction (M5) -----------------------------------------

    const FILL_TARGET_LITERAL: &str = r#"{"origin":"https://bitnotes.io","formClass":"login",
        "candidates":[{"role":"username","target":"input#email (login form)","visible":true,
        "frame":"top"}],"refusals":[],"targetToken":"ft_abc","expiresInMs":30000}"#;

    fn approving_describe_fill_target_response() -> CredentialResponseData {
        CredentialResponseData {
            approved: true,
            fill_target: Some(FILL_TARGET_LITERAL.to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn approved_describe_fill_target_carries_fill_target_passthrough_only() {
        let outcome = build_response(
            Ok(Ok(approving_describe_fill_target_response())),
            ResourceKind::Credential,
            RequestOperation::DescribeFillTarget,
            None,
        );
        assert_eq!(outcome.event_kind, "credential_approved");
        assert!(outcome.fields_shared.is_none());
        let value: serde_json::Value = serde_json::to_value(&outcome.response).unwrap();
        assert_eq!(value["status"], "approved");
        assert_eq!(value["fillTarget"]["origin"], "https://bitnotes.io");
        assert_eq!(value["fillTarget"]["targetToken"], "ft_abc");
        assert!(
            value.get("item").is_none(),
            "describeFillTarget touches no vault data — no item"
        );
        assert!(value.get("reference").is_none());
        assert!(value.get("credential").is_none());
        assert!(value.get("secret").is_none());
        assert!(value.get("fill").is_none());
    }

    #[test]
    fn approved_describe_fill_target_missing_fill_target_denies_safely() {
        let mut response = approving_describe_fill_target_response();
        response.fill_target = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::DescribeFillTarget,
            None,
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.fill_target.is_none());
    }

    #[test]
    fn approved_describe_fill_target_malformed_fill_target_denies_safely() {
        let mut response = approving_describe_fill_target_response();
        response.fill_target = Some("not json".to_string());
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::DescribeFillTarget,
            None,
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.fill_target.is_none());
    }

    // --- secret response construction -------------------------------------------------------

    #[test]
    fn approved_secret_inject_carries_value_and_reference_never_notes() {
        let outcome = build_response(
            Ok(Ok(approving_secret_response())),
            ResourceKind::Secret,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.event_kind, "credential_approved");
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(json.contains("\"status\":\"approved\""));
        assert!(json.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(json.contains("\"secret\""));
        assert!(json.contains("super-secret"));
        assert!(json.contains("DB_PASSWORD"));
        assert!(!json.contains("\"credential\""));
        assert!(!json.contains("\"item\""));
        assert!(
            !json.contains("do not leak me"),
            "notes must never appear in a local reply"
        );
        assert_eq!(outcome.fields_shared.as_deref(), Some("value"));
    }

    #[test]
    fn approved_secret_reference_strips_value_by_construction() {
        let outcome = build_response(
            Ok(Ok(approving_secret_response())),
            ResourceKind::Secret,
            RequestOperation::Request,
            Some(DeliveryMode::Reference),
        );
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(json.contains("\"status\":\"approved\""));
        assert!(json.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(json.contains("\"item\""));
        assert!(json.contains("DB_PASSWORD"));
        assert!(
            !json.contains("\"secret\""),
            "reference-mode replies must never carry a secret object"
        );
        assert!(
            !json.contains("\"value\""),
            "reference-mode replies must never carry a value key"
        );
        assert!(
            !json.contains("super-secret"),
            "the secret value must never appear in a reference-mode reply"
        );
        assert!(
            !json.contains("do not leak me"),
            "notes must never appear in a local reply"
        );
        // item.username is a credential-only concept and must be absent for secrets.
        assert!(!json.contains("\"username\""));
    }

    #[test]
    fn approved_secret_inject_missing_value_denies_safely() {
        let mut response = approving_secret_response();
        response.secret_value = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Secret,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.secret.is_none());
        assert!(outcome.response.reference.is_none());
    }

    #[test]
    fn approved_secret_inject_missing_id_denies_safely() {
        let mut response = approving_secret_response();
        response.secret_id = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Secret,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.secret.is_none());
        assert!(outcome.response.reference.is_none());
    }

    #[test]
    fn approved_secret_reference_missing_id_denies_safely() {
        let mut response = approving_secret_response();
        response.secret_id = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Secret,
            RequestOperation::Request,
            Some(DeliveryMode::Reference),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.item.is_none());
        assert!(outcome.response.reference.is_none());
    }

    // --- create response construction ---------------------------------------------------------

    fn approving_create_response() -> CredentialResponseData {
        CredentialResponseData {
            approved: true,
            item_name: Some("DB_PASSWORD".to_string()),
            secret_id: Some("secret-1".to_string()),
            // A handler must never actually populate these for a create, but if one did (a bug),
            // the create response builder must still never echo them — see
            // `approved_create_never_echoes_the_value_even_if_the_handler_returned_one` below.
            secret_value: Some(zeroize::Zeroizing::new("hunter2".to_string())),
            notes: Some("do not leak me".to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn approved_create_carries_reference_and_item_name_only() {
        let outcome = build_response(
            Ok(Ok(approving_create_response())),
            ResourceKind::Secret,
            RequestOperation::Create,
            None,
        );
        assert_eq!(outcome.event_kind, "credential_approved");
        assert_eq!(outcome.response.status, WireStatus::Approved);
        assert_eq!(
            outcome.response.reference.as_deref(),
            Some("bw://secret/secret-1")
        );
        let item = outcome.response.item.as_ref().unwrap();
        assert_eq!(item.name.as_deref(), Some("DB_PASSWORD"));
        assert!(item.username.is_none());
        assert!(outcome.response.secret.is_none());
        assert!(outcome.response.credential.is_none());
    }

    /// Nothing is released on a create, approved or not — `fields_shared` must be `None` even
    /// though the (misbehaving) handler in [`approving_create_response`] set `secret_value`.
    #[test]
    fn approved_create_reports_no_fields_shared() {
        let outcome = build_response(
            Ok(Ok(approving_create_response())),
            ResourceKind::Secret,
            RequestOperation::Create,
            None,
        );
        assert!(outcome.fields_shared.is_none());
    }

    #[test]
    fn approved_create_never_echoes_the_value_even_if_the_handler_returned_one() {
        let outcome = build_response(
            Ok(Ok(approving_create_response())),
            ResourceKind::Secret,
            RequestOperation::Create,
            None,
        );
        let json = serde_json::to_string(&outcome.response).unwrap();
        assert!(
            !json.contains("\"value\""),
            "a create response must never carry a value key"
        );
        assert!(
            !json.contains("\"secret\""),
            "a create response must never carry a secret object"
        );
        assert!(
            !json.contains("hunter2"),
            "the created value must never be echoed back"
        );
        assert!(
            !json.contains("do not leak me"),
            "notes must never appear in a local reply"
        );
    }

    #[test]
    fn approved_create_missing_secret_id_denies_safely() {
        let mut response = approving_create_response();
        response.secret_id = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Secret,
            RequestOperation::Create,
            None,
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.reference.is_none());
        assert!(outcome.response.item.is_none());
    }

    #[test]
    fn approved_create_missing_item_name_denies_safely() {
        let mut response = approving_create_response();
        response.item_name = None;
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Secret,
            RequestOperation::Create,
            None,
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert!(outcome.response.reference.is_none());
        assert!(outcome.response.item.is_none());
    }

    /// Wire round-trip against the exact response literal from agent-access-architecture.md's
    /// "M4b — secret creation" section: `{"version":1,"status":"approved",
    /// "reference":"bw://secret/<uuid>","item":{"name":"DB_PASSWORD"}}` — no `secretId`/
    /// `itemName` response fields exist on the wire; the client derives the id from the
    /// reference via `strip_secret_reference`.
    #[test]
    fn approved_create_response_matches_the_contract_literal_shape() {
        let outcome = build_response(
            Ok(Ok(approving_create_response())),
            ResourceKind::Secret,
            RequestOperation::Create,
            None,
        );
        let value: serde_json::Value = serde_json::to_value(&outcome.response).unwrap();
        assert_eq!(value["version"], 1);
        assert_eq!(value["status"], "approved");
        assert_eq!(value["reference"], "bw://secret/secret-1");
        assert_eq!(value["item"]["name"], "DB_PASSWORD");
        assert!(value.get("secret").is_none());
        assert!(value.get("credential").is_none());
        assert!(value["item"].get("username").is_none());
    }

    #[test]
    fn fields_shared_list_secret_arm_reports_value_only() {
        assert_eq!(
            fields_shared_list(
                &approving_secret_response(),
                ResourceKind::Secret,
                DeliveryMode::Inject
            ),
            Some("value".to_string())
        );

        let mut without_value = approving_secret_response();
        without_value.secret_value = None;
        assert_eq!(
            fields_shared_list(&without_value, ResourceKind::Secret, DeliveryMode::Inject),
            None
        );
    }

    #[test]
    fn not_found_reason_maps_to_not_found_status() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::NotFound),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::NotFound);
        assert_eq!(outcome.event_kind, "credential_not_found");
        assert!(outcome.fields_shared.is_none());
    }

    #[test]
    fn denied_reason_maps_to_denied_status() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::Denied),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Denied);
        assert_eq!(outcome.event_kind, "credential_denied");
    }

    #[test]
    fn locked_reason_maps_to_locked_status_with_an_honest_message() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::Locked),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Locked);
        assert_eq!(outcome.response.message.as_deref(), Some("Vault is locked"));
        assert_ne!(
            outcome.response.message.as_deref(),
            Some("Denied by user"),
            "a locked vault must never be reported as a user decision"
        );
    }

    #[test]
    fn internal_reason_falls_back_to_a_generic_message_when_no_denial_detail() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::Internal),
            denial_detail: None,
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert_eq!(
            outcome.response.message.as_deref(),
            Some("Request could not be completed")
        );
        assert_ne!(
            outcome.response.message.as_deref(),
            Some("Denied by user"),
            "a non-user failure must never be reported as a user decision"
        );
    }

    /// The finding this closes: a precise, actionable `denial_detail` computed by the TS host
    /// (e.g. for a browser-fill request whose extension isn't connected) was being discarded in
    /// favor of the generic string above, leaving the user with no idea what to do.
    #[test]
    fn internal_reason_passes_through_denial_detail_when_present() {
        let response = CredentialResponseData {
            approved: false,
            reason: Some(CredentialDenialReason::Internal),
            denial_detail: Some(
                "The Bitwarden browser extension is not connected. Open a browser with the \
                 Bitwarden extension installed and connected to the desktop app, then retry."
                    .to_string(),
            ),
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert_eq!(
            outcome.response.message.as_deref(),
            Some(
                "The Bitwarden browser extension is not connected. Open a browser with the \
                 Bitwarden extension installed and connected to the desktop app, then retry."
            )
        );
        assert_ne!(
            outcome.response.message.as_deref(),
            Some("Request could not be completed"),
            "an actionable detail must not be discarded in favor of the generic message"
        );
    }

    #[test]
    fn no_reason_defaults_to_denied_status() {
        let response = CredentialResponseData {
            approved: false,
            reason: None,
            ..Default::default()
        };
        let outcome = build_response(
            Ok(Ok(response)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Denied);
    }

    #[test]
    fn callback_error_maps_to_generic_error_status() {
        let outcome = build_response(
            Ok(Err(CallbackError::Failed)),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Error);
        assert_eq!(outcome.response.message.as_deref(), Some("Request failed"));
    }

    #[test]
    fn timeout_maps_to_timeout_status() {
        // `tokio::time::error::Elapsed` has no public constructor; exercise the timeout branch
        // through a real timeout instead of trying to fabricate one.
        let elapsed = futures_timeout_error();
        let outcome = build_response(
            Err(elapsed),
            ResourceKind::Credential,
            RequestOperation::Request,
            Some(DeliveryMode::Inject),
        );
        assert_eq!(outcome.response.status, WireStatus::Timeout);
    }

    fn futures_timeout_error() -> tokio::time::error::Elapsed {
        // A zero-duration timeout against a pending future always elapses immediately.
        let handle = tokio::runtime::Builder::new_current_thread()
            .enable_time()
            .build()
            .unwrap();
        handle.block_on(async {
            tokio::time::timeout(
                std::time::Duration::from_millis(0),
                std::future::pending::<()>(),
            )
            .await
            .unwrap_err()
        })
    }
}
