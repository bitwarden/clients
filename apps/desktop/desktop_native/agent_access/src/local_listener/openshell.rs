//! The OpenShell half of "Local wire protocol v1" (agent-access-architecture.md, §M8.4–§M8.5):
//! the `openshellResolve` / `openshellHello` ops, which exist only on the separate, toggle-gated
//! OpenShell socket (`ListenerKind::OpenShell`).
//!
//! This module owns four things, each a pure function so it can be tested without a socket:
//! - [`validate_resolve`] / [`validate_hello`]: the §M8.4 field table. Over-length input is
//!   rejected, never truncated, and every rejection message is static and value-free.
//! - [`precheck_attestation`]: the §M8.5 attestation precheck. It can only deny.
//! - [`OpenShellLimiter`]: one in-flight request per provider, plus a 60 s cooldown after a denial
//!   or timeout for the same `(sandbox, provider)` pair.
//! - [`build_reply`]: the approved / denied / error reply, with the approved payload checked
//!   against the requested targets and the lifetime window before a single value is written.
//!
//! Nothing here performs cryptography and nothing here caches a value: a released value lives
//! only in the [`CredentialResponseData`] the handler returned and in the reply bytes, both of
//! which are zeroized when they drop.

use std::{
    collections::{HashMap, HashSet},
    path::Path,
    sync::{Arc, Mutex},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tokio::time::Instant;
use zeroize::Zeroizing;

use super::local_protocol::{WireClientInfo, WireRequest, WireStatus, VERSION};
use crate::{
    callbacks::{
        CallbackError, CredentialDenialReason, CredentialResponseData, OpenShellContext,
        OpenShellEndpoint, OpenShellEndpointSource, OpenShellLifetimeMode, ProviderField,
        ProviderTarget, ResourceKind,
    },
    peer_info::LocalPeerInfo,
};

pub(super) const OP_RESOLVE: &str = "openshellResolve";
pub(super) const OP_HELLO: &str = "openshellHello";

/// Every op that is only valid on the OpenShell socket.
pub(super) fn is_openshell_op(op: &str) -> bool {
    op == OP_RESOLVE || op == OP_HELLO
}

pub(super) const MSG_OP_NOT_AVAILABLE: &str = "operation not available on this socket";
pub(super) const MSG_NOT_VERIFIED: &str = "OpenShell gateway could not be verified";
pub(super) const MSG_INVALID_APPROVAL: &str = "invalid approval payload";
const MSG_NO_ENDPOINTS: &str = "openshell credential has no bound endpoints";
const MSG_MALFORMED: &str = "malformed openshell request";

/// §M8.4 / §M8.18: `deadlineMs` range. The floor is 2 s, not 5 s: a short-deadline retry is still
/// worth sending, because the renderer can answer it at once from a carried or just-delivered
/// decision for the identical request (it never opens a new dialog with under 3 s left).
const DEADLINE_MS_MIN: u64 = 2_000;
const DEADLINE_MS_MAX: u64 = 28_000;
const MAX_ENDPOINTS: usize = 64;
const MAX_TARGETS: usize = 16;
const MAX_VALUE_BYTES: usize = 16_384;
/// §M8.4 reply-builder lifetime bounds.
const PER_REQUEST_MAX_MS: u64 = 125_000;
const TTL_MIN_MS: u64 = 30_000;
const TTL_MAX_MS: u64 = 86_400_000 + 5_000;
/// §M8.5: how long a `(sandbox, provider)` pair is refused after a denial or timeout.
pub(super) const DENY_COOLDOWN: Duration = Duration::from_secs(60);

// ---------------------------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------------------------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireResolve {
    deadline_ms: u64,
    gateway: WireGateway,
    provider: WireProvider,
    sandbox: WireSandbox,
    endpoints: Vec<WireEndpoint>,
    policy: WirePolicy,
    targets: Vec<WireProviderTarget>,
}

#[derive(Deserialize)]
struct WireGateway {
    name: String,
    endpoint: String,
}

#[derive(Deserialize)]
struct WireProvider {
    id: String,
    name: String,
    profile: String,
    workspace: String,
}

#[derive(Deserialize)]
struct WireSandbox {
    id: String,
    name: String,
    #[serde(default)]
    image: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum WireEndpointSource {
    Profile,
    PolicyBinding,
}

#[derive(Deserialize)]
struct WireEndpoint {
    host: String,
    port: u64,
    #[serde(default)]
    path: Option<String>,
    source: WireEndpointSource,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WirePolicy {
    digest: String,
    #[serde(default)]
    advisor_enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WireProviderTarget {
    credential_key: String,
    resource: String,
    id: String,
    field: String,
}

/// A validated `openshellResolve`, ready to become a `CredentialRequestData`.
pub(super) struct ValidatedResolve {
    pub(super) context: OpenShellContext,
    pub(super) targets: Vec<ProviderTarget>,
    pub(super) client: Option<WireClientInfo>,
}

/// A validated `openshellHello`. Only the gateway is carried, and only for diagnostics.
pub(super) struct ValidatedHello {
    pub(super) client: Option<WireClientInfo>,
}

/// UTF-8 is guaranteed by `serde_json`; this checks the byte-length bounds and the
/// "no control characters" rule that applies to every string in §M8.4.
fn bounded(value: &str, min: usize, max: usize) -> bool {
    (min..=max).contains(&value.len()) && !value.chars().any(char::is_control)
}

fn charset(value: &str, allowed: impl Fn(char) -> bool) -> bool {
    value.chars().all(allowed)
}

/// `^[A-Za-z0-9._-]+$`, 1..=64 bytes.
fn valid_gateway_name(value: &str) -> bool {
    bounded(value, 1, 64)
        && charset(value, |c| {
            c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-')
        })
}

/// ≤ 256 bytes, `https://` or `http://` prefix. Display and grant key only — never dialled.
fn valid_gateway_endpoint(value: &str) -> bool {
    bounded(value, 1, 256)
        && (value.starts_with("https://") || value.starts_with("http://"))
        && !value.contains(char::is_whitespace)
}

/// `^[A-Za-z0-9._:-]+$`, 1..=128 bytes (provider and sandbox ids).
fn valid_opaque_id(value: &str) -> bool {
    bounded(value, 1, 128)
        && charset(value, |c| {
            c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | ':' | '-')
        })
}

/// `^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$`, 1..=253 bytes.
/// Uppercase is rejected (aac lowercases), and so is every IPv6 literal (a `:` is never allowed).
fn valid_host(value: &str) -> bool {
    if !bounded(value, 1, 253) {
        return false;
    }
    let rest = value.strip_prefix("*.").unwrap_or(value);
    !rest.is_empty()
        && rest.split('.').all(|label| {
            !label.is_empty()
                && !label.starts_with('-')
                && !label.ends_with('-')
                && charset(label, |c| {
                    c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'
                })
        })
}

/// `^sha256:[0-9a-f]{64}$`.
pub(super) fn valid_policy_digest(value: &str) -> bool {
    value
        .strip_prefix("sha256:")
        .is_some_and(|hex| hex.len() == 64 && charset(hex, |c| matches!(c, '0'..='9' | 'a'..='f')))
}

/// `^[A-Za-z_][A-Za-z0-9_]{0,127}$`.
fn valid_credential_key(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    value.len() <= 128
        && (first.is_ascii_alphabetic() || first == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Lowercase UUID: `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`.
fn valid_lowercase_uuid(value: &str) -> bool {
    let groups: Vec<&str> = value.split('-').collect();
    groups.len() == 5
        && groups
            .iter()
            .zip([8usize, 4, 4, 4, 12])
            .all(|(group, len)| {
                group.len() == len && charset(group, |c| matches!(c, '0'..='9' | 'a'..='f'))
            })
}

/// §M8.4: every op on the OpenShell socket rejects the other ops' objects instead of ignoring
/// them, the same "an ignored field hides a client bug" rule as the agent socket.
fn reject_foreign_objects(request: &WireRequest) -> Result<(), &'static str> {
    if request.query.is_some() {
        return Err("query is not valid for this operation");
    }
    if request.delivery.is_some() {
        return Err("delivery is not valid for this operation");
    }
    if request.create.is_some() {
        return Err("create object is not valid for this operation");
    }
    if request.update.is_some() {
        return Err("update object is not valid for this operation");
    }
    if request.target.is_some() {
        return Err("target object is not valid for this operation");
    }
    if request.fill.is_some() {
        return Err("fill object is not valid for this operation");
    }
    if request.generate.is_some() {
        return Err("generate object is not valid for this operation");
    }
    // M7's `projectSecretsRequest` selector — an agent-socket-only bulk read, never part of an
    // OpenShell resolve or hello.
    if request.project.is_some() {
        return Err("project object is not valid for this operation");
    }
    Ok(())
}

/// Validates an `openshellResolve` per the §M8.4 field table. Never panics, never truncates.
pub(super) fn validate_resolve(request: WireRequest) -> Result<ValidatedResolve, &'static str> {
    if request.version != VERSION {
        return Err("unsupported protocol version");
    }
    if request.op != OP_RESOLVE {
        return Err(MSG_OP_NOT_AVAILABLE);
    }
    reject_foreign_objects(&request)?;
    let raw = request.openshell.ok_or("missing openshell object")?;
    let wire: WireResolve = serde_json::from_value(raw).map_err(|_| MSG_MALFORMED)?;

    if !(DEADLINE_MS_MIN..=DEADLINE_MS_MAX).contains(&wire.deadline_ms) {
        return Err("openshell.deadlineMs is out of range");
    }
    if !valid_gateway_name(&wire.gateway.name) {
        return Err("openshell.gateway.name is invalid");
    }
    if !valid_gateway_endpoint(&wire.gateway.endpoint) {
        return Err("openshell.gateway.endpoint is invalid");
    }
    if !valid_opaque_id(&wire.provider.id) {
        return Err("openshell.provider.id is invalid");
    }
    if !bounded(&wire.provider.name, 1, 128) {
        return Err("openshell.provider.name is invalid");
    }
    if !bounded(&wire.provider.profile, 0, 128) {
        return Err("openshell.provider.profile is invalid");
    }
    if !bounded(&wire.provider.workspace, 0, 128) {
        return Err("openshell.provider.workspace is invalid");
    }
    if !valid_opaque_id(&wire.sandbox.id) {
        return Err("openshell.sandbox.id is invalid");
    }
    if !bounded(&wire.sandbox.name, 0, 128) {
        return Err("openshell.sandbox.name is invalid");
    }
    if let Some(image) = &wire.sandbox.image {
        if !bounded(image, 0, 512) {
            return Err("openshell.sandbox.image is invalid");
        }
    }

    if wire.endpoints.is_empty() {
        return Err(MSG_NO_ENDPOINTS);
    }
    if wire.endpoints.len() > MAX_ENDPOINTS {
        return Err("openshell.endpoints has too many entries");
    }
    let mut endpoints = Vec::with_capacity(wire.endpoints.len());
    let mut seen_endpoints: HashSet<(String, u16, Option<String>)> = HashSet::new();
    for endpoint in wire.endpoints {
        if !valid_host(&endpoint.host) {
            return Err("openshell.endpoints[].host is invalid");
        }
        let port = u16::try_from(endpoint.port)
            .ok()
            .filter(|port| *port >= 1)
            .ok_or("openshell.endpoints[].port is out of range")?;
        if let Some(path) = &endpoint.path {
            if !bounded(path, 0, 512) {
                return Err("openshell.endpoints[].path is invalid");
            }
        }
        if !seen_endpoints.insert((endpoint.host.clone(), port, endpoint.path.clone())) {
            return Err("openshell.endpoints has a duplicate entry");
        }
        endpoints.push(OpenShellEndpoint {
            host: endpoint.host,
            port,
            path: endpoint.path,
            source: match endpoint.source {
                WireEndpointSource::Profile => OpenShellEndpointSource::Profile,
                WireEndpointSource::PolicyBinding => OpenShellEndpointSource::PolicyBinding,
            },
        });
    }

    if !valid_policy_digest(&wire.policy.digest) {
        return Err("openshell.policy.digest is invalid");
    }

    if wire.targets.is_empty() || wire.targets.len() > MAX_TARGETS {
        return Err("openshell.targets must have 1 to 16 entries");
    }
    let mut targets = Vec::with_capacity(wire.targets.len());
    let mut seen_keys: HashSet<String> = HashSet::new();
    for target in wire.targets {
        if !valid_credential_key(&target.credential_key) {
            return Err("openshell.targets[].credentialKey is invalid");
        }
        if !seen_keys.insert(target.credential_key.clone()) {
            return Err("openshell.targets has a duplicate credentialKey");
        }
        if !valid_lowercase_uuid(&target.id) {
            return Err("openshell.targets[].id is invalid");
        }
        let (resource, field) = match (target.resource.as_str(), target.field.as_str()) {
            ("item", "username") => (ResourceKind::Credential, ProviderField::Username),
            ("item", "password") => (ResourceKind::Credential, ProviderField::Password),
            ("secret", "value") => (ResourceKind::Secret, ProviderField::Value),
            ("item", _) | ("secret", _) => {
                return Err("openshell.targets[].field is not valid for its resource");
            }
            _ => return Err("openshell.targets[].resource is invalid"),
        };
        targets.push(ProviderTarget {
            credential_key: target.credential_key,
            resource,
            id: target.id,
            field,
        });
    }

    Ok(ValidatedResolve {
        context: OpenShellContext {
            deadline: Duration::from_millis(wire.deadline_ms),
            gateway_name: wire.gateway.name,
            gateway_endpoint: wire.gateway.endpoint,
            provider_id: wire.provider.id,
            provider_name: wire.provider.name,
            provider_profile: wire.provider.profile,
            workspace: wire.provider.workspace,
            sandbox_id: wire.sandbox.id,
            sandbox_name: wire.sandbox.name,
            sandbox_image: wire.sandbox.image,
            endpoints,
            policy_digest: wire.policy.digest,
            advisor_enabled: wire.policy.advisor_enabled,
        },
        targets,
        client: request.client,
    })
}

/// Validates an `openshellHello`: `openshell` may contain only a valid `gateway`.
pub(super) fn validate_hello(request: WireRequest) -> Result<ValidatedHello, &'static str> {
    if request.version != VERSION {
        return Err("unsupported protocol version");
    }
    if request.op != OP_HELLO {
        return Err(MSG_OP_NOT_AVAILABLE);
    }
    reject_foreign_objects(&request)?;
    let raw = request.openshell.ok_or("missing openshell object")?;
    let object = raw.as_object().ok_or(MSG_MALFORMED)?;
    if object.len() != 1 || !object.contains_key("gateway") {
        return Err("openshell object for openshellHello may contain only gateway");
    }
    let gateway: WireGateway =
        serde_json::from_value(object["gateway"].clone()).map_err(|_| MSG_MALFORMED)?;
    if !valid_gateway_name(&gateway.name) {
        return Err("openshell.gateway.name is invalid");
    }
    if !valid_gateway_endpoint(&gateway.endpoint) {
        return Err("openshell.gateway.endpoint is invalid");
    }
    Ok(ValidatedHello {
        client: request.client,
    })
}

// ---------------------------------------------------------------------------------------------
// Attestation precheck (§M8.5)
// ---------------------------------------------------------------------------------------------

/// The canonical file name of `path`: `canonicalize` when the file still exists (resolving any
/// symlink the OS reported), else the reported path as-is. `None` when there is no file name.
fn canonical_file_name(path: &str) -> Option<String> {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| Path::new(path).to_path_buf());
    canonical
        .file_name()
        .and_then(|name| name.to_str())
        .map(str::to_string)
}

/// §M8.5 attestation precheck. Runs after `attest_peer`, before dispatch, and can only deny:
/// 1. the peer's executable is exactly `aac`, or exactly one of the dev-build artifact names in
///    [`AAC_EXECUTABLE_NAMES`] (§M8.18);
/// 2. its parent is resolved and its executable is exactly `openshell-gateway` (no fallback to
///    aac's own identity);
/// 3. the attested signature (of that parent, per `crate::attestation::attest`) is present.
///
/// A driver started any other way (launchd, systemd, a shell) has the wrong parent and fails
/// closed. Passing this proves nothing beyond "the requester looks like the gateway's driver";
/// the human approval stays the boundary.
/// §M8.5 / §M8.18: the only accepted canonical file names for the driver. `aac` is what packaging
/// ships (`Contents/MacOS/aac` on macOS; the Linux copy-out at `<userData>/bin/aac`). The others
/// are the exact `desktop_native/build.js` artifact names
/// (`dist/aac.<platform>-<nodeArch>`) that an unpackaged dev build's `gateway.toml` snippet points
/// at. A strict allowlist: no prefix, suffix or glob matching (`aac-evil`, `aac.darwin-arm64.bak`
/// and `aac.exe` all fail).
pub(super) const AAC_EXECUTABLE_NAMES: [&str; 5] = [
    "aac",
    "aac.darwin-arm64",
    "aac.darwin-x64",
    "aac.linux-x64",
    "aac.linux-arm64",
];

pub(super) fn precheck_attestation(peer: Option<&LocalPeerInfo>) -> bool {
    let Some(peer) = peer else {
        return false;
    };
    let peer_is_aac = peer
        .exe_path
        .as_deref()
        .and_then(canonical_file_name)
        .is_some_and(|name| AAC_EXECUTABLE_NAMES.contains(&name.as_str()));
    let parent_is_gateway = peer
        .parent
        .as_ref()
        .and_then(|parent| parent.exe_path.as_deref())
        .and_then(canonical_file_name)
        .is_some_and(|name| name == "openshell-gateway");
    peer_is_aac && parent_is_gateway && peer.signature.is_some()
}

// ---------------------------------------------------------------------------------------------
// Rate limiting (§M8.5)
// ---------------------------------------------------------------------------------------------

/// How many requests with the *identical* coalescing key ([`coalescing_key`]) may wait for the
/// same approval at once (§M8.18). aac serializes its own resolves, so more than one in flight
/// only happens in the short window between aac dropping a cancelled request and this listener
/// noticing the hang-up; the cap just bounds it.
pub(super) const MAX_COALESCED_IN_FLIGHT: usize = 4;

/// §M8.18: the identity of a resolve for coalescing. Every gateway-reported field the dialog shows
/// plus the sorted target set; any difference means a different request. Built from validated
/// fields only (no control characters), joined with `\u{1f}` (unit separator), which none of them
/// may contain.
pub(super) fn coalescing_key(context: &OpenShellContext, targets: &[ProviderTarget]) -> String {
    let mut target_parts: Vec<String> = targets
        .iter()
        .map(|target| {
            format!(
                "{}|{:?}|{}|{:?}",
                target.credential_key, target.resource, target.id, target.field
            )
        })
        .collect();
    target_parts.sort();
    [
        context.gateway_name.as_str(),
        context.gateway_endpoint.as_str(),
        context.sandbox_id.as_str(),
        context.provider_id.as_str(),
        context.policy_digest.as_str(),
        &target_parts.join(","),
    ]
    .join("\u{1f}")
}

struct InFlightEntry {
    key: String,
    count: usize,
}

/// Per-listener OpenShell request limiter (§M8.5, amended by §M8.18):
/// - per `provider.id`, only requests with one identical coalescing key may be in flight (up to
///   [`MAX_COALESCED_IN_FLIGHT`]), so a supervisor retry can reach the renderer and attach to the
///   dialog that is already open, while any *different* request for that provider is refused;
/// - a cooldown after a user denial (or a dispatch the renderer never answered) for a
///   `(sandbox.id, provider.id)` pair, so retries can't spam dialogs.
///
/// Uses `tokio::time::Instant` so tests can drive it with paused time.
#[derive(Default)]
pub(super) struct OpenShellLimiter {
    in_flight: Mutex<HashMap<String, InFlightEntry>>,
    cooldown: Mutex<HashMap<(String, String), Instant>>,
}

/// Why [`OpenShellLimiter::try_begin`] refused a request.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum LimitRefusal {
    InFlight,
    CoolingDown,
}

/// Releases a provider's in-flight slot on drop, so an aborted connection task (`stop()`, or a
/// peer hang-up) never leaves a provider locked out.
pub(super) struct InFlightGuard {
    limiter: Arc<OpenShellLimiter>,
    provider_id: String,
}

impl Drop for InFlightGuard {
    fn drop(&mut self) {
        if let Ok(mut in_flight) = self.limiter.in_flight.lock() {
            if let Some(entry) = in_flight.get_mut(&self.provider_id) {
                entry.count = entry.count.saturating_sub(1);
                if entry.count == 0 {
                    in_flight.remove(&self.provider_id);
                }
            }
        }
    }
}

impl OpenShellLimiter {
    pub(super) fn try_begin(
        self: &Arc<Self>,
        sandbox_id: &str,
        provider_id: &str,
        key: &str,
    ) -> Result<InFlightGuard, LimitRefusal> {
        {
            let mut cooldown = self
                .cooldown
                .lock()
                .map_err(|_| LimitRefusal::CoolingDown)?;
            let now = Instant::now();
            cooldown.retain(|_, until| *until > now);
            if cooldown.contains_key(&(sandbox_id.to_string(), provider_id.to_string())) {
                return Err(LimitRefusal::CoolingDown);
            }
        }
        let mut in_flight = self.in_flight.lock().map_err(|_| LimitRefusal::InFlight)?;
        match in_flight.get_mut(provider_id) {
            Some(entry) if entry.key == key && entry.count < MAX_COALESCED_IN_FLIGHT => {
                entry.count += 1;
            }
            Some(_) => return Err(LimitRefusal::InFlight),
            None => {
                in_flight.insert(
                    provider_id.to_string(),
                    InFlightEntry {
                        key: key.to_string(),
                        count: 1,
                    },
                );
            }
        }
        Ok(InFlightGuard {
            limiter: Arc::clone(self),
            provider_id: provider_id.to_string(),
        })
    }

    /// Starts the cooldown for `(sandbox_id, provider_id)` after a denial, or after a dispatch
    /// the renderer never answered.
    pub(super) fn start_cooldown(&self, sandbox_id: &str, provider_id: &str) {
        if let Ok(mut cooldown) = self.cooldown.lock() {
            cooldown.insert(
                (sandbox_id.to_string(), provider_id.to_string()),
                Instant::now() + DENY_COOLDOWN,
            );
        }
    }
}

// ---------------------------------------------------------------------------------------------
// Reply
// ---------------------------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
enum WireLifetimeMode {
    PerRequest,
    Ttl,
    SandboxLifetime,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireLifetime {
    mode: WireLifetimeMode,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_at_ms: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireProviderValue<'a> {
    credential_key: &'a str,
    value: &'a str,
}

#[derive(Serialize)]
struct WireApproved<'a> {
    lifetime: WireLifetime,
    values: Vec<WireProviderValue<'a>>,
}

/// The only reply shape the OpenShell socket writes. Key order is `version, status, openshell,
/// message` — exactly the §M8.4 / §M8.11 order (an approved reply never has `message`, any other
/// reply never has `openshell`). Never `Debug`: it may borrow released values.
#[derive(Serialize)]
struct OpenShellWireResponse<'a> {
    version: u32,
    status: WireStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    openshell: Option<WireApproved<'a>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<&'a str>,
}

/// A serialized reply line (trailing `\n` included), plus what it means for the activity event
/// and the deny cooldown. `bytes` is zeroized on drop: an approved line carries values.
pub(super) struct OpenShellReply {
    pub(super) bytes: Zeroizing<Vec<u8>>,
    pub(super) status: WireStatus,
    pub(super) event_kind: &'static str,
    /// Whether this outcome starts the §M8.5 cooldown: a denial, or a dispatch the renderer never
    /// answered (Rust's own timeout). A renderer-reported `timeout` does **not** (§M8.18): it
    /// means only that this request's deadline passed, while the approval dialog may still be
    /// open for the supervisor's next retry to attach to.
    cooldown: bool,
}

impl OpenShellReply {
    /// Whether this outcome starts the §M8.5 deny cooldown.
    pub(super) fn starts_cooldown(&self) -> bool {
        self.cooldown
    }
}

fn serialize_line(response: &OpenShellWireResponse<'_>) -> Zeroizing<Vec<u8>> {
    // Serializing our own well-typed struct never fails; an empty line on the impossible path is
    // still a fail-closed reply (the client treats it as malformed).
    let mut bytes = Zeroizing::new(serde_json::to_vec(response).unwrap_or_default());
    bytes.push(b'\n');
    bytes
}

/// `{"version":1,"status":"approved"}` for a hello that passed the precheck.
pub(super) fn hello_reply() -> OpenShellReply {
    OpenShellReply {
        bytes: serialize_line(&OpenShellWireResponse {
            version: VERSION,
            status: WireStatus::Approved,
            openshell: None,
            message: None,
        }),
        status: WireStatus::Approved,
        event_kind: "openshellDriverSeen",
        cooldown: false,
    }
}

/// Checks the approved payload (§M8.4 "Before writing an approved reply") and returns the
/// lifetime to send, or `None` when anything is off.
fn checked_lifetime(
    response: &CredentialResponseData,
    targets: &[ProviderTarget],
    now_ms: u64,
) -> Option<WireLifetime> {
    let resolution = response.openshell.as_ref()?;
    if resolution.values.len() != targets.len() {
        return None;
    }
    // Target keys are unique (validated), so an exact, in-order key match rules out a missing,
    // extra, duplicated or reordered value in one pass.
    let keys_match = resolution
        .values
        .iter()
        .zip(targets)
        .all(|(value, target)| value.credential_key == target.credential_key);
    let values_ok = resolution.values.iter().all(|value| {
        (1..=MAX_VALUE_BYTES).contains(&value.value.len()) && !value.value.contains('\0')
    });
    if !keys_match || !values_ok {
        return None;
    }
    let lifetime = resolution.lifetime;
    let expires = lifetime.expires_at_ms;
    match lifetime.mode {
        OpenShellLifetimeMode::PerRequest => {
            let at = expires?;
            (now_ms < at && at <= now_ms.saturating_add(PER_REQUEST_MAX_MS)).then_some(
                WireLifetime {
                    mode: WireLifetimeMode::PerRequest,
                    expires_at_ms: Some(at),
                },
            )
        }
        OpenShellLifetimeMode::Ttl => {
            let at = expires?;
            (now_ms.saturating_add(TTL_MIN_MS) <= at && at <= now_ms.saturating_add(TTL_MAX_MS))
                .then_some(WireLifetime {
                    mode: WireLifetimeMode::Ttl,
                    expires_at_ms: Some(at),
                })
        }
        OpenShellLifetimeMode::SandboxLifetime => expires.is_none().then_some(WireLifetime {
            mode: WireLifetimeMode::SandboxLifetime,
            expires_at_ms: None,
        }),
    }
}

/// Upper bound on a handler-supplied `denial_detail` relayed to aac. The renderer only ever
/// sends short static strings; anything longer or with control characters is replaced.
const MAX_DETAIL_BYTES: usize = 256;

fn safe_detail<'a>(detail: Option<&'a str>, fallback: &'a str) -> &'a str {
    detail
        .filter(|d| bounded(d, 1, MAX_DETAIL_BYTES))
        .unwrap_or(fallback)
}

/// Maps the handler outcome for an `openshellResolve` onto the single reply line (§M8.4).
/// Deny-by-default: anything but a fully checked approval is a non-approved reply, and a failed
/// approval check writes `invalid approval payload` — the values are dropped (and zeroized)
/// with `response` without ever being serialized.
pub(super) fn build_reply(
    outcome: Result<Result<CredentialResponseData, CallbackError>, tokio::time::error::Elapsed>,
    targets: &[ProviderTarget],
    now_ms: u64,
) -> OpenShellReply {
    match outcome {
        Ok(Ok(response)) if response.approved => {
            let Some(lifetime) = checked_lifetime(&response, targets, now_ms) else {
                return error_reply(MSG_INVALID_APPROVAL);
            };
            let Some(resolution) = response.openshell.as_ref() else {
                return error_reply(MSG_INVALID_APPROVAL);
            };
            let values = resolution
                .values
                .iter()
                .map(|value| WireProviderValue {
                    credential_key: value.credential_key.as_str(),
                    value: value.value.as_str(),
                })
                .collect();
            let bytes = serialize_line(&OpenShellWireResponse {
                version: VERSION,
                status: WireStatus::Approved,
                openshell: Some(WireApproved { lifetime, values }),
                message: None,
            });
            OpenShellReply {
                bytes,
                status: WireStatus::Approved,
                event_kind: "credential_approved",
                cooldown: false,
            }
        }
        Ok(Ok(response)) => {
            let detail = response.denial_detail.as_deref();
            match response.reason {
                Some(CredentialDenialReason::NotFound) => {
                    reply_with(WireStatus::NotFound, "No matching item found")
                }
                Some(CredentialDenialReason::Locked) => {
                    reply_with(WireStatus::Locked, "Vault is locked")
                }
                Some(CredentialDenialReason::Timeout) => {
                    reply_with(WireStatus::Timeout, "Request timed out")
                }
                Some(CredentialDenialReason::Internal) => reply_with(
                    WireStatus::Error,
                    safe_detail(detail, "Request could not be completed"),
                ),
                // Fill-only reasons have no meaning here; never report them as a user decision.
                Some(CredentialDenialReason::OriginMismatch)
                | Some(CredentialDenialReason::NoSafeTarget) => {
                    reply_with(WireStatus::Error, "Request could not be completed")
                }
                Some(CredentialDenialReason::Denied) | None => {
                    reply_with(WireStatus::Denied, safe_detail(detail, "Denied by user"))
                        .with_cooldown()
                }
            }
        }
        Ok(Err(_)) => reply_with(WireStatus::Error, "Request failed"),
        // The renderer never answered within the dispatch timeout: cool the pair down.
        Err(_) => reply_with(WireStatus::Timeout, "Request timed out").with_cooldown(),
    }
}

impl OpenShellReply {
    fn with_cooldown(mut self) -> Self {
        self.cooldown = true;
        self
    }
}

/// A non-approved reply with a value-free `message`.
pub(super) fn reply_with(status: WireStatus, message: &str) -> OpenShellReply {
    let event_kind = match status {
        WireStatus::NotFound => "credential_not_found",
        _ => "credential_denied",
    };
    let bytes = serialize_line(&OpenShellWireResponse {
        version: VERSION,
        status,
        openshell: None,
        message: Some(message),
    });
    OpenShellReply {
        bytes,
        status,
        event_kind,
        cooldown: false,
    }
}

pub(super) fn error_reply(message: &str) -> OpenShellReply {
    reply_with(WireStatus::Error, message)
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::*;
    use crate::{
        attestation::{ParentProcessInfo, SignatureInfo, SignatureKind},
        callbacks::{OpenShellLifetime, OpenShellResolution, ProviderValue},
    };

    const REQUEST_FIXTURE: &str =
        include_str!("../../tests/fixtures/openshell/openshell-resolve.request.json");
    const HELLO_FIXTURE: &str =
        include_str!("../../tests/fixtures/openshell/openshell-hello.request.json");
    const APPROVED_TTL_FIXTURE: &str =
        include_str!("../../tests/fixtures/openshell/openshell-resolve.approved-ttl.json");
    const APPROVED_SANDBOX_FIXTURE: &str = include_str!(
        "../../tests/fixtures/openshell/openshell-resolve.approved-sandbox-lifetime.json"
    );
    const DENIED_FIXTURE: &str =
        include_str!("../../tests/fixtures/openshell/openshell-resolve.denied.json");

    /// §M8.11: the test clock is pinned to `expiresAtMs − 3 600 000`.
    const PINNED_NOW_MS: u64 = 1_791_230_967_890;
    const FIXTURE_EXPIRES_AT_MS: u64 = 1_791_234_567_890;

    fn fixture_json() -> Value {
        serde_json::from_str(REQUEST_FIXTURE).unwrap()
    }

    fn parse(value: Value) -> WireRequest {
        serde_json::from_value(value).unwrap()
    }

    fn validate_mutated(mutate: impl FnOnce(&mut Value)) -> Result<ValidatedResolve, &'static str> {
        let mut value = fixture_json();
        mutate(&mut value);
        validate_resolve(parse(value))
    }

    fn assert_rejected(mutate: impl FnOnce(&mut Value)) -> &'static str {
        match validate_mutated(mutate) {
            Ok(_) => panic!("expected the request to be rejected"),
            Err(message) => message,
        }
    }

    fn fixture_targets() -> Vec<ProviderTarget> {
        validate_resolve(parse(fixture_json())).unwrap().targets
    }

    fn approved(lifetime: OpenShellLifetime, values: &[(&str, &str)]) -> CredentialResponseData {
        CredentialResponseData {
            approved: true,
            openshell: Some(OpenShellResolution {
                lifetime,
                values: values
                    .iter()
                    .map(|(key, value)| ProviderValue {
                        credential_key: (*key).to_string(),
                        value: Zeroizing::new((*value).to_string()),
                    })
                    .collect(),
            }),
            ..Default::default()
        }
    }

    fn ttl(expires_at_ms: Option<u64>) -> OpenShellLifetime {
        OpenShellLifetime {
            mode: OpenShellLifetimeMode::Ttl,
            expires_at_ms,
        }
    }

    const FIXTURE_VALUES: [(&str, &str); 2] = [
        ("GITHUB_TOKEN", "fixture-password"),
        ("DB_PASSWORD", "fixture-secret"),
    ];

    fn reply_text(reply: &OpenShellReply) -> String {
        String::from_utf8(reply.bytes.to_vec()).unwrap()
    }

    fn good_peer() -> LocalPeerInfo {
        LocalPeerInfo {
            pid: 4242,
            process_name: Some("aac".to_string()),
            exe_path: Some("/nonexistent/Bitwarden.app/Contents/MacOS/aac".to_string()),
            parent: Some(ParentProcessInfo {
                pid: 4241,
                process_name: Some("openshell-gateway".to_string()),
                exe_path: Some("/nonexistent/homebrew/bin/openshell-gateway".to_string()),
            }),
            signature: Some(SignatureInfo {
                kind: SignatureKind::LinuxPathOnly,
                identity: "/nonexistent/homebrew/bin/openshell-gateway".to_string(),
                valid: false,
            }),
        }
    }

    // --- validation: accept -------------------------------------------------------------------

    #[test]
    fn the_request_fixture_is_accepted_and_mapped() {
        let validated = validate_resolve(parse(fixture_json())).unwrap();
        let context = &validated.context;
        assert_eq!(context.deadline, Duration::from_millis(25_000));
        assert_eq!(context.gateway_name, "openshell");
        assert_eq!(context.gateway_endpoint, "https://127.0.0.1:17670");
        assert_eq!(context.provider_id, "prov-7f3a");
        assert_eq!(context.provider_name, "gh-agent-1");
        assert_eq!(context.provider_profile, "github");
        assert_eq!(context.workspace, "default");
        assert_eq!(context.sandbox_id, "sbx-01J9Z6");
        assert_eq!(context.sandbox_name, "agent-1");
        assert_eq!(
            context.sandbox_image.as_deref(),
            Some("ghcr.io/example/agent:1.2")
        );
        assert_eq!(
            context.endpoints,
            vec![OpenShellEndpoint {
                host: "api.github.com".to_string(),
                port: 443,
                path: Some("/**".to_string()),
                source: OpenShellEndpointSource::Profile,
            }]
        );
        assert_eq!(
            context.policy_digest,
            "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020"
        );
        assert_eq!(context.advisor_enabled, Some(false));
        assert_eq!(
            validated.targets,
            vec![
                ProviderTarget {
                    credential_key: "GITHUB_TOKEN".to_string(),
                    resource: ResourceKind::Credential,
                    id: "3f1c2b9e-8a4d-4c7e-9b21-5d6f7a8b9c0d".to_string(),
                    field: ProviderField::Password,
                },
                ProviderTarget {
                    credential_key: "DB_PASSWORD".to_string(),
                    resource: ResourceKind::Secret,
                    id: "a7e2d4c1-6b3f-4e8a-9d10-2c5b6a7f8e9d".to_string(),
                    field: ProviderField::Value,
                },
            ]
        );
        assert_eq!(validated.client.unwrap().version, "0.0.0-fixture");
    }

    #[test]
    fn the_hello_fixture_is_accepted() {
        let request: WireRequest = serde_json::from_str(HELLO_FIXTURE).unwrap();
        assert!(validate_hello(request).is_ok());
    }

    #[test]
    fn optional_keys_may_be_omitted_and_empty_strings_are_allowed_where_the_table_says() {
        let validated = validate_mutated(|v| {
            let os = &mut v["openshell"];
            os["sandbox"].as_object_mut().unwrap().remove("image");
            os["endpoints"][0].as_object_mut().unwrap().remove("path");
            os["policy"]
                .as_object_mut()
                .unwrap()
                .remove("advisorEnabled");
            os["provider"]["profile"] = json!("");
            os["provider"]["workspace"] = json!("");
            os["sandbox"]["name"] = json!("");
            v.as_object_mut().unwrap().remove("client");
        })
        .unwrap();
        assert!(validated.context.sandbox_image.is_none());
        assert!(validated.context.endpoints[0].path.is_none());
        assert!(validated.context.advisor_enabled.is_none());
        assert!(validated.client.is_none());
    }

    #[test]
    fn deadline_bounds_are_inclusive() {
        assert!(validate_mutated(|v| v["openshell"]["deadlineMs"] = json!(2000)).is_ok());
        assert!(validate_mutated(|v| v["openshell"]["deadlineMs"] = json!(28000)).is_ok());
    }

    #[test]
    fn wildcard_hosts_and_ipv4_literals_are_accepted() {
        assert!(validate_mutated(
            |v| v["openshell"]["endpoints"][0]["host"] = json!("*.github.com")
        )
        .is_ok());
        assert!(
            validate_mutated(|v| v["openshell"]["endpoints"][0]["host"] = json!("10.0.0.1"))
                .is_ok()
        );
    }

    // --- validation: one reject case per §M8.4 table row ---------------------------------------

    #[test]
    fn foreign_objects_are_rejected() {
        for (key, value) in [
            ("query", json!({"type": "id", "value": "x"})),
            ("delivery", json!("inject")),
            ("create", json!({"name": "x"})),
            ("update", json!({})),
            ("target", json!({"id": "x"})),
            ("fill", json!({})),
            ("generate", json!({})),
            ("project", json!({"id": "project-1"})),
        ] {
            let mut value_json = fixture_json();
            value_json[key] = value;
            assert!(
                validate_resolve(parse(value_json)).is_err(),
                "a top-level {key} object must be rejected"
            );
        }
    }

    #[test]
    fn missing_openshell_object_is_rejected() {
        assert_eq!(
            assert_rejected(|v| {
                v.as_object_mut().unwrap().remove("openshell");
            }),
            "missing openshell object"
        );
    }

    #[test]
    fn wrong_version_is_rejected() {
        assert_eq!(
            assert_rejected(|v| v["version"] = json!(2)),
            "unsupported protocol version"
        );
    }

    #[test]
    fn deadline_out_of_range_or_not_an_integer_is_rejected() {
        assert_rejected(|v| v["openshell"]["deadlineMs"] = json!(1999));
        assert_rejected(|v| v["openshell"]["deadlineMs"] = json!(28001));
        assert_rejected(|v| v["openshell"]["deadlineMs"] = json!(25000.5));
        assert_rejected(|v| v["openshell"]["deadlineMs"] = json!(-1));
        assert_rejected(|v| {
            v["openshell"].as_object_mut().unwrap().remove("deadlineMs");
        });
    }

    #[test]
    fn invalid_gateway_fields_are_rejected() {
        assert_rejected(|v| v["openshell"]["gateway"]["name"] = json!(""));
        assert_rejected(|v| v["openshell"]["gateway"]["name"] = json!("open shell"));
        assert_rejected(|v| v["openshell"]["gateway"]["name"] = json!("a".repeat(65)));
        assert_rejected(|v| v["openshell"]["gateway"]["endpoint"] = json!("ftp://127.0.0.1"));
        assert_rejected(|v| {
            v["openshell"]["gateway"]["endpoint"] = json!(format!("https://{}", "a".repeat(250)))
        });
    }

    #[test]
    fn invalid_ids_are_rejected() {
        assert_rejected(|v| v["openshell"]["provider"]["id"] = json!(""));
        assert_rejected(|v| v["openshell"]["provider"]["id"] = json!("prov/7f3a"));
        assert_rejected(|v| v["openshell"]["sandbox"]["id"] = json!("a".repeat(129)));
        assert_rejected(|v| v["openshell"]["sandbox"]["id"] = json!("sbx 1"));
    }

    #[test]
    fn control_characters_are_rejected_in_every_string() {
        assert_rejected(|v| v["openshell"]["provider"]["name"] = json!("gh\nagent"));
        assert_rejected(|v| v["openshell"]["provider"]["profile"] = json!("git\u{7}hub"));
        assert_rejected(|v| v["openshell"]["provider"]["workspace"] = json!("de\tfault"));
        assert_rejected(|v| v["openshell"]["sandbox"]["name"] = json!("agent\u{0}1"));
        assert_rejected(|v| v["openshell"]["sandbox"]["image"] = json!("img\r"));
        assert_rejected(|v| v["openshell"]["endpoints"][0]["path"] = json!("/\u{1b}[31m"));
        assert_rejected(|v| v["openshell"]["gateway"]["endpoint"] = json!("https://a\u{85}b"));
    }

    #[test]
    fn over_length_strings_are_rejected_not_truncated() {
        assert_rejected(|v| v["openshell"]["provider"]["name"] = json!("a".repeat(129)));
        assert_rejected(|v| v["openshell"]["provider"]["name"] = json!(""));
        assert_rejected(|v| v["openshell"]["provider"]["profile"] = json!("a".repeat(129)));
        assert_rejected(|v| v["openshell"]["sandbox"]["name"] = json!("a".repeat(129)));
        assert_rejected(|v| v["openshell"]["sandbox"]["image"] = json!("a".repeat(513)));
        assert_rejected(|v| v["openshell"]["endpoints"][0]["path"] = json!("a".repeat(513)));
        assert_rejected(|v| {
            v["openshell"]["endpoints"][0]["host"] = json!(format!("{}.com", "a".repeat(250)))
        });
    }

    #[test]
    fn an_empty_endpoint_set_is_rejected_with_the_contract_message() {
        assert_eq!(
            assert_rejected(|v| v["openshell"]["endpoints"] = json!([])),
            "openshell credential has no bound endpoints"
        );
    }

    #[test]
    fn too_many_endpoints_are_rejected() {
        assert_rejected(|v| {
            let many: Vec<Value> = (0..65)
                .map(|i| json!({"host": format!("h{i}.example.com"), "port": 443, "source": "profile"}))
                .collect();
            v["openshell"]["endpoints"] = json!(many);
        });
    }

    #[test]
    fn duplicate_endpoints_are_rejected() {
        assert_eq!(
            assert_rejected(|v| {
                let first = v["openshell"]["endpoints"][0].clone();
                let mut second = first.clone();
                second["source"] = json!("policyBinding");
                v["openshell"]["endpoints"] = json!([first, second]);
            }),
            "openshell.endpoints has a duplicate entry"
        );
    }

    #[test]
    fn invalid_hosts_are_rejected() {
        for host in [
            "API.github.com",
            "::1",
            "[::1]",
            "-api.github.com",
            "api-.github.com",
            "api..github.com",
            "api.github.com.",
            "*.",
            "a.*.com",
            "api_github.com",
            "",
        ] {
            assert!(
                validate_mutated(|v| v["openshell"]["endpoints"][0]["host"] = json!(host)).is_err(),
                "host {host:?} must be rejected"
            );
        }
    }

    #[test]
    fn invalid_ports_and_sources_are_rejected() {
        assert_rejected(|v| v["openshell"]["endpoints"][0]["port"] = json!(0));
        assert_rejected(|v| v["openshell"]["endpoints"][0]["port"] = json!(65536));
        assert_rejected(|v| v["openshell"]["endpoints"][0]["port"] = json!("443"));
        assert_rejected(|v| v["openshell"]["endpoints"][0]["source"] = json!("advisor"));
    }

    #[test]
    fn invalid_policy_digests_are_rejected() {
        for digest in [
            "sha256:998F40A71463C9250C9EAF7BCB560234FC838A2BF7592B260165F9B4AF110020",
            "sha256:998f40",
            "sha512:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
            "998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020",
        ] {
            assert!(
                validate_mutated(|v| v["openshell"]["policy"]["digest"] = json!(digest)).is_err()
            );
        }
    }

    #[test]
    fn target_count_bounds_are_enforced() {
        assert_rejected(|v| v["openshell"]["targets"] = json!([]));
        assert_rejected(|v| {
            let many: Vec<Value> = (0..17)
                .map(|i| {
                    json!({"credentialKey": format!("K{i}"), "resource": "secret",
                        "id": "a7e2d4c1-6b3f-4e8a-9d10-2c5b6a7f8e9d", "field": "value"})
                })
                .collect();
            v["openshell"]["targets"] = json!(many);
        });
    }

    #[test]
    fn totp_and_wrong_fields_for_the_resource_are_rejected() {
        assert_rejected(|v| v["openshell"]["targets"][0]["field"] = json!("totp"));
        assert_rejected(|v| v["openshell"]["targets"][0]["field"] = json!("value"));
        assert_rejected(|v| v["openshell"]["targets"][1]["field"] = json!("password"));
        assert_rejected(|v| v["openshell"]["targets"][0]["resource"] = json!("project"));
    }

    #[test]
    fn duplicate_or_invalid_credential_keys_are_rejected() {
        assert_eq!(
            assert_rejected(
                |v| v["openshell"]["targets"][1]["credentialKey"] = json!("GITHUB_TOKEN")
            ),
            "openshell.targets has a duplicate credentialKey"
        );
        assert_rejected(|v| v["openshell"]["targets"][0]["credentialKey"] = json!("1TOKEN"));
        assert_rejected(|v| v["openshell"]["targets"][0]["credentialKey"] = json!("GH-TOKEN"));
        assert_rejected(|v| v["openshell"]["targets"][0]["credentialKey"] = json!(""));
        assert_rejected(|v| {
            v["openshell"]["targets"][0]["credentialKey"] = json!(format!("A{}", "B".repeat(128)))
        });
    }

    #[test]
    fn non_lowercase_uuids_are_rejected() {
        assert_rejected(|v| {
            v["openshell"]["targets"][0]["id"] = json!("3F1C2B9E-8A4D-4C7E-9B21-5D6F7A8B9C0D")
        });
        assert_rejected(|v| v["openshell"]["targets"][0]["id"] = json!("not-a-uuid"));
        assert_rejected(|v| {
            v["openshell"]["targets"][0]["id"] = json!("3f1c2b9e8a4d4c7e9b215d6f7a8b9c0d")
        });
    }

    #[test]
    fn hello_rejects_anything_but_a_valid_gateway() {
        let mut value: Value = serde_json::from_str(HELLO_FIXTURE).unwrap();
        value["openshell"]["deadlineMs"] = json!(25000);
        assert!(validate_hello(parse(value)).is_err());

        let mut value: Value = serde_json::from_str(HELLO_FIXTURE).unwrap();
        value["openshell"]["gateway"]["name"] = json!("bad name");
        assert!(validate_hello(parse(value)).is_err());

        let mut value: Value = serde_json::from_str(HELLO_FIXTURE).unwrap();
        value["query"] = json!({"type": "id", "value": "x"});
        assert!(validate_hello(parse(value)).is_err());
    }

    // --- attestation precheck -----------------------------------------------------------------

    #[test]
    fn precheck_accepts_aac_spawned_by_openshell_gateway() {
        assert!(precheck_attestation(Some(&good_peer())));
    }

    #[test]
    fn precheck_rejects_a_missing_peer() {
        assert!(!precheck_attestation(None));
    }

    #[test]
    fn precheck_rejects_a_peer_without_a_parent() {
        let peer = LocalPeerInfo {
            parent: None,
            ..good_peer()
        };
        assert!(!precheck_attestation(Some(&peer)));
    }

    #[test]
    fn precheck_rejects_a_parent_that_is_not_openshell_gateway() {
        for exe in [
            "/usr/bin/bash",
            "/sbin/launchd",
            "/usr/lib/systemd/systemd",
            "/opt/openshell-gateway-wrapper",
        ] {
            let mut peer = good_peer();
            peer.parent.as_mut().unwrap().exe_path = Some(exe.to_string());
            assert!(!precheck_attestation(Some(&peer)), "{exe} must be rejected");
        }
        // Process name alone is self-reported-ish metadata: no exe path → reject.
        let mut peer = good_peer();
        peer.parent.as_mut().unwrap().exe_path = None;
        assert!(!precheck_attestation(Some(&peer)));
    }

    #[test]
    fn precheck_accepts_exactly_the_dev_build_artifact_names() {
        for exe in [
            "/nonexistent/clients/apps/desktop/desktop_native/dist/aac.darwin-arm64",
            "/nonexistent/clients/apps/desktop/desktop_native/dist/aac.darwin-x64",
            "/nonexistent/clients/apps/desktop/desktop_native/dist/aac.linux-x64",
            "/nonexistent/clients/apps/desktop/desktop_native/dist/aac.linux-arm64",
            "/nonexistent/.config/Bitwarden/bin/aac",
        ] {
            let mut peer = good_peer();
            peer.exe_path = Some(exe.to_string());
            assert!(precheck_attestation(Some(&peer)), "{exe} must be accepted");
        }
    }

    #[test]
    fn precheck_rejects_a_peer_that_is_not_aac() {
        for exe in [
            "/usr/bin/python3",
            "/tmp/aac-evil",
            "/tmp/aac.exe",
            "/tmp/AAC",
            "/tmp/aac.darwin-arm64.bak",
            "/tmp/aac.darwin-arm64-evil",
            "/tmp/aac-darwin-arm64",
            "/tmp/xaac.darwin-arm64",
            "/tmp/aac.win32-x64.exe",
            "/tmp/aac.darwin-",
            "/tmp/aac.",
        ] {
            let mut peer = good_peer();
            peer.exe_path = Some(exe.to_string());
            assert!(!precheck_attestation(Some(&peer)), "{exe} must be rejected");
        }
        let peer = LocalPeerInfo {
            exe_path: None,
            ..good_peer()
        };
        assert!(!precheck_attestation(Some(&peer)));
    }

    #[test]
    fn precheck_rejects_a_missing_signature() {
        let peer = LocalPeerInfo {
            signature: None,
            ..good_peer()
        };
        assert!(!precheck_attestation(Some(&peer)));
    }

    // --- reply builder: golden fixtures ---------------------------------------------------------

    #[test]
    fn approved_ttl_reply_is_byte_equal_to_the_fixture() {
        let reply = build_reply(
            Ok(Ok(approved(
                ttl(Some(FIXTURE_EXPIRES_AT_MS)),
                &FIXTURE_VALUES,
            ))),
            &fixture_targets(),
            PINNED_NOW_MS,
        );
        assert_eq!(reply_text(&reply), APPROVED_TTL_FIXTURE);
        assert_eq!(reply.status, WireStatus::Approved);
    }

    #[test]
    fn approved_sandbox_lifetime_reply_is_byte_equal_to_the_fixture() {
        let reply = build_reply(
            Ok(Ok(approved(
                OpenShellLifetime {
                    mode: OpenShellLifetimeMode::SandboxLifetime,
                    expires_at_ms: None,
                },
                &FIXTURE_VALUES,
            ))),
            &fixture_targets(),
            PINNED_NOW_MS,
        );
        assert_eq!(reply_text(&reply), APPROVED_SANDBOX_FIXTURE);
    }

    #[test]
    fn denied_reply_is_byte_equal_to_the_fixture() {
        let reply = build_reply(
            Ok(Ok(CredentialResponseData {
                approved: false,
                reason: Some(CredentialDenialReason::Denied),
                ..Default::default()
            })),
            &fixture_targets(),
            PINNED_NOW_MS,
        );
        assert_eq!(reply_text(&reply), DENIED_FIXTURE);
        assert!(reply.starts_cooldown());
        assert!(!build_reply(
            Ok(Ok(approved(
                ttl(Some(FIXTURE_EXPIRES_AT_MS)),
                &FIXTURE_VALUES
            ))),
            &fixture_targets(),
            PINNED_NOW_MS,
        )
        .starts_cooldown());
    }

    #[test]
    fn approved_per_request_reply_carries_its_expiry() {
        let reply = build_reply(
            Ok(Ok(approved(
                OpenShellLifetime {
                    mode: OpenShellLifetimeMode::PerRequest,
                    expires_at_ms: Some(PINNED_NOW_MS + 120_000),
                },
                &FIXTURE_VALUES,
            ))),
            &fixture_targets(),
            PINNED_NOW_MS,
        );
        let text = reply_text(&reply);
        assert!(text.starts_with(
            "{\"version\":1,\"status\":\"approved\",\"openshell\":{\"lifetime\":{\"mode\":\"perRequest\",\"expiresAtMs\":1791231087890}"
        ));
        assert!(!text.contains("\"message\""));
    }

    // --- reply builder: rejections --------------------------------------------------------------

    fn assert_invalid_payload(response: CredentialResponseData) {
        let reply = build_reply(Ok(Ok(response)), &fixture_targets(), PINNED_NOW_MS);
        let text = reply_text(&reply);
        assert_eq!(
            text,
            "{\"version\":1,\"status\":\"error\",\"message\":\"invalid approval payload\"}\n"
        );
        assert!(!text.contains("fixture-password"));
        assert!(!text.contains("fixture-secret"));
    }

    #[test]
    fn reply_builder_rejects_wrong_key_sets() {
        let good = Some(FIXTURE_EXPIRES_AT_MS);
        // extra
        assert_invalid_payload(approved(
            ttl(good),
            &[
                ("GITHUB_TOKEN", "fixture-password"),
                ("DB_PASSWORD", "fixture-secret"),
                ("EXTRA", "x"),
            ],
        ));
        // missing
        assert_invalid_payload(approved(ttl(good), &[("GITHUB_TOKEN", "fixture-password")]));
        // duplicated
        assert_invalid_payload(approved(
            ttl(good),
            &[
                ("GITHUB_TOKEN", "fixture-password"),
                ("GITHUB_TOKEN", "fixture-secret"),
            ],
        ));
        // reordered
        assert_invalid_payload(approved(
            ttl(good),
            &[
                ("DB_PASSWORD", "fixture-secret"),
                ("GITHUB_TOKEN", "fixture-password"),
            ],
        ));
        // no resolution at all
        assert_invalid_payload(CredentialResponseData {
            approved: true,
            ..Default::default()
        });
    }

    #[test]
    fn reply_builder_rejects_bad_values() {
        let good = Some(FIXTURE_EXPIRES_AT_MS);
        assert_invalid_payload(approved(
            ttl(good),
            &[("GITHUB_TOKEN", ""), ("DB_PASSWORD", "fixture-secret")],
        ));
        assert_invalid_payload(approved(
            ttl(good),
            &[("GITHUB_TOKEN", "a\0b"), ("DB_PASSWORD", "fixture-secret")],
        ));
        let huge = "x".repeat(MAX_VALUE_BYTES + 1);
        assert_invalid_payload(approved(
            ttl(good),
            &[
                ("GITHUB_TOKEN", huge.as_str()),
                ("DB_PASSWORD", "fixture-secret"),
            ],
        ));
    }

    #[test]
    fn reply_builder_accepts_a_value_at_the_size_cap() {
        let max = "x".repeat(MAX_VALUE_BYTES);
        let reply = build_reply(
            Ok(Ok(approved(
                ttl(Some(FIXTURE_EXPIRES_AT_MS)),
                &[
                    ("GITHUB_TOKEN", max.as_str()),
                    ("DB_PASSWORD", "fixture-secret"),
                ],
            ))),
            &fixture_targets(),
            PINNED_NOW_MS,
        );
        assert_eq!(reply.status, WireStatus::Approved);
    }

    #[test]
    fn reply_builder_enforces_the_lifetime_windows() {
        let per_request = |at: Option<u64>| OpenShellLifetime {
            mode: OpenShellLifetimeMode::PerRequest,
            expires_at_ms: at,
        };
        // perRequest: over 125 s, in the past, now, or missing.
        assert_invalid_payload(approved(
            per_request(Some(PINNED_NOW_MS + 125_001)),
            &FIXTURE_VALUES,
        ));
        assert_invalid_payload(approved(
            per_request(Some(PINNED_NOW_MS - 1)),
            &FIXTURE_VALUES,
        ));
        assert_invalid_payload(approved(per_request(Some(PINNED_NOW_MS)), &FIXTURE_VALUES));
        assert_invalid_payload(approved(per_request(None), &FIXTURE_VALUES));
        // ttl: over 24 h (+5 s slack), under 30 s, or missing.
        assert_invalid_payload(approved(
            ttl(Some(PINNED_NOW_MS + 86_400_000 + 5_001)),
            &FIXTURE_VALUES,
        ));
        assert_invalid_payload(approved(ttl(Some(PINNED_NOW_MS + 29_999)), &FIXTURE_VALUES));
        assert_invalid_payload(approved(ttl(None), &FIXTURE_VALUES));
        // sandboxLifetime with an expiry.
        assert_invalid_payload(approved(
            OpenShellLifetime {
                mode: OpenShellLifetimeMode::SandboxLifetime,
                expires_at_ms: Some(FIXTURE_EXPIRES_AT_MS),
            },
            &FIXTURE_VALUES,
        ));
        // Boundaries are inclusive where the contract says ≤.
        for lifetime in [
            per_request(Some(PINNED_NOW_MS + 125_000)),
            ttl(Some(PINNED_NOW_MS + 30_000)),
            ttl(Some(PINNED_NOW_MS + 86_400_000 + 5_000)),
        ] {
            let reply = build_reply(
                Ok(Ok(approved(lifetime, &FIXTURE_VALUES))),
                &fixture_targets(),
                PINNED_NOW_MS,
            );
            assert_eq!(reply.status, WireStatus::Approved, "{lifetime:?}");
        }
    }

    // --- reply builder: status mapping --------------------------------------------------------

    fn denial(reason: Option<CredentialDenialReason>, detail: Option<&str>) -> OpenShellReply {
        build_reply(
            Ok(Ok(CredentialResponseData {
                approved: false,
                reason,
                denial_detail: detail.map(str::to_string),
                ..Default::default()
            })),
            &fixture_targets(),
            PINNED_NOW_MS,
        )
    }

    #[test]
    fn non_approved_outcomes_map_to_the_existing_vocabulary() {
        assert_eq!(
            denial(Some(CredentialDenialReason::NotFound), None).status,
            WireStatus::NotFound
        );
        assert_eq!(
            denial(Some(CredentialDenialReason::Locked), None).status,
            WireStatus::Locked
        );
        let timeout = denial(Some(CredentialDenialReason::Timeout), None);
        assert_eq!(timeout.status, WireStatus::Timeout);
        // §M8.18: a renderer-reported timeout leaves the pair open for the next retry.
        assert!(!timeout.starts_cooldown());
        assert!(!denial(Some(CredentialDenialReason::NotFound), None).starts_cooldown());
        assert!(!denial(Some(CredentialDenialReason::Locked), None).starts_cooldown());
        let internal = denial(
            Some(CredentialDenialReason::Internal),
            Some("policy fingerprint mismatch"),
        );
        assert_eq!(internal.status, WireStatus::Error);
        assert!(reply_text(&internal).contains("policy fingerprint mismatch"));
        assert!(!internal.starts_cooldown());
        let reprompt = denial(
            Some(CredentialDenialReason::Denied),
            Some("This item requires master password re-prompt and can't be used by OpenShell"),
        );
        assert_eq!(reprompt.status, WireStatus::Denied);
        assert!(reprompt.starts_cooldown());
        assert!(reply_text(&reprompt).contains("master password re-prompt"));
        assert_eq!(
            denial(Some(CredentialDenialReason::OriginMismatch), None).status,
            WireStatus::Error
        );
        assert_eq!(denial(None, None).status, WireStatus::Denied);

        let failed = build_reply(Ok(Err(CallbackError::Failed)), &fixture_targets(), 0);
        assert_eq!(failed.status, WireStatus::Error);
    }

    #[test]
    fn an_unsafe_denial_detail_is_replaced() {
        let reply = denial(Some(CredentialDenialReason::Internal), Some("line\nbreak"));
        assert!(reply_text(&reply).contains("Request could not be completed"));
        let long = "x".repeat(MAX_DETAIL_BYTES + 1);
        let reply = denial(Some(CredentialDenialReason::Denied), Some(long.as_str()));
        assert!(reply_text(&reply).contains("Denied by user"));
    }

    #[tokio::test(start_paused = true)]
    async fn an_elapsed_dispatch_maps_to_timeout() {
        let elapsed = tokio::time::timeout(
            Duration::from_millis(1),
            std::future::pending::<Result<CredentialResponseData, CallbackError>>(),
        )
        .await;
        let reply = build_reply(elapsed, &fixture_targets(), 0);
        assert_eq!(reply.status, WireStatus::Timeout);
        assert!(reply.starts_cooldown());
    }

    #[test]
    fn the_hello_reply_is_exact() {
        assert_eq!(
            reply_text(&hello_reply()),
            "{\"version\":1,\"status\":\"approved\"}\n"
        );
    }

    // --- Debug redaction ---------------------------------------------------------------------

    #[test]
    fn debug_output_of_value_bearing_types_contains_no_value() {
        let response = approved(ttl(Some(FIXTURE_EXPIRES_AT_MS)), &FIXTURE_VALUES);
        let resolution = response.openshell.clone().unwrap();
        for rendered in [
            format!("{:?}", resolution.values[0]),
            format!("{resolution:?}"),
            format!("{response:?}"),
        ] {
            assert!(!rendered.contains("fixture-password"), "{rendered}");
            assert!(!rendered.contains("fixture-secret"), "{rendered}");
        }
        assert!(format!("{resolution:?}").contains("GITHUB_TOKEN"));
    }

    #[test]
    fn debug_output_of_the_context_carries_ids_not_names() {
        let validated = validate_resolve(parse(fixture_json())).unwrap();
        let rendered = format!("{:?}", validated.context);
        assert!(rendered.contains("prov-7f3a"));
        assert!(rendered.contains("sbx-01J9Z6"));
        assert!(!rendered.contains("gh-agent-1"));
        assert!(!rendered.contains("agent-1\""));
        assert!(!rendered.contains("ghcr.io"));
        assert!(!rendered.contains("api.github.com"));
    }

    // --- limiter --------------------------------------------------------------------------------

    #[test]
    fn only_one_request_per_provider_is_in_flight() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let first = limiter.try_begin("sbx-1", "prov-1", "key-a").unwrap();
        // A different request for the same provider is refused, from any sandbox.
        assert_eq!(
            limiter.try_begin("sbx-2", "prov-1", "key-b").err(),
            Some(LimitRefusal::InFlight)
        );
        assert_eq!(
            limiter.try_begin("sbx-1", "prov-1", "key-b").err(),
            Some(LimitRefusal::InFlight)
        );
        assert!(limiter.try_begin("sbx-1", "prov-2", "key-b").is_ok());
        drop(first);
        assert!(limiter.try_begin("sbx-1", "prov-1", "key-b").is_ok());
    }

    #[test]
    fn identical_requests_may_coalesce_up_to_the_cap() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let guards: Vec<InFlightGuard> = (0..MAX_COALESCED_IN_FLIGHT)
            .map(|_| limiter.try_begin("sbx-1", "prov-1", "key-a").unwrap())
            .collect();
        assert_eq!(
            limiter.try_begin("sbx-1", "prov-1", "key-a").err(),
            Some(LimitRefusal::InFlight)
        );
        drop(guards);
        // Every slot was released: a different request may go now.
        assert!(limiter.try_begin("sbx-1", "prov-1", "key-b").is_ok());
    }

    #[test]
    fn the_coalescing_key_covers_every_identity_field_and_ignores_target_order() {
        let base = validate_resolve(parse(fixture_json())).unwrap();
        let key = coalescing_key(&base.context, &base.targets);
        let mut reordered = base.targets.clone();
        reordered.reverse();
        assert_eq!(coalescing_key(&base.context, &reordered), key);

        type Mutation = Box<dyn Fn(&mut Value)>;
        let mutations: Vec<Mutation> = vec![
            Box::new(|v| v["openshell"]["gateway"]["name"] = json!("other")),
            Box::new(|v| v["openshell"]["gateway"]["endpoint"] = json!("https://127.0.0.1:1")),
            Box::new(|v| v["openshell"]["sandbox"]["id"] = json!("sbx-other")),
            Box::new(|v| v["openshell"]["provider"]["id"] = json!("prov-other")),
            Box::new(|v| {
                v["openshell"]["policy"]["digest"] =
                    json!("sha256:f098164656d916d933b9ad3ea24ce0c43cc84aa04300528a4e2e6ec2844e582d")
            }),
            Box::new(|v| v["openshell"]["targets"][0]["field"] = json!("username")),
            Box::new(|v| {
                v["openshell"]["targets"][0]["id"] = json!("00000000-0000-4000-8000-000000000001")
            }),
            Box::new(|v| v["openshell"]["targets"][0]["credentialKey"] = json!("OTHER_KEY")),
            Box::new(|v| {
                v["openshell"]["targets"]
                    .as_array_mut()
                    .unwrap()
                    .truncate(1)
            }),
        ];
        for mutate in mutations {
            let mut value = fixture_json();
            mutate(&mut value);
            let other = validate_resolve(parse(value)).unwrap();
            assert_ne!(coalescing_key(&other.context, &other.targets), key);
        }
    }

    #[tokio::test(start_paused = true)]
    async fn a_denial_cools_the_pair_down_for_sixty_seconds() {
        let limiter = Arc::new(OpenShellLimiter::default());
        limiter.start_cooldown("sbx-1", "prov-1");
        assert_eq!(
            limiter.try_begin("sbx-1", "prov-1", "k").err(),
            Some(LimitRefusal::CoolingDown)
        );
        // Other pairs are unaffected.
        drop(limiter.try_begin("sbx-2", "prov-1", "k").unwrap());
        tokio::time::advance(Duration::from_secs(59)).await;
        assert_eq!(
            limiter.try_begin("sbx-1", "prov-1", "k").err(),
            Some(LimitRefusal::CoolingDown)
        );
        tokio::time::advance(Duration::from_secs(2)).await;
        assert!(limiter.try_begin("sbx-1", "prov-1", "k").is_ok());
    }
}
