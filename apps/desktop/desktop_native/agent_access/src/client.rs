//! Orchestrates the `ap_client::UserClient` connection lifecycle for the desktop app.
//!
//! This is where the Phase A business logic lives — the napi layer
//! (`napi/src/agent_access.rs`) is pass-through: convert DTOs, wrap host callbacks in a
//! timeout, done. In particular the deny-by-default timeout behavior tested here is the same
//! behavior the napi layer relies on, just exercised with plain-Rust mocks instead of JS
//! callbacks.

use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use ap_client::{
    CredentialData, CredentialRequestReply, DefaultRelayClient, FingerprintVerificationReply,
    UserClient, UserClientHandle, UserClientNotification, UserClientRequest,
};
use tokio::{sync::mpsc, task::JoinHandle};
use tracing::{debug, warn};
use zeroize::Zeroizing;

use crate::{
    audit::ForwardingAuditLog,
    callbacks::{
        AgentAccessEvent, CredentialQueryKind, CredentialRequestData, CredentialRequestHandler,
        CredentialRequestOrigin, EventSink, FingerprintVerificationData, FingerprintVerifier,
        KvStorage, RequestOperation, ResourceKind,
    },
    error::AgentAccessError,
    local_listener,
    storage::{ConnectionSummary, KvConnectionStore, KvIdentityProvider, KvPskStore},
};

/// How long to wait for a host callback (credential lookup or fingerprint verification)
/// before treating the request as denied. Mirrors `sshagent_v2::APPROVAL_CALLBACK_TIMEOUT`.
///
/// `pub(crate)` so the local listener's connection handler (`local_listener::handle_connection`)
/// can wrap its own `credential_handler` call in the *same* timeout the relay dispatch loop
/// below uses — one deny-by-default budget shared by both ingress paths, not two that could
/// drift apart.
pub(crate) const CALLBACK_TIMEOUT: Duration = Duration::from_secs(60);

/// Configuration for [`DesktopAgentAccess::start`].
#[derive(Debug, Clone)]
pub struct AgentAccessConfig {
    /// WebSocket URL of the Agent Access relay (remote/paired-agent path).
    pub relay_url: String,
    /// Path to the local Unix socket / Windows named pipe to listen on for the `aac` CLI.
    /// `None` skips starting the local listener entirely (relay-only).
    pub socket_path: Option<String>,
}

struct Running {
    client: UserClient,
    own_fingerprint: String,
    connection_store: KvConnectionStore,
    dispatch_task: JoinHandle<()>,
    notification_task: JoinHandle<()>,
    /// `None` when `AgentAccessConfig::socket_path` was `None` at `start()` time.
    local_listener_task: Option<JoinHandle<()>>,
    /// The same single enforcement point the agent socket uses — kept so the OpenShell listener
    /// (§M8) can be started later, on the toggle, without a second handler ever existing.
    credential_handler: Arc<dyn CredentialRequestHandler>,
    event_sink: Arc<dyn EventSink>,
    /// The toggle-gated OpenShell listener (§M8.7).
    openshell_listener: OpenShellListenerSlot,
}

/// Holds at most one running OpenShell listener. Separate from [`Running`] so its start/stop
/// idempotency can be unit-tested without a relay connection.
#[derive(Default)]
struct OpenShellListenerSlot {
    current: Option<OpenShellListener>,
}

impl OpenShellListenerSlot {
    /// Starts the listener on `socket_path`. Idempotent for the same path; a different path
    /// replaces the running listener.
    fn start(
        &mut self,
        socket_path: String,
        credential_handler: &Arc<dyn CredentialRequestHandler>,
        event_sink: &Arc<dyn EventSink>,
    ) -> Result<(), AgentAccessError> {
        if let Some(existing) = &self.current {
            if existing.socket_path == socket_path && !existing.task.is_finished() {
                return Ok(());
            }
        }
        self.stop();
        let task = local_listener::spawn(
            socket_path.clone(),
            local_listener::ListenerKind::OpenShell,
            Arc::clone(credential_handler),
            Arc::clone(event_sink),
        )?;
        self.current = Some(OpenShellListener { task, socket_path });
        Ok(())
    }

    /// Stops the listener, if any. Idempotent.
    fn stop(&mut self) {
        if let Some(listener) = self.current.take() {
            listener.shutdown();
        }
    }

    fn is_listening(&self) -> bool {
        self.current
            .as_ref()
            .is_some_and(|listener| !listener.task.is_finished())
    }
}

/// A running OpenShell listener: its accept-loop task and the socket path it bound.
struct OpenShellListener {
    task: JoinHandle<()>,
    socket_path: String,
}

impl OpenShellListener {
    /// Aborts the accept loop (which aborts every in-flight OpenShell connection with it — see
    /// `local_listener::accept_loop`) and unlinks the socket file, so the socket exists only
    /// while the toggle is on (§M8 invariant 20).
    fn shutdown(self) {
        self.task.abort();
        #[cfg(unix)]
        {
            let _ = std::fs::remove_file(&self.socket_path);
        }
    }
}

/// Desktop-side "UserClient" (listener) role of the Agent Access protocol.
///
/// Owns the `ap_client::UserClient` connection and its background dispatch task. All
/// credential and fingerprint decisions are delegated to the caller-supplied
/// [`CredentialRequestHandler`] / [`FingerprintVerifier`] — this type never decides on its own
/// whether to release vault data, and never performs cryptography itself.
///
/// `inner` is a blocking [`std::sync::Mutex`] rather than an async one so that `stop()` and
/// `is_running()` can be genuinely synchronous (matching the napi surface's `stop(): void` /
/// `isRunning(): boolean`, neither of which return a `Promise`). Every method that touches
/// `inner` clones what it needs and drops the guard before doing any `.await`.
pub struct DesktopAgentAccess {
    running: AtomicBool,
    inner: Mutex<Option<Running>>,
}

impl Default for DesktopAgentAccess {
    fn default() -> Self {
        Self::new()
    }
}

impl DesktopAgentAccess {
    pub fn new() -> Self {
        Self {
            running: AtomicBool::new(false),
            inner: Mutex::new(None),
        }
    }

    /// Connects to the relay, optionally starts the local listener, and begins serving
    /// credential/fingerprint requests from both.
    ///
    /// `storage` backs identity, connection cache, and PSK persistence — see the [`storage`
    /// module](crate::storage) for the on-disk formats. `credential_handler` and
    /// `fingerprint_verifier` are invoked for every inbound request under a 60s timeout;
    /// timeout or failure always denies (see [`spawn_dispatch`] for the relay path,
    /// [`local_listener`] for the local path — both share [`CALLBACK_TIMEOUT`], the single
    /// enforcement point invariant from agent-access-architecture.md). `event_sink` receives a
    /// best-effort activity-log stream (see [`crate::callbacks::EventSink`]) — its relay-side
    /// source is [`ForwardingAuditLog`], plus a curated subset of `ap_client`'s status
    /// notifications (see [`spawn_notification_drain`]); the local listener forwards its own
    /// request/approval events directly.
    pub async fn start(
        &self,
        config: AgentAccessConfig,
        credential_handler: Arc<dyn CredentialRequestHandler>,
        fingerprint_verifier: Arc<dyn FingerprintVerifier>,
        storage: Arc<dyn KvStorage>,
        event_sink: Arc<dyn EventSink>,
    ) -> Result<(), AgentAccessError> {
        if self.running.load(Ordering::SeqCst) {
            return Err(AgentAccessError::AlreadyRunning);
        }

        let identity_provider = KvIdentityProvider::load_or_generate(storage.as_ref()).await?;
        let own_fingerprint = identity_provider.fingerprint_hex();

        let connection_store = KvConnectionStore::load(Arc::clone(&storage)).await?;
        // ap_client::UserClient::connect takes ownership of a store; keep a clone (shares the
        // same in-memory cache + backing storage) so list/removeConnection keep working.
        let connection_store_for_client = connection_store.clone();

        let psk_store = KvPskStore::load(Arc::clone(&storage)).await?;

        let relay_client = Box::new(DefaultRelayClient::from_url(config.relay_url));

        let UserClientHandle {
            client,
            notifications,
            requests,
        } = UserClient::connect(
            Box::new(identity_provider),
            Box::new(connection_store_for_client),
            relay_client,
            Some(Box::new(ForwardingAuditLog::new(Arc::clone(&event_sink)))),
            Some(Box::new(psk_store)),
        )
        .await
        .map_err(AgentAccessError::Client)?;

        let dispatch_task = spawn_dispatch(
            requests,
            Arc::clone(&credential_handler),
            Arc::clone(&fingerprint_verifier),
            connection_store.clone(),
        );
        // Cloned before `event_sink` is moved into `spawn_notification_drain` below — the local
        // listener needs its own handle to the same sink.
        let local_listener_event_sink = Arc::clone(&event_sink);
        let notification_task = spawn_notification_drain(notifications, event_sink);

        let local_listener_task = match &config.socket_path {
            Some(socket_path) => {
                match local_listener::spawn(
                    socket_path.clone(),
                    local_listener::ListenerKind::Agent,
                    Arc::clone(&credential_handler),
                    Arc::clone(&local_listener_event_sink),
                ) {
                    Ok(task) => Some(task),
                    Err(error) => {
                        // Nothing else has been published to `self.inner` yet — tear down what
                        // was already spawned and bail, same as the relay-connect failure path
                        // above (which returns before spawning anything).
                        dispatch_task.abort();
                        notification_task.abort();
                        return Err(error);
                    }
                }
            }
            None => None,
        };

        let running = Running {
            client,
            own_fingerprint,
            connection_store,
            dispatch_task,
            notification_task,
            local_listener_task,
            credential_handler,
            event_sink: local_listener_event_sink,
            openshell_listener: OpenShellListenerSlot::default(),
        };

        let mut guard = self.inner.lock().expect("agent access state lock poisoned");
        if guard.is_some() {
            drop(guard);
            // Lost a race with a concurrent start() — tear down what we just built.
            running.dispatch_task.abort();
            running.notification_task.abort();
            if let Some(task) = &running.local_listener_task {
                task.abort();
            }
            return Err(AgentAccessError::AlreadyRunning);
        }
        *guard = Some(running);
        drop(guard);
        self.running.store(true, Ordering::SeqCst);

        Ok(())
    }

    /// Stops serving requests and releases the relay connection.
    ///
    /// Aborts the dispatch/notification tasks and drops the last `UserClient` handle, which
    /// closes the command channel the event loop is `select!`ing on (see
    /// `ap_client::clients::user_client::UserClientInner::run_event_loop`), so the event loop
    /// shuts itself down even without the abort.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        let mut guard = self.inner.lock().expect("agent access state lock poisoned");
        if let Some(running) = guard.take() {
            drop(guard);
            running.dispatch_task.abort();
            running.notification_task.abort();
            if let Some(task) = &running.local_listener_task {
                task.abort();
            }
            let mut openshell_listener = running.openshell_listener;
            openshell_listener.stop();
            // `running.client` drops here, closing the last UserClientCommand sender.
        }
    }

    /// Starts the OpenShell listener on `socket_path` (§M8.7). Idempotent: a listener that is
    /// already running on the same path is left alone; one on a different path is replaced.
    /// Fails with [`AgentAccessError::NotRunning`] when the agent itself isn't running — the
    /// OpenShell socket never outlives (or precedes) Agent Access.
    ///
    /// Must be called from within a tokio runtime (the napi async surface always is).
    pub fn start_openshell_listener(&self, socket_path: String) -> Result<(), AgentAccessError> {
        let mut guard = self.inner.lock().expect("agent access state lock poisoned");
        let Some(running) = guard.as_mut() else {
            return Err(AgentAccessError::NotRunning);
        };
        let handler = Arc::clone(&running.credential_handler);
        let sink = Arc::clone(&running.event_sink);
        running
            .openshell_listener
            .start(socket_path, &handler, &sink)
    }

    /// Stops the OpenShell listener, if any. Idempotent, and a no-op when not running.
    pub fn stop_openshell_listener(&self) {
        let mut guard = self.inner.lock().expect("agent access state lock poisoned");
        if let Some(running) = guard.as_mut() {
            running.openshell_listener.stop();
        }
    }

    /// Whether the OpenShell listener is currently running. Diagnostic / test helper.
    pub fn is_openshell_listening(&self) -> bool {
        let guard = self.inner.lock().expect("agent access state lock poisoned");
        guard
            .as_ref()
            .is_some_and(|running| running.openshell_listener.is_listening())
    }

    /// Synchronous check — matches the napi surface's `isRunning(): boolean`.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// The fingerprint is cached at `start()` time, so this never actually awaits anything —
    /// kept `async` (with the lint explicitly silenced, rather than dropped) to match the
    /// `getFingerprint(): Promise<string>` contract every other accessor here follows, so
    /// Phase B's TS surface stays uniform (`await ipc.agentAccess.getFingerprint()`).
    #[allow(clippy::unused_async)]
    pub async fn get_fingerprint(&self) -> Result<String, AgentAccessError> {
        let guard = self.inner.lock().expect("agent access state lock poisoned");
        let fingerprint = guard.as_ref().map(|r| r.own_fingerprint.clone());
        drop(guard);
        fingerprint.ok_or(AgentAccessError::NotRunning)
    }

    pub async fn generate_psk_token(
        &self,
        name: Option<String>,
        reusable: bool,
    ) -> Result<String, AgentAccessError> {
        let client = self.client_handle()?;
        client
            .get_psk_token(name, reusable)
            .await
            .map_err(AgentAccessError::Client)
    }

    pub async fn generate_rendezvous_code(
        &self,
        name: Option<String>,
    ) -> Result<String, AgentAccessError> {
        let client = self.client_handle()?;
        let code = client
            .get_rendezvous_token(name)
            .await
            .map_err(AgentAccessError::Client)?;
        Ok(code.to_string())
    }

    pub async fn list_connections(&self) -> Result<Vec<ConnectionSummary>, AgentAccessError> {
        let store = self.connection_store_handle()?;
        Ok(store.list_summaries().await)
    }

    /// Removes a cached connection so it's no longer offered to the user (`listConnections()`)
    /// and — see [`spawn_dispatch`]'s `CredentialRequest` arm — so any *future* request from
    /// this fingerprint is denied before ever reaching the credential handler.
    ///
    /// TODO(agent-access): this only evicts our own [`KvConnectionStore`] record.
    /// `ap_client::UserClient` separately keeps an in-memory transport map keyed by identity
    /// that isn't invalidated by this call — a session already established *before* removal can
    /// keep resolving credential requests until the app restarts, because `spawn_dispatch`'s
    /// guard only runs for requests that arrive after this method returns, not ones already
    /// in flight or on a connection `ap_client` still considers live. Fully closing that live
    /// relay session needs an `ap_client`/`ap-client` SDK API (e.g. something like
    /// `UserClient::disconnect_peer(fingerprint)`) that does not exist yet — see
    /// agent-access-architecture.md's "Relay ownership: unchanged pre-merge blocker" decision.
    /// The guard added here is the contained fix available without that API.
    pub async fn remove_connection(&self, fingerprint_hex: String) -> Result<(), AgentAccessError> {
        let store = self.connection_store_handle()?;
        store.remove(&fingerprint_hex).await?;
        Ok(())
    }

    fn client_handle(&self) -> Result<UserClient, AgentAccessError> {
        let guard = self.inner.lock().expect("agent access state lock poisoned");
        let client = guard.as_ref().map(|r| r.client.clone());
        drop(guard);
        client.ok_or(AgentAccessError::NotRunning)
    }

    fn connection_store_handle(&self) -> Result<KvConnectionStore, AgentAccessError> {
        let guard = self.inner.lock().expect("agent access state lock poisoned");
        let store = guard.as_ref().map(|r| r.connection_store.clone());
        drop(guard);
        store.ok_or(AgentAccessError::NotRunning)
    }
}

/// Drains `UserClientRequest`s and dispatches each to the host callbacks under
/// [`CALLBACK_TIMEOUT`]. Exits when the request channel closes (`DesktopAgentAccess::stop`
/// dropped the last `UserClient` handle).
///
/// Deny-by-default: a callback timeout, a callback-reported failure, or a plain `approved:
/// false` response all result in a denial being sent back to the remote peer. The remote is
/// never left hanging and never receives partial/default vault data.
fn spawn_dispatch(
    mut requests: mpsc::Receiver<UserClientRequest>,
    credential_handler: Arc<dyn CredentialRequestHandler>,
    fingerprint_verifier: Arc<dyn FingerprintVerifier>,
    connection_store: KvConnectionStore,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(request) = requests.recv().await {
            match request {
                UserClientRequest::CredentialRequest {
                    query,
                    identity,
                    reply,
                } => {
                    let requester_fingerprint = identity.to_hex();
                    let connection = connection_store
                        .list_summaries()
                        .await
                        .into_iter()
                        .find(|c| c.fingerprint == requester_fingerprint);

                    // Contained guard for `remove_connection`'s eviction gap (see that method's
                    // TODO): `ap_client` can still route a request here for an identity whose
                    // connection we've removed from our own store, because it keeps its own
                    // in-memory transport map. Never let such a request reach the credential
                    // handler — deny before dispatch, the same way an unknown/never-paired
                    // fingerprint would be denied.
                    let Some(connection) = connection else {
                        debug!(
                            "agent_access: denying credential request for a fingerprint not in \
                             the connection store (removed, or never paired)"
                        );
                        let _ = reply.send(deny_credential());
                        continue;
                    };
                    let requester_name = connection.name;

                    let request_data = CredentialRequestData {
                        query_type: CredentialQueryKind::from(&query),
                        query_value: query.search_string().to_string(),
                        requester_fingerprint: Some(requester_fingerprint),
                        requester_name,
                        origin: CredentialRequestOrigin::Relay,
                        local_peer: None,
                        delivery_mode: None,
                        // Secrets are local-transport-only (agent-access-architecture.md, "M4",
                        // invariant 6) — the relay never constructs a secret request, so this is
                        // explicit here rather than relying on `ResourceKind`'s `Default`.
                        resource: ResourceKind::Credential,
                        // Creates are local-transport-only too (agent-access-architecture.md,
                        // "M4b — secret creation") — the relay never constructs one, so this is
                        // explicit here rather than relying on `RequestOperation`'s `Default`.
                        operation: RequestOperation::Request,
                        new_secret_name: None,
                        new_secret_value: None,
                        new_secret_note: None,
                        project_hint: None,
                        // Update/delete/list (M6, "Full Secrets Manager surface") are
                        // local-transport-only too — the relay never constructs one.
                        target_id: None,
                        generate_value: false,
                        generate_length: None,
                        generate_symbols: None,
                        // Fill delivery is local-transport-only too (agent-access-architecture
                        // .md, "M5 — Browser fill delivery") — the relay never constructs one.
                        fill_fields: None,
                        fill_target_token: None,
                        // OpenShell (§M8) is local-transport-only too.
                        openshell: None,
                        provider_targets: Vec::new(),
                    };

                    let handler = Arc::clone(&credential_handler);
                    let outcome = tokio::time::timeout(
                        CALLBACK_TIMEOUT,
                        handler.handle_credential_request(request_data),
                    )
                    .await;

                    let credential_reply = match outcome {
                        Ok(Ok(response)) if response.approved => CredentialRequestReply {
                            approved: true,
                            credential_id: response.credential_id.clone(),
                            credential: Some(CredentialData {
                                username: response.username,
                                password: response.password.map(Zeroizing::new),
                                totp: response.totp,
                                uri: response.uri,
                                notes: response.notes,
                                credential_id: response.credential_id,
                                // The JS DTO (see napi/src/agent_access.rs) has no separate
                                // `domain` field; `domain` is only used for ap_client's own
                                // audit-log context, so leaving it unset just narrows that
                                // audit trail rather than changing any allow/deny behavior.
                                domain: None,
                            }),
                        },
                        Ok(Ok(_)) => deny_credential(),
                        Ok(Err(error)) => {
                            debug!(%error, "agent_access: credential callback failed, denying");
                            deny_credential()
                        }
                        Err(_) => {
                            warn!("agent_access: credential callback timed out, denying");
                            deny_credential()
                        }
                    };

                    let _ = reply.send(credential_reply);
                }
                UserClientRequest::VerifyFingerprint {
                    fingerprint,
                    identity,
                    reply,
                } => {
                    let request_data = FingerprintVerificationData {
                        fingerprint,
                        identity_fingerprint: identity.to_hex(),
                    };

                    let verifier = Arc::clone(&fingerprint_verifier);
                    let outcome = tokio::time::timeout(
                        CALLBACK_TIMEOUT,
                        verifier.verify_fingerprint(request_data),
                    )
                    .await;

                    let verification_reply = match outcome {
                        Ok(Ok(response)) if response.approved => FingerprintVerificationReply {
                            approved: true,
                            name: response.name,
                        },
                        Ok(Ok(_)) => deny_fingerprint(),
                        Ok(Err(error)) => {
                            debug!(%error, "agent_access: fingerprint callback failed, denying");
                            deny_fingerprint()
                        }
                        Err(_) => {
                            warn!("agent_access: fingerprint callback timed out, denying");
                            deny_fingerprint()
                        }
                    };

                    let _ = reply.send(verification_reply);
                }
            }
        }
        debug!("agent_access: request channel closed, dispatch task exiting");
    })
}

fn deny_credential() -> CredentialRequestReply {
    CredentialRequestReply {
        approved: false,
        credential: None,
        credential_id: None,
    }
}

fn deny_fingerprint() -> FingerprintVerificationReply {
    FingerprintVerificationReply {
        approved: false,
        name: None,
    }
}

/// Drains status notifications from `ap_client` so its internal channel never fills up and
/// blocks the event loop. Only presence-level fields (fingerprints, counts, protocol error
/// strings generated by `ap_client` itself) ever reach `tracing` — never credential data.
///
/// Only a curated subset reaches `event_sink`: relay connection health (`reconnecting`,
/// `reconnected`, `error`) and handshake completion, which has no `AuditLog` equivalent.
/// Variants that duplicate an `ap_client::AuditEvent` already forwarded by
/// [`crate::audit::ForwardingAuditLog`] (session refresh, fingerprint verified/rejected,
/// credential approved/denied) are deliberately *not* re-forwarded here — `ap_client` emits
/// both for the same underlying action, and the `AuditLog` side already carries richer context
/// (e.g. connection name, field presence). Purely internal handshake progress and the startup
/// `Listening` notification are noisy per-message internals and are also not forwarded.
fn spawn_notification_drain(
    mut notifications: mpsc::Receiver<UserClientNotification>,
    event_sink: Arc<dyn EventSink>,
) -> JoinHandle<()> {
    tokio::spawn(async move {
        while let Some(notification) = notifications.recv().await {
            match notification {
                UserClientNotification::Error { message, context } => {
                    warn!(?context, "agent_access notification error: {message}");
                    forward_notification_event(&event_sink, "error", Some(message));
                }
                UserClientNotification::Reconnecting { attempt } => {
                    debug!(attempt, "agent_access notification");
                    forward_notification_event(
                        &event_sink,
                        "reconnecting",
                        Some(attempt.to_string()),
                    );
                }
                UserClientNotification::Reconnected {} => {
                    debug!("agent_access notification");
                    forward_notification_event(&event_sink, "reconnected", None);
                }
                UserClientNotification::HandshakeComplete {} => {
                    debug!("agent_access notification");
                    forward_notification_event(&event_sink, "handshake_completed", None);
                }
                other => debug!(?other, "agent_access notification"),
            }
        }
        debug!("agent_access: notification channel closed, drain task exiting");
    })
}

/// Builds an [`AgentAccessEvent`] for a notification-sourced `kind` and hands it to
/// `event_sink` on its own detached task — mirrors [`crate::audit::ForwardingAuditLog::forward`]
/// so a slow/hung host callback can never stall this drain loop and back up `ap_client`'s
/// bounded notification channel.
fn forward_notification_event(
    event_sink: &Arc<dyn EventSink>,
    kind: &'static str,
    detail: Option<String>,
) {
    let sink = Arc::clone(event_sink);
    tokio::spawn(async move {
        sink.on_event(AgentAccessEvent {
            kind: kind.to_string(),
            timestamp_ms: AgentAccessEvent::now_ms(),
            peer_fingerprint: None,
            peer_name: None,
            detail,
            fields_shared: None,
        })
        .await;
    });
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};

    use ap_client::{ConnectionInfo, ConnectionStore};
    use ap_relay_protocol::IdentityFingerprint;
    use tokio::sync::oneshot;

    use super::*;
    use crate::{
        callbacks::{CallbackError, CredentialResponseData, FingerprintVerificationResponse},
        storage::KvConnectionStore,
    };

    /// Never resolves — used to force the dispatch loop's timeout branch without waiting out
    /// a real 60s in test time (tests use `#[tokio::test(start_paused = true)]` +
    /// `tokio::time::advance`).
    struct HangingCredentialHandler;

    #[async_trait::async_trait]
    impl CredentialRequestHandler for HangingCredentialHandler {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            std::future::pending().await
        }
    }

    struct HangingFingerprintVerifier;

    #[async_trait::async_trait]
    impl FingerprintVerifier for HangingFingerprintVerifier {
        async fn verify_fingerprint(
            &self,
            _request: FingerprintVerificationData,
        ) -> Result<FingerprintVerificationResponse, CallbackError> {
            std::future::pending().await
        }
    }

    struct FailingCredentialHandler;

    #[async_trait::async_trait]
    impl CredentialRequestHandler for FailingCredentialHandler {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            Err(CallbackError::Failed)
        }
    }

    struct ApprovingCredentialHandler {
        calls: AtomicUsize,
    }

    #[async_trait::async_trait]
    impl CredentialRequestHandler for ApprovingCredentialHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            self.calls.fetch_add(1, AtomicOrdering::SeqCst);
            Ok(CredentialResponseData {
                approved: true,
                username: Some("user@example.com".to_string()),
                password: Some("hunter2".to_string()),
                credential_id: Some("cipher-1".to_string()),
                uri: Some(request.query_value),
                ..Default::default()
            })
        }
    }

    /// A `FingerprintVerifier` that should never be reached by a credential-only test.
    struct UnusedFingerprintVerifier;

    #[async_trait::async_trait]
    impl FingerprintVerifier for UnusedFingerprintVerifier {
        async fn verify_fingerprint(
            &self,
            _request: FingerprintVerificationData,
        ) -> Result<FingerprintVerificationResponse, CallbackError> {
            panic!("fingerprint verifier should not be called by a credential-only test");
        }
    }

    struct UnusedCredentialHandler;

    #[async_trait::async_trait]
    impl CredentialRequestHandler for UnusedCredentialHandler {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            panic!("credential handler should not be called by a fingerprint-only test");
        }
    }

    async fn empty_connection_store() -> KvConnectionStore {
        struct NoopKv;
        #[async_trait::async_trait]
        impl KvStorage for NoopKv {
            async fn get(&self, _key: &str) -> Result<Option<String>, CallbackError> {
                Ok(None)
            }
            async fn set(&self, _key: &str, _value: Option<&str>) -> Result<(), CallbackError> {
                Ok(())
            }
        }
        KvConnectionStore::load(Arc::new(NoopKv)).await.unwrap()
    }

    /// A connection store pre-seeded with a record for `fingerprint` — required for a
    /// `CredentialRequest` to reach the credential handler at all now that `spawn_dispatch`
    /// denies before dispatch for any fingerprint the store doesn't recognize (the
    /// `remove_connection` eviction guard). Tests that want to exercise the *handler's* behavior
    /// (timeout, error, approval) must seed the identity they send a request for; tests of the
    /// guard itself use [`empty_connection_store`] instead.
    async fn connection_store_with(fingerprint: IdentityFingerprint) -> KvConnectionStore {
        let mut store = empty_connection_store().await;
        ConnectionStore::save(
            &mut store,
            ConnectionInfo {
                fingerprint,
                name: None,
                cached_at: 0,
                last_connected_at: 0,
                transport_state: None,
            },
        )
        .await
        .unwrap();
        store
    }

    #[tokio::test(start_paused = true)]
    async fn credential_request_denies_on_callback_timeout() {
        let identity = IdentityFingerprint([0x42; 32]);
        let (request_tx, request_rx) = mpsc::channel(1);
        let dispatch = spawn_dispatch(
            request_rx,
            Arc::new(HangingCredentialHandler),
            Arc::new(UnusedFingerprintVerifier),
            connection_store_with(identity).await,
        );

        let (reply_tx, reply_rx) = oneshot::channel();
        request_tx
            .send(UserClientRequest::CredentialRequest {
                query: ap_client::CredentialQuery::Domain("example.com".to_string()),
                identity,
                reply: reply_tx,
            })
            .await
            .unwrap();

        // Fast-forward virtual time past CALLBACK_TIMEOUT instead of waiting 60 real seconds.
        tokio::time::advance(CALLBACK_TIMEOUT + Duration::from_secs(1)).await;

        let reply = reply_rx.await.unwrap();
        assert!(!reply.approved, "timed-out callback must deny, not hang");
        assert!(reply.credential.is_none());

        drop(request_tx);
        dispatch.await.unwrap();
    }

    #[tokio::test(start_paused = true)]
    async fn fingerprint_verification_denies_on_callback_timeout() {
        let (request_tx, request_rx) = mpsc::channel(1);
        let dispatch = spawn_dispatch(
            request_rx,
            Arc::new(UnusedCredentialHandler),
            Arc::new(HangingFingerprintVerifier),
            empty_connection_store().await,
        );

        let (reply_tx, reply_rx) = oneshot::channel();
        request_tx
            .send(UserClientRequest::VerifyFingerprint {
                fingerprint: "abcdef".to_string(),
                identity: IdentityFingerprint([0x11; 32]),
                reply: reply_tx,
            })
            .await
            .unwrap();

        tokio::time::advance(CALLBACK_TIMEOUT + Duration::from_secs(1)).await;

        let reply = reply_rx.await.unwrap();
        assert!(
            !reply.approved,
            "timed-out fingerprint verification must deny"
        );
        assert!(reply.name.is_none());

        drop(request_tx);
        dispatch.await.unwrap();
    }

    #[tokio::test]
    async fn credential_request_denies_on_callback_error() {
        let identity = IdentityFingerprint([0x99; 32]);
        let (request_tx, request_rx) = mpsc::channel(1);
        let dispatch = spawn_dispatch(
            request_rx,
            Arc::new(FailingCredentialHandler),
            Arc::new(UnusedFingerprintVerifier),
            connection_store_with(identity).await,
        );

        let (reply_tx, reply_rx) = oneshot::channel();
        request_tx
            .send(UserClientRequest::CredentialRequest {
                query: ap_client::CredentialQuery::Id("cipher-1".to_string()),
                identity,
                reply: reply_tx,
            })
            .await
            .unwrap();

        let reply = reply_rx.await.unwrap();
        assert!(
            !reply.approved,
            "a callback Err must deny, never surface details"
        );

        drop(request_tx);
        dispatch.await.unwrap();
    }

    #[tokio::test]
    async fn credential_request_denies_without_dispatch_when_fingerprint_not_in_store() {
        // Simulates the `remove_connection` eviction gap this guard closes: a request arrives
        // for a fingerprint that isn't (or is no longer) in `connection_store`. `ap_client`
        // could still route this — its own in-memory transport map is a separate concern (see
        // `remove_connection`'s TODO) — but this crate's dispatch loop must refuse to even ask
        // the credential handler. `UnusedCredentialHandler` panics if called, so this test fails
        // loudly if the guard is ever bypassed.
        let (request_tx, request_rx) = mpsc::channel(1);
        let dispatch = spawn_dispatch(
            request_rx,
            Arc::new(UnusedCredentialHandler),
            Arc::new(UnusedFingerprintVerifier),
            empty_connection_store().await,
        );

        let (reply_tx, reply_rx) = oneshot::channel();
        request_tx
            .send(UserClientRequest::CredentialRequest {
                query: ap_client::CredentialQuery::Domain("example.com".to_string()),
                identity: IdentityFingerprint([0x55; 32]),
                reply: reply_tx,
            })
            .await
            .unwrap();

        let reply = reply_rx.await.unwrap();
        assert!(
            !reply.approved,
            "a request for a fingerprint absent from the connection store must be denied"
        );
        assert!(reply.credential.is_none());

        drop(request_tx);
        dispatch.await.unwrap();
    }

    #[tokio::test]
    async fn credential_request_approves_and_forwards_fields() {
        let identity = IdentityFingerprint([0x07; 32]);
        let (request_tx, request_rx) = mpsc::channel(1);
        let handler = Arc::new(ApprovingCredentialHandler {
            calls: AtomicUsize::new(0),
        });
        let dispatch = spawn_dispatch(
            request_rx,
            Arc::clone(&handler) as Arc<dyn CredentialRequestHandler>,
            Arc::new(UnusedFingerprintVerifier),
            connection_store_with(identity).await,
        );

        let (reply_tx, reply_rx) = oneshot::channel();
        request_tx
            .send(UserClientRequest::CredentialRequest {
                query: ap_client::CredentialQuery::Domain("example.com".to_string()),
                identity,
                reply: reply_tx,
            })
            .await
            .unwrap();

        let reply = reply_rx.await.unwrap();
        assert!(reply.approved);
        let credential = reply
            .credential
            .expect("approved reply carries a credential");
        assert_eq!(credential.username.as_deref(), Some("user@example.com"));
        assert_eq!(credential.uri.as_deref(), Some("example.com"));
        assert_eq!(reply.credential_id.as_deref(), Some("cipher-1"));
        assert_eq!(handler.calls.load(AtomicOrdering::SeqCst), 1);

        drop(request_tx);
        dispatch.await.unwrap();
    }

    #[test]
    fn new_instance_is_not_running() {
        let agent = DesktopAgentAccess::new();
        assert!(!agent.is_running());
    }

    #[tokio::test]
    async fn operations_before_start_report_not_running() {
        let agent = DesktopAgentAccess::new();
        assert!(matches!(
            agent.get_fingerprint().await,
            Err(AgentAccessError::NotRunning)
        ));
        assert!(matches!(
            agent.list_connections().await,
            Err(AgentAccessError::NotRunning)
        ));
        assert!(matches!(
            agent.generate_psk_token(None, false).await,
            Err(AgentAccessError::NotRunning)
        ));
    }

    #[test]
    fn stop_without_start_does_not_panic() {
        let agent = DesktopAgentAccess::new();
        agent.stop();
        assert!(!agent.is_running());
    }

    /// Forwards every event to an unbounded channel so tests can `recv().await` it, which
    /// naturally waits out the detached-task hop in [`forward_notification_event`].
    struct ChannelEventSink(mpsc::UnboundedSender<AgentAccessEvent>);

    #[async_trait::async_trait]
    impl EventSink for ChannelEventSink {
        async fn on_event(&self, event: AgentAccessEvent) {
            let _ = self.0.send(event);
        }
    }

    #[tokio::test]
    async fn notification_drain_forwards_reconnected() {
        let (notification_tx, notification_rx) = mpsc::channel(1);
        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let drain = spawn_notification_drain(notification_rx, Arc::new(ChannelEventSink(event_tx)));

        notification_tx
            .send(UserClientNotification::Reconnected {})
            .await
            .unwrap();

        let event = event_rx.recv().await.unwrap();
        assert_eq!(event.kind, "reconnected");
        assert!(event.detail.is_none());

        drop(notification_tx);
        drain.await.unwrap();
    }

    #[tokio::test]
    async fn notification_drain_forwards_error_with_message_as_detail() {
        let (notification_tx, notification_rx) = mpsc::channel(1);
        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let drain = spawn_notification_drain(notification_rx, Arc::new(ChannelEventSink(event_tx)));

        notification_tx
            .send(UserClientNotification::Error {
                message: "relay connection lost".to_string(),
                context: Some("transport".to_string()),
            })
            .await
            .unwrap();

        let event = event_rx.recv().await.unwrap();
        assert_eq!(event.kind, "error");
        assert_eq!(event.detail.as_deref(), Some("relay connection lost"));

        drop(notification_tx);
        drain.await.unwrap();
    }

    #[tokio::test]
    async fn notification_drain_forwards_reconnecting_with_attempt_as_detail() {
        let (notification_tx, notification_rx) = mpsc::channel(1);
        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let drain = spawn_notification_drain(notification_rx, Arc::new(ChannelEventSink(event_tx)));

        notification_tx
            .send(UserClientNotification::Reconnecting { attempt: 3 })
            .await
            .unwrap();

        let event = event_rx.recv().await.unwrap();
        assert_eq!(event.kind, "reconnecting");
        assert_eq!(event.detail.as_deref(), Some("3"));

        drop(notification_tx);
        drain.await.unwrap();
    }

    #[tokio::test]
    async fn notification_drain_forwards_handshake_completed() {
        let (notification_tx, notification_rx) = mpsc::channel(1);
        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let drain = spawn_notification_drain(notification_rx, Arc::new(ChannelEventSink(event_tx)));

        notification_tx
            .send(UserClientNotification::HandshakeComplete {})
            .await
            .unwrap();

        let event = event_rx.recv().await.unwrap();
        assert_eq!(event.kind, "handshake_completed");

        drop(notification_tx);
        drain.await.unwrap();
    }

    #[tokio::test]
    async fn notification_drain_does_not_forward_noisy_internals() {
        let (notification_tx, notification_rx) = mpsc::channel(1);
        let (event_tx, mut event_rx) = mpsc::unbounded_channel();
        let drain = spawn_notification_drain(notification_rx, Arc::new(ChannelEventSink(event_tx)));

        // `Listening` is a startup-only internal notification and must never reach the sink.
        // Follow it with a `Reconnected`, which must, so a bounded wait on the channel proves
        // the first notification really was dropped rather than merely delayed.
        notification_tx
            .send(UserClientNotification::Listening {})
            .await
            .unwrap();
        notification_tx
            .send(UserClientNotification::Reconnected {})
            .await
            .unwrap();

        let event = event_rx.recv().await.unwrap();
        assert_eq!(event.kind, "reconnected");

        drop(notification_tx);
        drain.await.unwrap();
    }

    // --- OpenShell listener slot (§M8.7, §M8.14) -------------------------------------------------

    #[cfg(unix)]
    fn temp_socket_path(tag: &str) -> String {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir()
            .join(format!(
                "bw-aa-os-{tag}-{}-{nanos}.sock",
                std::process::id()
            ))
            .to_string_lossy()
            .into_owned()
    }

    struct NoopEventSink;

    #[async_trait::async_trait]
    impl EventSink for NoopEventSink {
        async fn on_event(&self, _event: AgentAccessEvent) {}
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn openshell_listener_start_and_stop_are_idempotent_and_stop_closes_the_socket() {
        let path = temp_socket_path("slot");
        let handler: Arc<dyn CredentialRequestHandler> = Arc::new(FailingCredentialHandler);
        let sink: Arc<dyn EventSink> = Arc::new(NoopEventSink);
        let mut slot = OpenShellListenerSlot::default();

        slot.start(path.clone(), &handler, &sink).unwrap();
        assert!(slot.is_listening());
        // A second start on the same path keeps the running listener (it would otherwise fail:
        // the socket is live, and `bind` refuses to steal a live socket).
        slot.start(path.clone(), &handler, &sink).unwrap();
        assert!(slot.is_listening());
        assert!(tokio::net::UnixStream::connect(&path).await.is_ok());

        slot.stop();
        assert!(!slot.is_listening());
        assert!(
            !std::path::Path::new(&path).exists(),
            "the socket file must not outlive the listener"
        );
        assert!(tokio::net::UnixStream::connect(&path).await.is_err());
        // Stopping again is a no-op.
        slot.stop();
        assert!(!slot.is_listening());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn openshell_listener_restart_on_a_new_path_replaces_the_old_one() {
        let first = temp_socket_path("first");
        let second = temp_socket_path("second");
        let handler: Arc<dyn CredentialRequestHandler> = Arc::new(FailingCredentialHandler);
        let sink: Arc<dyn EventSink> = Arc::new(NoopEventSink);
        let mut slot = OpenShellListenerSlot::default();

        slot.start(first.clone(), &handler, &sink).unwrap();
        slot.start(second.clone(), &handler, &sink).unwrap();
        assert!(!std::path::Path::new(&first).exists());
        assert!(tokio::net::UnixStream::connect(&second).await.is_ok());
        slot.stop();
    }

    #[test]
    fn openshell_listener_needs_a_running_agent() {
        let access = DesktopAgentAccess::new();
        assert!(matches!(
            access.start_openshell_listener("/tmp/never-bound.sock".to_string()),
            Err(AgentAccessError::NotRunning)
        ));
        // Stopping when nothing runs is a no-op, never a panic.
        access.stop_openshell_listener();
        assert!(!access.is_openshell_listening());
    }
}
