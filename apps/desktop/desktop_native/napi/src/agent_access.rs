//! Agent Access napi:
//! - Wraps `agent_access_core::DesktopAgentAccess` to provide access from Electron.
//! - Sets up the ThreadsafeFunction callback handlers Electron uses to answer credential requests,
//!   verify handshake fingerprints, and back identity/connection/PSK storage.
//!
//! This module holds no business logic — only DTO conversion and the 60s timeout wrapper
//! around each JS callback invocation, mirroring `sshagent_v2`. The credential lookup,
//! fingerprint verification, and storage adapters themselves live in the `agent_access` crate
//! (aliased here as `agent_access_core` to avoid colliding with this submodule's own name —
//! both are named `agent_access` to match the generated `agentAccess` TS namespace).
//!
//! Deny-by-default is enforced in two places: `agent_access_core`'s dispatch loop times out
//! and denies independent of which host implementation is plugged in (and is unit-tested
//! there with plain Rust mocks); this module additionally times out each individual JS
//! callback invocation, since that's where the actual "call into JS" happens and where a
//! hung/closed Electron window would otherwise block forever.

#[napi]
pub mod agent_access {
    use std::{sync::Arc, time::Duration};

    use async_trait::async_trait;
    use napi::{
        bindgen_prelude::{FromNapiValue, JsValuesTupleIntoVec, Promise},
        threadsafe_function::ThreadsafeFunction,
    };
    use tokio::time::timeout;
    use tracing::{debug, error};

    /// Timeout for each individual Electron callback invocation.
    const CALLBACK_TIMEOUT: Duration = Duration::from_secs(60);

    /// Timeout for the (fire-and-forget) activity-log event callback. Deliberately much
    /// shorter than [`CALLBACK_TIMEOUT`]: unlike the credential/fingerprint/storage callbacks,
    /// nothing waits on this one, so a slow renderer must never be allowed to pin down a
    /// detached task for a full minute per event.
    const EVENT_CALLBACK_TIMEOUT: Duration = Duration::from_secs(5);

    /// Invokes a `ThreadsafeFunction` under [`CALLBACK_TIMEOUT`], flattening timeout and
    /// call/promise failures into a single [`agent_access_core::CallbackError`] — callers
    /// never see which of the two happened, matching the "never leak host-side detail" rule.
    async fn invoke_callback<T, R>(
        callback: &ThreadsafeFunction<T, Promise<R>>,
        arg: T,
    ) -> Result<R, agent_access_core::CallbackError>
    where
        T: 'static + JsValuesTupleIntoVec,
        R: 'static + FromNapiValue,
    {
        timeout(CALLBACK_TIMEOUT, async {
            let promise = callback
                .call_async(Ok(arg))
                .await
                .map_err(|_| agent_access_core::CallbackError::Failed)?;
            promise
                .await
                .map_err(|_| agent_access_core::CallbackError::Failed)
        })
        .await
        .map_err(|_| agent_access_core::CallbackError::Timeout)
        .flatten()
    }

    // -----------------------------------------------------------------------------------
    // DTOs
    // -----------------------------------------------------------------------------------

    /// Which field of a [`CredentialRequestData`] the query matches against.
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum CredentialQueryType {
        Domain,
        Id,
        Search,
        /// Exact (or unique case-insensitive) Secrets Manager secret key match. Valid only for
        /// `resourceType: "secret"` requests.
        Name,
    }

    impl From<agent_access_core::CredentialQueryKind> for CredentialQueryType {
        fn from(kind: agent_access_core::CredentialQueryKind) -> Self {
            match kind {
                agent_access_core::CredentialQueryKind::Domain => Self::Domain,
                agent_access_core::CredentialQueryKind::Id => Self::Id,
                agent_access_core::CredentialQueryKind::Search => Self::Search,
                agent_access_core::CredentialQueryKind::Name => Self::Name,
            }
        }
    }

    /// Which kind of vault data a [`CredentialRequestData`] is asking for. Always `"credential"`
    /// on the relay path — Secrets Manager secrets are local-transport-only (see
    /// agent-access-architecture.md, "M4", invariant 6).
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum ResourceType {
        Credential,
        Secret,
        /// Secrets Manager project (M6) — list/create/update/delete operations only.
        Project,
    }

    impl From<agent_access_core::ResourceKind> for ResourceType {
        fn from(kind: agent_access_core::ResourceKind) -> Self {
            match kind {
                agent_access_core::ResourceKind::Credential => Self::Credential,
                agent_access_core::ResourceKind::Secret => Self::Secret,
                agent_access_core::ResourceKind::Project => Self::Project,
            }
        }
    }

    /// Whether a [`CredentialRequestData`] is asking to look up existing vault data, to
    /// create a new Secrets Manager secret (M4b, `secretCreate`), or to describe the active
    /// browser tab's fillable fields (M5, `describeFillTarget`). Always `"request"` on the
    /// relay path — creates and describe-target requests are local-transport-only, same
    /// restriction as `resourceType: "secret"` (see agent-access-architecture.md, "M4b — secret
    /// creation" and "M5 — Browser fill delivery").
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum OperationType {
        Request,
        Create,
        /// Update an existing SM secret, or rename a project (M6, `secretUpdate`/`projectUpdate`).
        Update,
        /// Delete a single SM secret or project (M6, `secretDelete`/`projectDelete`).
        Delete,
        /// Release the readable SM project list in one approval (M6, `projectList`).
        List,
        DescribeFillTarget,
        /// An OpenShell gateway resolving one provider's `bw://` references (§M8,
        /// `openshellResolve`). Only ever paired with `origin: "openshell"`.
        ProviderResolve,
    }

    impl From<agent_access_core::RequestOperation> for OperationType {
        fn from(operation: agent_access_core::RequestOperation) -> Self {
            match operation {
                agent_access_core::RequestOperation::Request => Self::Request,
                agent_access_core::RequestOperation::Create => Self::Create,
                agent_access_core::RequestOperation::Update => Self::Update,
                agent_access_core::RequestOperation::Delete => Self::Delete,
                agent_access_core::RequestOperation::List => Self::List,
                agent_access_core::RequestOperation::DescribeFillTarget => Self::DescribeFillTarget,
                agent_access_core::RequestOperation::ProviderResolve => Self::ProviderResolve,
            }
        }
    }

    /// Which ingress a [`CredentialRequestData`] arrived through.
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum CredentialRequestOrigin {
        Relay,
        Local,
        /// The toggle-gated OpenShell socket (§M8). Set by the listener kind, never the wire.
        #[napi(value = "openshell")]
        OpenShell,
    }

    impl From<agent_access_core::CredentialRequestOrigin> for CredentialRequestOrigin {
        fn from(origin: agent_access_core::CredentialRequestOrigin) -> Self {
            match origin {
                agent_access_core::CredentialRequestOrigin::Relay => Self::Relay,
                agent_access_core::CredentialRequestOrigin::Local => Self::Local,
                agent_access_core::CredentialRequestOrigin::OpenShell => Self::OpenShell,
            }
        }
    }

    /// Which source an [`OpenShellEndpointData`] came from (§M8.5).
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum OpenShellEndpointSource {
        Profile,
        PolicyBinding,
    }

    impl From<agent_access_core::OpenShellEndpointSource> for OpenShellEndpointSource {
        fn from(source: agent_access_core::OpenShellEndpointSource) -> Self {
            match source {
                agent_access_core::OpenShellEndpointSource::Profile => Self::Profile,
                agent_access_core::OpenShellEndpointSource::PolicyBinding => Self::PolicyBinding,
            }
        }
    }

    /// Which field of an item or secret a [`ProviderTargetData`] names (§M8.3).
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum ProviderField {
        Username,
        Password,
        Value,
    }

    impl From<agent_access_core::ProviderField> for ProviderField {
        fn from(field: agent_access_core::ProviderField) -> Self {
            match field {
                agent_access_core::ProviderField::Username => Self::Username,
                agent_access_core::ProviderField::Password => Self::Password,
                agent_access_core::ProviderField::Value => Self::Value,
            }
        }
    }

    /// How long one OpenShell approval lasts (§M8.6).
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum OpenShellLifetimeMode {
        PerRequest,
        Ttl,
        SandboxLifetime,
    }

    impl From<OpenShellLifetimeMode> for agent_access_core::OpenShellLifetimeMode {
        fn from(mode: OpenShellLifetimeMode) -> Self {
            match mode {
                OpenShellLifetimeMode::PerRequest => Self::PerRequest,
                OpenShellLifetimeMode::Ttl => Self::Ttl,
                OpenShellLifetimeMode::SandboxLifetime => Self::SandboxLifetime,
            }
        }
    }

    /// One endpoint an OpenShell provider credential can be sent to — reported by the gateway,
    /// not verified by Bitwarden.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct OpenShellEndpointData {
        pub host: String,
        pub port: u32,
        pub path: Option<String>,
        pub source: OpenShellEndpointSource,
    }

    impl From<agent_access_core::OpenShellEndpoint> for OpenShellEndpointData {
        fn from(endpoint: agent_access_core::OpenShellEndpoint) -> Self {
            Self {
                host: endpoint.host,
                port: u32::from(endpoint.port),
                path: endpoint.path,
                source: endpoint.source.into(),
            }
        }
    }

    /// Gateway-reported context for an `operation: "providerResolve"` request (§M8.7). Every
    /// field is reported by the OpenShell gateway, not verified by Bitwarden.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct OpenShellContextData {
        pub deadline_ms: u32,
        pub gateway_name: String,
        pub gateway_endpoint: String,
        pub provider_id: String,
        pub provider_name: String,
        pub provider_profile: String,
        pub workspace: String,
        pub sandbox_id: String,
        pub sandbox_name: String,
        pub sandbox_image: Option<String>,
        pub endpoints: Vec<OpenShellEndpointData>,
        pub policy_digest: String,
        pub advisor_enabled: Option<bool>,
    }

    impl From<agent_access_core::OpenShellContext> for OpenShellContextData {
        fn from(context: agent_access_core::OpenShellContext) -> Self {
            Self {
                // Validated to 5000..=28000 ms on the wire, so this never saturates.
                deadline_ms: u32::try_from(context.deadline.as_millis()).unwrap_or(u32::MAX),
                gateway_name: context.gateway_name,
                gateway_endpoint: context.gateway_endpoint,
                provider_id: context.provider_id,
                provider_name: context.provider_name,
                provider_profile: context.provider_profile,
                workspace: context.workspace,
                sandbox_id: context.sandbox_id,
                sandbox_name: context.sandbox_name,
                sandbox_image: context.sandbox_image,
                endpoints: context
                    .endpoints
                    .into_iter()
                    .map(OpenShellEndpointData::from)
                    .collect(),
                policy_digest: context.policy_digest,
                advisor_enabled: context.advisor_enabled,
            }
        }
    }

    /// One `bw://` target of a provider resolve: an env-var name plus the item or secret id.
    /// Value-free.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct ProviderTargetData {
        pub credential_key: String,
        pub resource_type: ResourceType,
        pub id: String,
        pub field: ProviderField,
    }

    impl From<agent_access_core::ProviderTarget> for ProviderTargetData {
        fn from(target: agent_access_core::ProviderTarget) -> Self {
            Self {
                credential_key: target.credential_key,
                resource_type: target.resource.into(),
                id: target.id,
                field: target.field.into(),
            }
        }
    }

    /// One released provider credential value. Not `Debug`: it carries a live value.
    #[napi(object)]
    pub struct ProviderValueData {
        pub credential_key: String,
        pub value: String,
    }

    /// The approval lifetime the renderer chose. `expiresAtMs` is a stringified u64 (Unix epoch
    /// milliseconds), like `timestampMs`: required for `perRequest`/`ttl`, absent for
    /// `sandboxLifetime` — enforced again by the Rust reply builder.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct OpenShellLifetimeData {
        pub mode: OpenShellLifetimeMode,
        pub expires_at_ms: Option<String>,
    }

    /// How the requester wants an approved credential delivered. Only present for
    /// `origin: "local"` requests.
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum DeliveryMode {
        Inject,
        Reference,
        /// M5, "Browser fill delivery" — the credential value never crosses this napi boundary
        /// at all for this mode; the renderer resolves it and pushes it directly to the browser
        /// extension. Credential resource only.
        Fill,
    }

    impl From<agent_access_core::DeliveryMode> for DeliveryMode {
        fn from(mode: agent_access_core::DeliveryMode) -> Self {
            match mode {
                agent_access_core::DeliveryMode::Inject => Self::Inject,
                agent_access_core::DeliveryMode::Reference => Self::Reference,
                agent_access_core::DeliveryMode::Fill => Self::Fill,
            }
        }
    }

    /// Best-effort one-level parent-chain walk from the local peer (W2a, `crate::attestation`
    /// in `agent_access_core`) — identifies whoever spawned the `aac` CLI (the agent), since the
    /// socket peer itself is always `aac`. `None` on `LocalPeerInfoData::parent` means the walk
    /// failed or hit `launchd`/`init` — see `agent_access_core::attestation`'s docs — not that
    /// the peer is untrusted.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct ParentProcessInfoData {
        pub pid: u32,
        pub process_name: Option<String>,
        pub exe_path: Option<String>,
    }

    impl From<agent_access_core::ParentProcessInfo> for ParentProcessInfoData {
        fn from(info: agent_access_core::ParentProcessInfo) -> Self {
            Self {
                pid: info.pid,
                process_name: info.process_name,
                exe_path: info.exe_path,
            }
        }
    }

    /// Which platform mechanism produced a [`SignatureInfoData`], and therefore how to read
    /// `identity`.
    #[napi(string_enum = "camelCase")]
    #[derive(Debug, Clone, Copy)]
    pub enum SignatureKindData {
        MacosTeamId,
        WindowsPublisher,
        LinuxPathOnly,
    }

    impl From<agent_access_core::SignatureKind> for SignatureKindData {
        fn from(kind: agent_access_core::SignatureKind) -> Self {
            match kind {
                agent_access_core::SignatureKind::MacosTeamId => Self::MacosTeamId,
                agent_access_core::SignatureKind::WindowsPublisher => Self::WindowsPublisher,
                agent_access_core::SignatureKind::LinuxPathOnly => Self::LinuxPathOnly,
            }
        }
    }

    /// Code-signature facts (W2a) about the attested process — the resolved `parent` if
    /// present, else the immediate peer. An unsigned or invalid-signature binary still produces
    /// a `SignatureInfoData` with `valid: false` and the best available `identity` (falling back
    /// to the executable path) — `None` on `LocalPeerInfoData::signature` means verification
    /// could not be attempted at all.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct SignatureInfoData {
        pub kind: SignatureKindData,
        pub identity: String,
        pub valid: bool,
    }

    impl From<agent_access_core::SignatureInfo> for SignatureInfoData {
        fn from(info: agent_access_core::SignatureInfo) -> Self {
            Self {
                kind: info.kind.into(),
                identity: info.identity,
                valid: info.valid,
            }
        }
    }

    /// OS-verified identity of the local peer (the `aac` CLI process), captured at accept time
    /// from peer credentials — never self-reported. `None` fields mean resolution failed for
    /// that piece of metadata, not that the peer is untrusted; see
    /// `agent_access_core::LocalPeerInfo`'s docs.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct LocalPeerInfoData {
        pub pid: u32,
        pub process_name: Option<String>,
        pub exe_path: Option<String>,
        pub parent: Option<ParentProcessInfoData>,
        pub signature: Option<SignatureInfoData>,
    }

    impl From<agent_access_core::LocalPeerInfo> for LocalPeerInfoData {
        fn from(info: agent_access_core::LocalPeerInfo) -> Self {
            Self {
                pid: info.pid,
                process_name: info.process_name,
                exe_path: info.exe_path,
                parent: info.parent.map(ParentProcessInfoData::from),
                signature: info.signature.map(SignatureInfoData::from),
            }
        }
    }

    /// A credential lookup — or, for `operation: "create"`, a proposed secret creation —
    /// requested by a paired remote agent or the local `aac` CLI, sent to Electron for approval.
    ///
    /// Not `#[derive(Debug)]`: `new_secret_value` carries a plaintext secret across the FFI
    /// boundary (Electron needs it to render the masked-with-reveal value field), so it must
    /// never end up formatted into a log line — see the manual `Debug` impl below, which mirrors
    /// `agent_access_core::CredentialRequestData`'s redaction of the same field.
    #[napi(object)]
    #[derive(Clone)]
    pub struct CredentialRequestData {
        pub query_type: CredentialQueryType,
        pub query_value: String,
        /// `None` for `origin: "local"` — local requesters have no cryptographic identity.
        pub requester_fingerprint: Option<String>,
        pub requester_name: Option<String>,
        pub origin: CredentialRequestOrigin,
        /// `None` on the relay path.
        pub local_peer: Option<LocalPeerInfoData>,
        /// `None` on the relay path, and for `operation: "create"` requests.
        pub delivery_mode: Option<DeliveryMode>,
        /// Whether this request is asking for a login credential or a Secrets Manager secret.
        /// Always `"credential"` on the relay path.
        pub resource_type: ResourceType,
        /// Whether this is a lookup against existing vault data, or a proposal to create a new
        /// Secrets Manager secret. Always `"request"` on the relay path.
        pub operation: OperationType,
        /// Proposed name for a new Secrets Manager secret. Only set for `operation: "create"`.
        pub new_secret_name: Option<String>,
        /// Proposed value for a new Secrets Manager secret. Only set for `operation: "create"`.
        /// Held in plaintext here because Electron needs it to render the masked-with-reveal
        /// value field in the creation-approval dialog — the same reason `secret_value` on
        /// [`CredentialResponseData`] crosses this boundary as a plain `String` rather than
        /// staying `Zeroizing`.
        pub new_secret_value: Option<String>,
        /// Proposed note for a new Secrets Manager secret. Only set for `operation: "create"`.
        pub new_secret_note: Option<String>,
        /// Optional project-name hint for a new Secrets Manager secret — never trusted silently,
        /// see `agent_access_core::CredentialRequestData::project_hint`'s docs. Set for
        /// `operation: "create"`, and for `operation: "update"` when the agent proposes a
        /// project move (M6).
        pub project_hint: Option<String>,
        /// Id of the existing secret or project an `operation: "update"`/`"delete"` request
        /// targets (M6). An opaque identifier, never a name or value.
        pub target_id: Option<String>,
        /// When true, the desktop generates the secret's value at approval time instead of the
        /// agent supplying one (M6): renderer-side generation, org-key encryption, then discard —
        /// the value never crosses this boundary in either direction. Mutually exclusive with
        /// `newSecretValue` (enforced in `local_protocol::validate`). Valid for
        /// `operation: "create"` and `"update"` on `resourceType: "secret"`.
        pub generate_value: Option<bool>,
        /// Requested generated-value length, already validated to `[12, 128]` by the wire layer.
        /// Absent means the desktop default (40). Only set alongside `generateValue: true`.
        pub generate_length: Option<u32>,
        /// Whether the generated value includes symbols (default true). Only set alongside
        /// `generateValue: true`.
        pub generate_symbols: Option<bool>,
        /// Requested field roles (`"username"`/`"password"`/`"totp"`) for a
        /// `deliveryMode: "fill"` request (M5). `None`/absent means "default: all fields present
        /// and safe". Value-free — role names, never a credential value.
        pub fill_fields: Option<Vec<String>>,
        /// Optional `targetToken` from a prior `describeFillTarget` call (M5), binding this fill
        /// to a specific extension-produced field plan. Value-free — an opaque token.
        pub fill_target_token: Option<String>,
        /// Gateway-reported context for `operation: "providerResolve"` (§M8). Only set for
        /// `origin: "openshell"`.
        pub openshell: Option<OpenShellContextData>,
        /// The `bw://` targets of `operation: "providerResolve"`, in wire order. Only set for
        /// `origin: "openshell"`.
        pub provider_targets: Option<Vec<ProviderTargetData>>,
    }

    impl From<agent_access_core::CredentialRequestData> for CredentialRequestData {
        fn from(data: agent_access_core::CredentialRequestData) -> Self {
            Self {
                query_type: data.query_type.into(),
                query_value: data.query_value,
                requester_fingerprint: data.requester_fingerprint,
                requester_name: data.requester_name,
                origin: data.origin.into(),
                local_peer: data.local_peer.map(LocalPeerInfoData::from),
                delivery_mode: data.delivery_mode.map(DeliveryMode::from),
                resource_type: data.resource.into(),
                operation: data.operation.into(),
                new_secret_name: data.new_secret_name,
                new_secret_value: data.new_secret_value.map(|value| value.to_string()),
                // CRITICAL: a direct `Option<String>` -> `Option<String>` pass-through — this
                // must never become a `.filter(|s| !s.is_empty())` or similar, which would
                // collapse `Some("")` (the wire contract's "clear the note" signal, M6) into
                // `None` ("no change"). See `note_empty_string_survives_the_request_conversion`
                // below for the regression test pinning this.
                new_secret_note: data.new_secret_note,
                project_hint: data.project_hint,
                target_id: data.target_id,
                generate_value: Some(data.generate_value),
                generate_length: data.generate_length,
                generate_symbols: data.generate_symbols,
                fill_fields: data.fill_fields,
                fill_target_token: data.fill_target_token,
                openshell: data.openshell.map(OpenShellContextData::from),
                provider_targets: (!data.provider_targets.is_empty()).then(|| {
                    data.provider_targets
                        .into_iter()
                        .map(ProviderTargetData::from)
                        .collect()
                }),
            }
        }
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
                .field("resource_type", &self.resource_type)
                .field("operation", &self.operation)
                .field("has_new_secret_name", &self.new_secret_name.is_some())
                .field("has_new_secret_value", &self.new_secret_value.is_some())
                .field("has_new_secret_note", &self.new_secret_note.is_some())
                .field("has_project_hint", &self.project_hint.is_some())
                .field("target_id", &self.target_id)
                .field("generate_value", &self.generate_value)
                .field("generate_length", &self.generate_length)
                .field("generate_symbols", &self.generate_symbols)
                .field("fill_fields", &self.fill_fields)
                .field("fill_target_token", &self.fill_target_token)
                .field(
                    "openshell_provider_id",
                    &self.openshell.as_ref().map(|c| c.provider_id.as_str()),
                )
                .field(
                    "openshell_sandbox_id",
                    &self.openshell.as_ref().map(|c| c.sandbox_id.as_str()),
                )
                .field("provider_targets", &self.provider_targets)
                .finish()
        }
    }

    /// One entry of an approved `operation: "list"` response (M6, `projectList`) — project
    /// metadata only, no secret material. `organization` is the org's display name, resolved
    /// renderer-side.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct AgentAccessProjectEntry {
        pub id: String,
        pub name: String,
        pub write: bool,
        pub organization: Option<String>,
    }

    impl From<AgentAccessProjectEntry> for agent_access_core::ProjectEntry {
        fn from(entry: AgentAccessProjectEntry) -> Self {
            Self {
                id: entry.id,
                name: entry.name,
                write: entry.write,
                organization: entry.organization,
            }
        }
    }

    /// Electron's answer to a [`CredentialRequestData`]. Not `Debug`/`Clone` — it may carry a
    /// live credential, and nothing here should ever end up formatted into a log line.
    #[napi(object)]
    pub struct CredentialResponseData {
        pub approved: bool,
        pub username: Option<String>,
        pub password: Option<String>,
        pub totp: Option<String>,
        pub uri: Option<String>,
        pub notes: Option<String>,
        pub credential_id: Option<String>,
        /// Set when `approved: false` to distinguish "no match" (`"notFound"`) from an explicit
        /// user denial (`"denied"`), a locked/unavailable vault (`"locked"`), or a non-user
        /// failure (`"error"` — e.g. the feature was disabled, or a lookup failed). Any other
        /// value (including `None`) maps to the generic "denied" default on the local
        /// protocol's `status` field. `"locked"`/`"error"` exist so those cases are never
        /// reported to the requester as "Denied by user" — see
        /// `agent_access_core::CredentialDenialReason`'s docs.
        pub reason: Option<String>,
        /// Display name of the matched item, for the local protocol's reference-mode reply.
        /// Not yet populated by the renderer — see `MainAgentAccessService`'s report. Also
        /// doubles as the Secrets Manager secret's display name (`secret.name`) for
        /// `resourceType: "secret"` requests.
        pub item_name: Option<String>,
        /// The Secrets Manager secret's decrypted value, for `resourceType: "secret"` requests.
        /// Unset for credential requests.
        pub secret_value: Option<String>,
        /// Secrets Manager secret ID, for `resourceType: "secret"` requests. Unset for
        /// credential requests.
        pub secret_id: Option<String>,
        /// Secrets Manager project ID, for approved `resourceType: "project"`
        /// create/update/delete responses (M6). Unset otherwise.
        pub project_id: Option<String>,
        /// The readable project list released by an approved `operation: "list"` request (M6) —
        /// names, ids, and write flags only, no secret material. The names transit main only
        /// inside this in-flight response and are never buffered there (ids-only activity
        /// invariant). Unset for every other operation.
        pub projects: Option<Vec<AgentAccessProjectEntry>>,
        /// Value-free JSON pass-through describing a `deliveryMode: "fill"` request's execution
        /// outcome (M5's `fill` response object) — the renderer builds this directly (its shape
        /// mirrors the wire example in agent-access-architecture.md's "M5" section). Parsed into
        /// a `serde_json::Value` by `agent_access_core::local_listener::local_protocol`; never
        /// read as a field by this crate. Set for `deliveryMode: "fill"` responses, approved or
        /// denied (an `originMismatch`/`noSafeTarget` denial can still carry the
        /// extension-reported origin here).
        pub fill_result: Option<String>,
        /// Value-free JSON pass-through describing the active browser tab for a
        /// `operation: "describeFillTarget"` request (M5's `fillTarget` response object). Set
        /// only for `describeFillTarget` responses.
        pub fill_target: Option<String>,
        /// Machine-readable, value-free detail for an `"originMismatch"`/`"noSafeTarget"`
        /// `reason` (the mismatched origin, or a `looks-like-registration`/`ambiguous-target`/...
        /// reason code), or actionable static guidance for an `"error"` reason (e.g. "the
        /// browser extension is not connected"). `None` for every other reason, and optional
        /// even for these — the wire layer falls back to a generic message when it is absent.
        ///
        /// NEVER put a vault value here: this string is relayed verbatim to the requesting
        /// agent by `local_protocol.rs`'s denial dispatch.
        pub denial_detail: Option<String>,
        /// Field roles (`"username"`/`"password"`/`"totp"`) actually filled by an approved
        /// `deliveryMode: "fill"` request, for the activity log's `fieldsShared` (M5). Supplied
        /// directly by the renderer rather than derived by parsing `fill_result`.
        pub fill_fields_shared: Option<Vec<String>>,
        /// The released values for an approved `operation: "providerResolve"` request (§M8), in
        /// target order. The Rust reply builder re-checks the key set before writing anything.
        pub openshell_values: Option<Vec<ProviderValueData>>,
        /// The approval lifetime for an approved `operation: "providerResolve"` request (§M8).
        pub openshell_lifetime: Option<OpenShellLifetimeData>,
    }

    /// Redacts every value: secret-bearing fields print as presence flags, and
    /// `openshell_values` prints its env-var names only.
    impl std::fmt::Debug for CredentialResponseData {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.debug_struct("CredentialResponseData")
                .field("approved", &self.approved)
                .field("has_username", &self.username.is_some())
                .field("has_password", &self.password.is_some())
                .field("has_totp", &self.totp.is_some())
                .field("has_secret_value", &self.secret_value.is_some())
                .field("credential_id", &self.credential_id)
                .field("secret_id", &self.secret_id)
                .field("reason", &self.reason)
                .field(
                    "openshell_value_keys",
                    &self.openshell_values.as_ref().map(|values| {
                        values
                            .iter()
                            .map(|value| value.credential_key.as_str())
                            .collect::<Vec<_>>()
                    }),
                )
                .field("openshell_lifetime", &self.openshell_lifetime)
                .finish()
        }
    }

    /// Converts the renderer's OpenShell answer into the core resolution. `None` (which the
    /// reply builder turns into `invalid approval payload`) when the lifetime is missing or its
    /// `expiresAtMs` isn't a plain decimal u64 — never a guessed default.
    fn openshell_resolution(
        values: Option<Vec<ProviderValueData>>,
        lifetime: Option<OpenShellLifetimeData>,
    ) -> Option<agent_access_core::OpenShellResolution> {
        let lifetime = lifetime?;
        let expires_at_ms = match lifetime.expires_at_ms.as_deref() {
            None => None,
            Some(raw) if !raw.is_empty() && raw.bytes().all(|b| b.is_ascii_digit()) => {
                Some(raw.parse::<u64>().ok()?)
            }
            Some(_) => return None,
        };
        Some(agent_access_core::OpenShellResolution {
            lifetime: agent_access_core::OpenShellLifetime {
                mode: lifetime.mode.into(),
                expires_at_ms,
            },
            values: values
                .unwrap_or_default()
                .into_iter()
                .map(|value| agent_access_core::ProviderValue {
                    credential_key: value.credential_key,
                    value: zeroize::Zeroizing::new(value.value),
                })
                .collect(),
        })
    }

    impl From<CredentialResponseData> for agent_access_core::CredentialResponseData {
        fn from(data: CredentialResponseData) -> Self {
            Self {
                approved: data.approved,
                username: data.username,
                password: data.password,
                totp: data.totp,
                uri: data.uri,
                notes: data.notes,
                credential_id: data.credential_id,
                reason: data.reason.as_deref().and_then(map_denial_reason),
                item_name: data.item_name,
                secret_value: data.secret_value.map(zeroize::Zeroizing::new),
                secret_id: data.secret_id,
                project_id: data.project_id,
                projects: data.projects.map(|entries| {
                    entries
                        .into_iter()
                        .map(agent_access_core::ProjectEntry::from)
                        .collect()
                }),
                fill_result: data.fill_result,
                fill_target: data.fill_target,
                denial_detail: data.denial_detail,
                fill_fields_shared: data.fill_fields_shared,
                openshell: openshell_resolution(data.openshell_values, data.openshell_lifetime),
            }
        }
    }

    /// Maps the `reason` string Electron sends on `CredentialResponseData` to
    /// [`agent_access_core::CredentialDenialReason`]. Accepts both `camelCase` (the documented
    /// wire/napi convention — `"notFound"`, `"originMismatch"`, `"noSafeTarget"`) and
    /// `snake_case` (`"not_found"`, `"origin_mismatch"`, `"no_safe_target"`): the TS model has
    /// been observed sending the latter for `"not_found"`, which this match used to reject
    /// outright, silently downgrading a genuine "nothing matched the query" into "Denied by
    /// user" (agent-access-architecture.md's "M5" section calls this out explicitly as a bug to
    /// fix while in this seam). Accepting both spellings is strictly more permissive than before
    /// and never changes behavior for a caller that was already sending the documented form.
    fn map_denial_reason(reason: &str) -> Option<agent_access_core::CredentialDenialReason> {
        match reason {
            "notFound" | "not_found" => Some(agent_access_core::CredentialDenialReason::NotFound),
            "denied" => Some(agent_access_core::CredentialDenialReason::Denied),
            "locked" => Some(agent_access_core::CredentialDenialReason::Locked),
            "error" => Some(agent_access_core::CredentialDenialReason::Internal),
            "originMismatch" | "origin_mismatch" => {
                Some(agent_access_core::CredentialDenialReason::OriginMismatch)
            }
            "noSafeTarget" | "no_safe_target" => {
                Some(agent_access_core::CredentialDenialReason::NoSafeTarget)
            }
            "timeout" => Some(agent_access_core::CredentialDenialReason::Timeout),
            _ => None,
        }
    }

    #[cfg(test)]
    mod denial_reason_tests {
        use super::*;

        #[test]
        fn accepts_both_camel_case_and_snake_case_spellings() {
            let cases = [
                (
                    "notFound",
                    Some(agent_access_core::CredentialDenialReason::NotFound),
                ),
                (
                    "not_found",
                    Some(agent_access_core::CredentialDenialReason::NotFound),
                ),
                (
                    "denied",
                    Some(agent_access_core::CredentialDenialReason::Denied),
                ),
                (
                    "locked",
                    Some(agent_access_core::CredentialDenialReason::Locked),
                ),
                (
                    "error",
                    Some(agent_access_core::CredentialDenialReason::Internal),
                ),
                (
                    "originMismatch",
                    Some(agent_access_core::CredentialDenialReason::OriginMismatch),
                ),
                (
                    "origin_mismatch",
                    Some(agent_access_core::CredentialDenialReason::OriginMismatch),
                ),
                (
                    "noSafeTarget",
                    Some(agent_access_core::CredentialDenialReason::NoSafeTarget),
                ),
                (
                    "no_safe_target",
                    Some(agent_access_core::CredentialDenialReason::NoSafeTarget),
                ),
                ("somethingElse", None),
                ("", None),
            ];

            for (input, expected) in cases {
                assert_eq!(
                    map_denial_reason(input),
                    expected,
                    "input {input:?} mapped incorrectly"
                );
            }
        }

        /// The exact regression this fix closes: `"not_found"` used to fall through to `None`,
        /// which `local_protocol::build_response` maps the same as an explicit user denial
        /// (`"Denied by user"`) — reporting a no-match as though a human had rejected the
        /// request.
        #[test]
        fn not_found_snake_case_no_longer_downgrades_to_a_generic_denial() {
            assert_eq!(
                map_denial_reason("not_found"),
                Some(agent_access_core::CredentialDenialReason::NotFound)
            );
        }
    }

    /// M6 ("Full Secrets Manager surface") DTO-conversion tests: the request-side additions
    /// (`targetId`/`generateValue`/`generateLength`/`generateSymbols`), the
    /// `ResourceType::Project`/ `OperationType::{Update,Delete,List}` mirrors, and the
    /// response-side project list (`projectId`/`projects`/`AgentAccessProjectEntry`).
    #[cfg(test)]
    mod m6_conversion_tests {
        use super::*;

        fn base_core_request() -> agent_access_core::CredentialRequestData {
            agent_access_core::CredentialRequestData {
                query_type: agent_access_core::CredentialQueryKind::Id,
                query_value: "target-1".to_string(),
                requester_fingerprint: None,
                requester_name: None,
                origin: agent_access_core::CredentialRequestOrigin::Local,
                local_peer: None,
                delivery_mode: None,
                resource: agent_access_core::ResourceKind::Secret,
                operation: agent_access_core::RequestOperation::Update,
                new_secret_name: None,
                new_secret_value: None,
                new_secret_note: None,
                project_hint: None,
                target_id: Some("target-1".to_string()),
                generate_value: false,
                generate_length: None,
                generate_symbols: None,
                fill_fields: None,
                fill_target_token: None,
                openshell: None,
                provider_targets: Vec::new(),
            }
        }

        /// CRITICAL regression guard: `Some("")` on `new_secret_note` (the wire contract's
        /// "clear the note" signal, M6) must survive the core -> napi request conversion
        /// unchanged — never collapsed to `None`, which would silently turn an intended note
        /// clear into a no-op.
        #[test]
        fn note_empty_string_survives_the_request_conversion() {
            let mut core_request = base_core_request();
            core_request.new_secret_note = Some(String::new());
            let napi_request = CredentialRequestData::from(core_request);
            assert_eq!(napi_request.new_secret_note.as_deref(), Some(""));
        }

        #[test]
        fn note_absent_stays_absent() {
            let core_request = base_core_request();
            let napi_request = CredentialRequestData::from(core_request);
            assert!(napi_request.new_secret_note.is_none());
        }

        #[test]
        fn target_id_and_generate_flags_convert_verbatim() {
            let mut core_request = base_core_request();
            core_request.target_id = Some("secret-1".to_string());
            core_request.generate_value = true;
            core_request.generate_length = Some(64);
            core_request.generate_symbols = Some(false);
            let napi_request = CredentialRequestData::from(core_request);
            assert_eq!(napi_request.target_id.as_deref(), Some("secret-1"));
            assert_eq!(napi_request.generate_value, Some(true));
            assert_eq!(napi_request.generate_length, Some(64));
            assert_eq!(napi_request.generate_symbols, Some(false));
        }

        #[test]
        fn generate_value_false_converts_to_some_false_not_none() {
            // `generate_value` is a plain `bool` in `agent_access_core` (always present) but an
            // optional `boolean` on the napi/TS surface (per the hand-applied `index.d.ts`) —
            // the conversion must produce `Some(false)`, not `None`, so the renderer sees an
            // explicit "no" rather than an absent field it might otherwise mis-default.
            let core_request = base_core_request();
            let napi_request = CredentialRequestData::from(core_request);
            assert_eq!(napi_request.generate_value, Some(false));
        }

        #[test]
        fn resource_type_project_round_trips() {
            assert!(matches!(
                ResourceType::from(agent_access_core::ResourceKind::Project),
                ResourceType::Project
            ));
        }

        #[test]
        fn operation_type_update_delete_list_round_trip() {
            assert!(matches!(
                OperationType::from(agent_access_core::RequestOperation::Update),
                OperationType::Update
            ));
            assert!(matches!(
                OperationType::from(agent_access_core::RequestOperation::Delete),
                OperationType::Delete
            ));
            assert!(matches!(
                OperationType::from(agent_access_core::RequestOperation::List),
                OperationType::List
            ));
        }

        #[test]
        fn project_entry_converts_to_core() {
            let entry = AgentAccessProjectEntry {
                id: "project-1".to_string(),
                name: "My Project".to_string(),
                write: true,
                organization: Some("Acme".to_string()),
            };
            let core_entry = agent_access_core::ProjectEntry::from(entry);
            assert_eq!(core_entry.id, "project-1");
            assert_eq!(core_entry.name, "My Project");
            assert!(core_entry.write);
            assert_eq!(core_entry.organization.as_deref(), Some("Acme"));
        }

        #[test]
        fn response_project_id_and_projects_convert() {
            let response = CredentialResponseData {
                approved: true,
                username: None,
                password: None,
                totp: None,
                uri: None,
                notes: None,
                credential_id: None,
                reason: None,
                item_name: None,
                secret_value: None,
                secret_id: None,
                project_id: Some("project-1".to_string()),
                projects: Some(vec![AgentAccessProjectEntry {
                    id: "project-1".to_string(),
                    name: "My Project".to_string(),
                    write: true,
                    organization: None,
                }]),
                fill_result: None,
                fill_target: None,
                denial_detail: None,
                fill_fields_shared: None,
                openshell_values: None,
                openshell_lifetime: None,
            };
            let core_response: agent_access_core::CredentialResponseData = response.into();
            assert_eq!(core_response.project_id.as_deref(), Some("project-1"));
            let projects = core_response.projects.expect("projects expected");
            assert_eq!(projects.len(), 1);
            assert_eq!(projects[0].id, "project-1");
            assert_eq!(projects[0].name, "My Project");
            assert!(projects[0].write);
            assert!(projects[0].organization.is_none());
        }
    }

    /// §M8.14 "napi" conversion tests: origin, operation, field, lifetime and context types,
    /// plus the response-side value/lifetime conversion and its Debug redaction.
    #[cfg(test)]
    mod openshell_conversion_tests {
        use super::*;

        fn core_context() -> agent_access_core::OpenShellContext {
            agent_access_core::OpenShellContext {
                deadline: std::time::Duration::from_millis(25_000),
                gateway_name: "openshell".to_string(),
                gateway_endpoint: "https://127.0.0.1:17670".to_string(),
                provider_id: "prov-7f3a".to_string(),
                provider_name: "gh-agent-1".to_string(),
                provider_profile: "github".to_string(),
                workspace: "default".to_string(),
                sandbox_id: "sbx-01J9Z6".to_string(),
                sandbox_name: "agent-1".to_string(),
                sandbox_image: None,
                endpoints: vec![agent_access_core::OpenShellEndpoint {
                    host: "api.github.com".to_string(),
                    port: 443,
                    path: Some("/**".to_string()),
                    source: agent_access_core::OpenShellEndpointSource::PolicyBinding,
                }],
                policy_digest:
                    "sha256:998f40a71463c9250c9eaf7bcb560234fc838a2bf7592b260165f9b4af110020"
                        .to_string(),
                advisor_enabled: None,
            }
        }

        fn response(
            values: Option<Vec<ProviderValueData>>,
            lifetime: Option<OpenShellLifetimeData>,
        ) -> CredentialResponseData {
            CredentialResponseData {
                approved: true,
                username: None,
                password: None,
                totp: None,
                uri: None,
                notes: None,
                credential_id: None,
                reason: None,
                item_name: None,
                secret_value: None,
                secret_id: None,
                project_id: None,
                projects: None,
                fill_result: None,
                fill_target: None,
                denial_detail: None,
                fill_fields_shared: None,
                openshell_values: values,
                openshell_lifetime: lifetime,
            }
        }

        fn value(key: &str, value: &str) -> ProviderValueData {
            ProviderValueData {
                credential_key: key.to_string(),
                value: value.to_string(),
            }
        }

        #[test]
        fn origin_operation_and_enums_convert() {
            assert!(matches!(
                CredentialRequestOrigin::from(
                    agent_access_core::CredentialRequestOrigin::OpenShell
                ),
                CredentialRequestOrigin::OpenShell
            ));
            assert!(matches!(
                OperationType::from(agent_access_core::RequestOperation::ProviderResolve),
                OperationType::ProviderResolve
            ));
            assert!(matches!(
                ProviderField::from(agent_access_core::ProviderField::Value),
                ProviderField::Value
            ));
            assert_eq!(
                agent_access_core::OpenShellLifetimeMode::from(
                    OpenShellLifetimeMode::SandboxLifetime
                ),
                agent_access_core::OpenShellLifetimeMode::SandboxLifetime
            );
        }

        #[test]
        fn context_and_targets_convert_verbatim() {
            let context = OpenShellContextData::from(core_context());
            assert_eq!(context.deadline_ms, 25_000);
            assert_eq!(context.provider_id, "prov-7f3a");
            assert_eq!(context.sandbox_name, "agent-1");
            assert_eq!(context.endpoints[0].port, 443);
            assert!(matches!(
                context.endpoints[0].source,
                OpenShellEndpointSource::PolicyBinding
            ));
            let target = ProviderTargetData::from(agent_access_core::ProviderTarget {
                credential_key: "DB_PASSWORD".to_string(),
                resource: agent_access_core::ResourceKind::Secret,
                id: "a7e2d4c1-6b3f-4e8a-9d10-2c5b6a7f8e9d".to_string(),
                field: agent_access_core::ProviderField::Value,
            });
            assert!(matches!(target.resource_type, ResourceType::Secret));
            assert!(matches!(target.field, ProviderField::Value));
        }

        #[test]
        fn a_ttl_answer_converts_into_a_resolution() {
            let core: agent_access_core::CredentialResponseData = response(
                Some(vec![value("GITHUB_TOKEN", "pw")]),
                Some(OpenShellLifetimeData {
                    mode: OpenShellLifetimeMode::Ttl,
                    expires_at_ms: Some("1791234567890".to_string()),
                }),
            )
            .into();
            let resolution = core.openshell.expect("resolution");
            assert_eq!(resolution.lifetime.expires_at_ms, Some(1_791_234_567_890));
            assert_eq!(resolution.values[0].credential_key, "GITHUB_TOKEN");
            assert_eq!(resolution.values[0].value.as_str(), "pw");
        }

        #[test]
        fn a_malformed_or_missing_lifetime_yields_no_resolution() {
            for expires in ["", "-1", "1e3", "12.5", " 1", "99999999999999999999999"] {
                let core: agent_access_core::CredentialResponseData = response(
                    Some(vec![value("GITHUB_TOKEN", "pw")]),
                    Some(OpenShellLifetimeData {
                        mode: OpenShellLifetimeMode::Ttl,
                        expires_at_ms: Some(expires.to_string()),
                    }),
                )
                .into();
                assert!(core.openshell.is_none(), "{expires:?}");
            }
            let core: agent_access_core::CredentialResponseData =
                response(Some(vec![value("GITHUB_TOKEN", "pw")]), None).into();
            assert!(core.openshell.is_none());
        }

        #[test]
        fn timeout_reason_maps_to_timeout() {
            assert_eq!(
                map_denial_reason("timeout"),
                Some(agent_access_core::CredentialDenialReason::Timeout)
            );
        }

        #[test]
        fn response_debug_redacts_openshell_values() {
            let data = response(
                Some(vec![value("GITHUB_TOKEN", "super-secret-value")]),
                Some(OpenShellLifetimeData {
                    mode: OpenShellLifetimeMode::SandboxLifetime,
                    expires_at_ms: None,
                }),
            );
            let rendered = format!("{data:?}");
            assert!(!rendered.contains("super-secret-value"));
            assert!(rendered.contains("GITHUB_TOKEN"));
        }

        #[test]
        fn request_debug_prints_ids_not_names() {
            let mut request = agent_access_core::CredentialRequestData {
                query_type: agent_access_core::CredentialQueryKind::Id,
                query_value: String::new(),
                requester_fingerprint: None,
                requester_name: None,
                origin: agent_access_core::CredentialRequestOrigin::OpenShell,
                local_peer: None,
                delivery_mode: None,
                resource: agent_access_core::ResourceKind::Credential,
                operation: agent_access_core::RequestOperation::ProviderResolve,
                new_secret_name: None,
                new_secret_value: None,
                new_secret_note: None,
                project_hint: None,
                target_id: None,
                generate_value: false,
                generate_length: None,
                generate_symbols: None,
                fill_fields: None,
                fill_target_token: None,
                openshell: Some(core_context()),
                provider_targets: Vec::new(),
            };
            let napi_request = CredentialRequestData::from(request.clone());
            assert!(napi_request.provider_targets.is_none());
            let rendered = format!("{napi_request:?}");
            assert!(rendered.contains("prov-7f3a"));
            assert!(!rendered.contains("gh-agent-1"));
            request
                .provider_targets
                .push(agent_access_core::ProviderTarget {
                    credential_key: "GITHUB_TOKEN".to_string(),
                    resource: agent_access_core::ResourceKind::Credential,
                    id: "3f1c2b9e-8a4d-4c7e-9b21-5d6f7a8b9c0d".to_string(),
                    field: agent_access_core::ProviderField::Password,
                });
            assert_eq!(
                CredentialRequestData::from(request)
                    .provider_targets
                    .map(|targets| targets.len()),
                Some(1)
            );
        }
    }

    /// A handshake fingerprint pending user verification (rendezvous pairing only).
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct FingerprintVerificationData {
        pub fingerprint: String,
        pub identity_fingerprint: String,
    }

    impl From<agent_access_core::FingerprintVerificationData> for FingerprintVerificationData {
        fn from(data: agent_access_core::FingerprintVerificationData) -> Self {
            Self {
                fingerprint: data.fingerprint,
                identity_fingerprint: data.identity_fingerprint,
            }
        }
    }

    /// Electron's answer to a [`FingerprintVerificationData`].
    #[napi(object)]
    #[derive(Debug, Clone, Default)]
    pub struct FingerprintVerificationResponse {
        pub approved: bool,
        pub name: Option<String>,
    }

    impl From<FingerprintVerificationResponse> for agent_access_core::FingerprintVerificationResponse {
        fn from(data: FingerprintVerificationResponse) -> Self {
            Self {
                approved: data.approved,
                name: data.name,
            }
        }
    }

    /// One key/value pair for the `storageSetCallback`. `value: None` means "delete this key".
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct StorageEntry {
        pub key: String,
        pub value: Option<String>,
    }

    /// Summary of a cached connection for the `listConnections()` surface.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct ConnectionInfoData {
        pub fingerprint: String,
        pub name: Option<String>,
        /// Unix timestamp (seconds), stringified to avoid any JS numeric-precision surprises.
        pub cached_at: Option<String>,
        /// Unix timestamp (seconds), stringified to avoid any JS numeric-precision surprises.
        pub last_connected_at: Option<String>,
    }

    impl From<agent_access_core::ConnectionSummary> for ConnectionInfoData {
        fn from(summary: agent_access_core::ConnectionSummary) -> Self {
            Self {
                fingerprint: summary.fingerprint,
                name: summary.name,
                cached_at: Some(summary.cached_at.to_string()),
                last_connected_at: Some(summary.last_connected_at.to_string()),
            }
        }
    }

    /// A single agent-access activity event for the desktop's live activity log.
    ///
    /// SECURITY: never carries credential values, PSKs, tokens, or key material — see
    /// `agent_access_core::AgentAccessEvent`'s docs, which this mirrors field-for-field.
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct AgentAccessEvent {
        pub kind: String,
        /// Unix epoch milliseconds, stringified to avoid JS numeric-precision surprises.
        pub timestamp_ms: String,
        pub peer_fingerprint: Option<String>,
        pub peer_name: Option<String>,
        pub detail: Option<String>,
        /// Comma-joined field names released by a `credentialApproved` event (e.g.
        /// `"username,password,totp"`).
        pub fields_shared: Option<String>,
    }

    impl From<agent_access_core::AgentAccessEvent> for AgentAccessEvent {
        fn from(event: agent_access_core::AgentAccessEvent) -> Self {
            Self {
                kind: event.kind,
                timestamp_ms: event.timestamp_ms,
                peer_fingerprint: event.peer_fingerprint,
                peer_name: event.peer_name,
                detail: event.detail,
                fields_shared: event.fields_shared,
            }
        }
    }

    // -----------------------------------------------------------------------------------
    // Callback adapters — bridge agent_access_core's host traits to Electron callbacks
    // -----------------------------------------------------------------------------------

    struct ElectronCredentialHandler {
        callback: ThreadsafeFunction<CredentialRequestData, Promise<CredentialResponseData>>,
    }

    #[async_trait]
    impl agent_access_core::CredentialRequestHandler for ElectronCredentialHandler {
        async fn handle_credential_request(
            &self,
            request: agent_access_core::CredentialRequestData,
        ) -> Result<agent_access_core::CredentialResponseData, agent_access_core::CallbackError>
        {
            let response =
                invoke_callback(&self.callback, CredentialRequestData::from(request)).await?;
            Ok(response.into())
        }
    }

    struct ElectronFingerprintVerifier {
        callback: ThreadsafeFunction<
            FingerprintVerificationData,
            Promise<FingerprintVerificationResponse>,
        >,
    }

    #[async_trait]
    impl agent_access_core::FingerprintVerifier for ElectronFingerprintVerifier {
        async fn verify_fingerprint(
            &self,
            request: agent_access_core::FingerprintVerificationData,
        ) -> Result<
            agent_access_core::FingerprintVerificationResponse,
            agent_access_core::CallbackError,
        > {
            let response =
                invoke_callback(&self.callback, FingerprintVerificationData::from(request)).await?;
            Ok(response.into())
        }
    }

    struct ElectronKvStorage {
        get_callback: ThreadsafeFunction<String, Promise<Option<String>>>,
        set_callback: ThreadsafeFunction<StorageEntry, Promise<()>>,
    }

    #[async_trait]
    impl agent_access_core::KvStorage for ElectronKvStorage {
        async fn get(&self, key: &str) -> Result<Option<String>, agent_access_core::CallbackError> {
            invoke_callback(&self.get_callback, key.to_string()).await
        }

        async fn set(
            &self,
            key: &str,
            value: Option<&str>,
        ) -> Result<(), agent_access_core::CallbackError> {
            invoke_callback(
                &self.set_callback,
                StorageEntry {
                    key: key.to_string(),
                    value: value.map(str::to_string),
                },
            )
            .await
        }
    }

    /// Bridges `agent_access_core::EventSink` to an Electron `ThreadsafeFunction`.
    ///
    /// Unlike the other adapters in this module, [`EventSink::on_event`] is fire-and-forget by
    /// contract (see `agent_access_core`'s docs): the JS callback is invoked under
    /// [`EVENT_CALLBACK_TIMEOUT`], and every possible outcome — success, a thrown/rejected
    /// promise, or a timeout — is discarded here. An activity-log delivery failure must never
    /// propagate back into the protocol event loop or notification drain that produced the
    /// event, so this only logs at `debug` on failure, never `warn`/`error`.
    struct ElectronEventSink {
        callback: ThreadsafeFunction<AgentAccessEvent, Promise<()>>,
    }

    #[async_trait]
    impl agent_access_core::EventSink for ElectronEventSink {
        async fn on_event(&self, event: agent_access_core::AgentAccessEvent) {
            let kind = event.kind.clone();
            let outcome = timeout(
                EVENT_CALLBACK_TIMEOUT,
                invoke_callback(&self.callback, AgentAccessEvent::from(event)),
            )
            .await;

            match outcome {
                Ok(Ok(())) => {}
                Ok(Err(err)) => {
                    debug!(%err, kind, "agent_access: event sink callback failed, discarding");
                }
                Err(_) => {
                    debug!(
                        kind,
                        "agent_access: event sink callback timed out, discarding"
                    );
                }
            }
        }
    }

    // -----------------------------------------------------------------------------------
    // AgentAccessState
    // -----------------------------------------------------------------------------------

    /// Configuration for [`AgentAccessState::serve`].
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct AgentAccessConfig {
        /// WebSocket URL of the Agent Access relay.
        pub relay_url: String,
        /// Path to the local Unix socket / Windows named pipe to listen on for the `aac` CLI.
        /// Main-process-owned: computed by `MainAgentAccessService`, never sourced from the
        /// renderer's `INIT` payload. `undefined`/`null` skips the local listener entirely.
        pub socket_path: Option<String>,
    }

    impl From<AgentAccessConfig> for agent_access_core::AgentAccessConfig {
        fn from(config: AgentAccessConfig) -> Self {
            Self {
                relay_url: config.relay_url,
                socket_path: config.socket_path,
            }
        }
    }

    /// Wrapper for Electron to interface with the Agent Access desktop integration.
    #[napi]
    pub struct AgentAccessState {
        inner: agent_access_core::DesktopAgentAccess,
    }

    #[napi]
    impl AgentAccessState {
        /// Connects to the relay, optionally starts the local listener, and starts serving
        /// credential requests from both.
        ///
        /// # Arguments
        ///
        /// * `config` - Relay URL and (optional) local socket/pipe path.
        /// * `credential_callback` - Looks the credential up in the unlocked vault and prompts the
        ///   user for approval.
        /// * `fingerprint_callback` - Prompts the user to verify a rendezvous handshake
        ///   fingerprint. Always invoked for rendezvous pairings — never auto-approved.
        /// * `storage_get_callback` / `storage_set_callback` - Back identity/connection/PSK
        ///   persistence (e.g. the OS keychain).
        /// * `event_callback` - Receives a best-effort activity-log event stream (connections,
        ///   credential requests, relay reconnects, ...) for the desktop's activity log.
        ///   Fire-and-forget: invoked under a short timeout, and any failure/timeout is discarded —
        ///   it can never affect protocol behavior.
        #[napi(factory)]
        pub async fn serve(
            config: AgentAccessConfig,
            credential_callback: ThreadsafeFunction<
                CredentialRequestData,
                Promise<CredentialResponseData>,
            >,
            fingerprint_callback: ThreadsafeFunction<
                FingerprintVerificationData,
                Promise<FingerprintVerificationResponse>,
            >,
            storage_get_callback: ThreadsafeFunction<String, Promise<Option<String>>>,
            storage_set_callback: ThreadsafeFunction<StorageEntry, Promise<()>>,
            event_callback: ThreadsafeFunction<AgentAccessEvent, Promise<()>>,
        ) -> napi::Result<Self> {
            let inner = agent_access_core::DesktopAgentAccess::new();

            let credential_handler: Arc<dyn agent_access_core::CredentialRequestHandler> =
                Arc::new(ElectronCredentialHandler {
                    callback: credential_callback,
                });
            let fingerprint_verifier: Arc<dyn agent_access_core::FingerprintVerifier> =
                Arc::new(ElectronFingerprintVerifier {
                    callback: fingerprint_callback,
                });
            let storage: Arc<dyn agent_access_core::KvStorage> = Arc::new(ElectronKvStorage {
                get_callback: storage_get_callback,
                set_callback: storage_set_callback,
            });
            let event_sink: Arc<dyn agent_access_core::EventSink> = Arc::new(ElectronEventSink {
                callback: event_callback,
            });

            inner
                .start(
                    config.into(),
                    credential_handler,
                    fingerprint_verifier,
                    storage,
                    event_sink,
                )
                .await
                .map_err(|error| {
                    error!(%error, "Failed to start agent access.");
                    napi::Error::from_reason(error.to_string())
                })?;

            Ok(Self { inner })
        }

        #[napi]
        pub fn stop(&self) {
            self.inner.stop();
        }

        /// Starts (path) or stops (null/undefined) the OpenShell listener. Idempotent.
        ///
        /// The path is computed by the main process, never taken from the renderer (§M8.8).
        #[napi]
        #[allow(clippy::unused_async)]
        pub async fn set_open_shell_listener(
            &self,
            socket_path: Option<String>,
        ) -> napi::Result<()> {
            match socket_path {
                Some(path) => self
                    .inner
                    .start_openshell_listener(path)
                    .map_err(|e| napi::Error::from_reason(e.to_string())),
                None => {
                    self.inner.stop_openshell_listener();
                    Ok(())
                }
            }
        }

        #[napi]
        pub fn is_running(&self) -> bool {
            self.inner.is_running()
        }

        #[napi]
        pub async fn get_fingerprint(&self) -> napi::Result<String> {
            self.inner
                .get_fingerprint()
                .await
                .map_err(|e| napi::Error::from_reason(e.to_string()))
        }

        #[napi]
        pub async fn generate_psk_token(
            &self,
            name: Option<String>,
            reusable: bool,
        ) -> napi::Result<String> {
            self.inner
                .generate_psk_token(name, reusable)
                .await
                .map_err(|e| napi::Error::from_reason(e.to_string()))
        }

        #[napi]
        pub async fn generate_rendezvous_code(&self, name: Option<String>) -> napi::Result<String> {
            self.inner
                .generate_rendezvous_code(name)
                .await
                .map_err(|e| napi::Error::from_reason(e.to_string()))
        }

        #[napi]
        pub async fn list_connections(&self) -> napi::Result<Vec<ConnectionInfoData>> {
            let connections = self
                .inner
                .list_connections()
                .await
                .map_err(|e| napi::Error::from_reason(e.to_string()))?;
            Ok(connections
                .into_iter()
                .map(ConnectionInfoData::from)
                .collect())
        }

        #[napi]
        pub async fn remove_connection(&self, fingerprint: String) -> napi::Result<()> {
            self.inner
                .remove_connection(fingerprint)
                .await
                .map_err(|e| napi::Error::from_reason(e.to_string()))
        }
    }
}
