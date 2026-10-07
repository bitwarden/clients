//! Local Unix-socket / Windows-named-pipe listener for the Agent Access `aac` CLI.
//!
//! Implements "Local wire protocol v1" from agent-access-architecture.md ([`local_protocol`]):
//! one JSON-line request, one JSON-line response, then close. Every accepted connection
//! converges on the *same* `Arc<dyn CredentialRequestHandler>` the relay dispatch in
//! `client.rs` uses, under the same [`CALLBACK_TIMEOUT`](crate::client::CALLBACK_TIMEOUT)
//! deny-by-default semantics — this is the "single enforcement point" invariant from the
//! architecture doc: local and relay requests are two ingress paths into one authorization
//! decision, never two.
//!
//! Platform transports ([`unix`], [`windows`]) only bind/accept and capture the OS-verified
//! peer PID; everything past `accept()` — reading the request line, dispatching to the host
//! callback, building the reply — is platform-independent and lives in this module.

mod local_protocol;
mod openshell;
#[cfg(unix)]
mod unix;
#[cfg(windows)]
mod windows;

use std::{sync::Arc, time::Duration};

use async_trait::async_trait;
use local_protocol::{ValidatedRequest, WireRequest, WireResponse, WireStatus};
use openshell::{LimitRefusal, OpenShellLimiter, OpenShellReply, ValidatedHello, ValidatedResolve};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::Semaphore,
    task::{JoinHandle, JoinSet},
};
use tracing::{debug, warn};

use crate::{
    callbacks::{
        AgentAccessEvent, CredentialQueryKind, CredentialRequestData, CredentialRequestHandler,
        CredentialRequestOrigin, EventSink, RequestOperation, ResourceKind,
    },
    client::CALLBACK_TIMEOUT,
    error::AgentAccessError,
    peer_info::LocalPeerInfo,
};

/// Read timeout for the single request line. The response can legitimately take up to
/// [`CALLBACK_TIMEOUT`] (60s — user approval); this only bounds how long the server waits for
/// the client to finish *sending* its request, per "Local wire protocol v1"'s "clients must use
/// a read timeout ≥ 120s" (the server's own budget is far tighter, since a slow/hung client
/// sending its request is not the case that timeout accommodates).
const READ_TIMEOUT: Duration = Duration::from_secs(10);

/// Maximum number of local connections handled concurrently. A local process could otherwise
/// `tokio::spawn` unboundedly on every accept, exhausting file descriptors and flooding the user
/// with approval dialogs. Connections beyond this cap are answered with
/// [`WireStatus::RateLimited`] and closed immediately rather than queued or serviced — see
/// [`accept_loop`]. Chosen small: legitimate local usage is one connection per `aac`
/// invocation (the wire protocol is one-request-per-connection), so double-digit concurrent
/// requests already indicates something unusual, not normal multi-tool usage.
const MAX_CONCURRENT_CONNECTIONS: usize = 8;

/// Which socket a listener serves (agent-access-architecture.md, §M8.4). The kind — never
/// anything on the wire — decides which ops are accepted and which [`CredentialRequestOrigin`]
/// a dispatched request carries.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ListenerKind {
    /// The existing `aac` agent socket: every op except the OpenShell ones; origin `Local`.
    Agent,
    /// The toggle-gated OpenShell socket: `openshellResolve`/`openshellHello` only; origin
    /// `OpenShell`. macOS and Linux only.
    OpenShell,
}

/// Implemented per-platform ([`unix::UnixLocalListener`], [`windows::WindowsLocalListener`]).
/// Deliberately not the `ssh_agent` crate's `Listener` trait — this crate must not depend on
/// `ssh_agent` (see agent-access-architecture.md's napi surface section) — but the shape is the
/// same by design, so the two transports stay easy to compare.
#[async_trait]
pub(crate) trait LocalListener: Send {
    type Stream: AsyncRead + AsyncWrite + Send + Unpin + 'static;

    /// Accepts one connection and returns the OS-verified peer PID, if it could be captured.
    /// Deliberately *not* a resolved [`LocalPeerInfo`] — resolving a PID into process metadata
    /// (`sysinfo`/`libproc`) is a blocking OS call; doing it here on the accept path would
    /// serialize every accept behind one peer's process lookup. Resolution is deferred to
    /// [`attest_peer`], which runs it on the blocking thread pool alongside W2a attestation.
    async fn accept(&mut self) -> std::io::Result<(Self::Stream, Option<u32>)>;
}

/// Binds the platform listener synchronously and spawns the accept loop.
///
/// Binding happens *before* returning so a bad path or permission error surfaces directly from
/// `DesktopAgentAccess::start` as an [`AgentAccessError`], rather than failing silently inside a
/// background task the caller has no way to observe. The returned [`JoinHandle`] is owned by
/// `client::Running` and aborted in `DesktopAgentAccess::stop`.
pub(crate) fn spawn(
    socket_path: String,
    kind: ListenerKind,
    credential_handler: Arc<dyn CredentialRequestHandler>,
    event_sink: Arc<dyn EventSink>,
) -> Result<JoinHandle<()>, AgentAccessError> {
    #[cfg(unix)]
    {
        let listener = unix::UnixLocalListener::bind(&socket_path)
            .map_err(|e| AgentAccessError::LocalListener(format!("failed to bind: {e}")))?;
        Ok(tokio::spawn(accept_loop(
            listener,
            kind,
            credential_handler,
            event_sink,
        )))
    }
    #[cfg(windows)]
    {
        // §M8: the OpenShell integration is macOS/Linux only. Refuse here too, so no caller can
        // stand up a Windows named pipe that accepts the OpenShell ops.
        if kind == ListenerKind::OpenShell {
            return Err(AgentAccessError::LocalListener(
                "the OpenShell listener is only supported on macOS and Linux".to_string(),
            ));
        }
        let listener = windows::WindowsLocalListener::bind(&socket_path).map_err(|e| {
            AgentAccessError::LocalListener(format!("failed to create named pipe: {e}"))
        })?;
        Ok(tokio::spawn(accept_loop(
            listener,
            kind,
            credential_handler,
            event_sink,
        )))
    }
}

/// Accepts connections in a loop, bounding concurrency at [`MAX_CONCURRENT_CONNECTIONS`] and
/// tracking every spawned connection task in a [`JoinSet`] owned by this function's own async
/// stack frame.
///
/// That ownership is what makes `stop()` cancel in-flight local requests: `spawn()` hands the
/// caller a [`JoinHandle`] for *this* function, and `DesktopAgentAccess::stop` aborts it (see
/// `client.rs`). Aborting a task drops its future, and dropping a `JoinSet` aborts every task
/// still inside it — so the moment the accept loop itself is torn down, every connection it was
/// still servicing (including one blocked on a pending approval dialog) is aborted too, and no
/// reply is ever written for it. Without this, connection tasks spawned via a detached
/// `tokio::spawn` would keep running after `stop()`, and a stale approval could still release a
/// credential after the user believed the feature was off.
async fn accept_loop<L: LocalListener + 'static>(
    mut listener: L,
    kind: ListenerKind,
    credential_handler: Arc<dyn CredentialRequestHandler>,
    event_sink: Arc<dyn EventSink>,
) {
    let semaphore = Arc::new(Semaphore::new(MAX_CONCURRENT_CONNECTIONS));
    // Per-listener (§M8.5): the OpenShell rate-limit state lives and dies with this accept loop,
    // so a stop/start of the OpenShell listener starts from a clean slate.
    let limiter = Arc::new(OpenShellLimiter::default());
    let mut connections: JoinSet<()> = JoinSet::new();

    loop {
        tokio::select! {
            accepted = listener.accept() => {
                match accepted {
                    Ok((stream, peer_pid)) => {
                        match Arc::clone(&semaphore).try_acquire_owned() {
                            Ok(permit) => {
                                let handler = Arc::clone(&credential_handler);
                                let sink = Arc::clone(&event_sink);
                                let limiter = Arc::clone(&limiter);
                                connections.spawn(async move {
                                    handle_connection(
                                        stream, peer_pid, kind, handler, sink, limiter,
                                    )
                                    .await;
                                    drop(permit);
                                });
                            }
                            Err(_) => {
                                // At capacity: never queue indefinitely or dispatch to the
                                // credential handler (which could mean an approval dialog) —
                                // reply immediately and close.
                                debug!(
                                    "agent_access: local listener at capacity \
                                     ({MAX_CONCURRENT_CONNECTIONS} concurrent connections), \
                                     rejecting with rateLimited"
                                );
                                connections.spawn(reject_rate_limited(stream));
                            }
                        }
                    }
                    Err(error) => {
                        // Transient accept errors (e.g. a client that resets the connection
                        // mid-accept on Windows) must not tear down the whole listener — keep
                        // looping, matching ssh_agent v2's accept-loop behavior.
                        warn!(%error, "agent_access: local listener accept failed");
                    }
                }
            }
            // Continuously reap finished connection tasks so `connections` doesn't grow
            // unboundedly over the process lifetime. `if !connections.is_empty()` avoids
            // `join_next` returning `None` (an empty JoinSet) from winning a `select!` branch
            // in a tight loop while idle.
            Some(result) = connections.join_next(), if !connections.is_empty() => {
                if let Err(error) = result {
                    if !error.is_cancelled() {
                        debug!(%error, "agent_access: local connection task panicked");
                    }
                }
            }
        }
    }
}

/// Replies [`WireStatus::RateLimited`] and closes, without ever reading the request or invoking
/// the credential handler — used when [`accept_loop`] is already servicing
/// [`MAX_CONCURRENT_CONNECTIONS`].
async fn reject_rate_limited<S: AsyncWrite + Unpin>(mut stream: S) {
    reply(
        &mut stream,
        &WireResponse::status(
            WireStatus::RateLimited,
            "Too many concurrent local requests",
        ),
    )
    .await;
}

/// Handles exactly one connection: read one request line, dispatch to the credential handler
/// under [`CALLBACK_TIMEOUT`], write exactly one reply line, close (by dropping `stream`).
async fn handle_connection<S: AsyncRead + AsyncWrite + Unpin>(
    mut stream: S,
    peer_pid: Option<u32>,
    kind: ListenerKind,
    credential_handler: Arc<dyn CredentialRequestHandler>,
    event_sink: Arc<dyn EventSink>,
    limiter: Arc<OpenShellLimiter>,
) {
    let line = match tokio::time::timeout(READ_TIMEOUT, read_request_line(&mut stream)).await {
        Ok(Ok(ReadOutcome::Line(line))) => line,
        // Connection closed before a full line arrived: nothing meaningful to reply to.
        Ok(Ok(ReadOutcome::Closed)) => return,
        Ok(Ok(ReadOutcome::TooLong)) => {
            reply(&mut stream, &WireResponse::error("request too large")).await;
            return;
        }
        Ok(Err(error)) => {
            debug!(%error, "agent_access: local connection read failed");
            return;
        }
        Err(_) => {
            reply(&mut stream, &WireResponse::error("request timed out")).await;
            return;
        }
    };

    let request: WireRequest = match serde_json::from_slice(&line) {
        Ok(request) => request,
        Err(_) => {
            reply(&mut stream, &WireResponse::error("malformed request")).await;
            return;
        }
    };

    if kind == ListenerKind::OpenShell {
        // §M8.18: aac never half-closes, so EOF (or an error) on our read side while the request
        // is being dispatched means aac dropped the request (the gateway or supervisor cancelled
        // it). Nothing is written then; see `serve_openshell`.
        let hangup = peer_hung_up(&mut stream);
        let reply_line = handle_openshell_request(
            request,
            peer_pid,
            credential_handler,
            event_sink,
            limiter,
            hangup,
        )
        .await;
        if let Some(reply_line) = reply_line {
            let _ = stream.write_all(&reply_line.bytes).await;
        }
        return;
    }

    let validated = match validate_agent_request(request) {
        Ok(validated) => validated,
        Err(message) => {
            reply(&mut stream, &WireResponse::error(message)).await;
            return;
        }
    };

    // Peer-info resolution (`LocalPeerInfo::from_pid`) and W2a attestation (parent-chain walk +
    // code-signature verification) both run here, off the accept path — see `attest_peer`'s
    // docs. `request_data.local_peer` below carries the fully resolved, attested result.
    let peer = attest_peer(peer_pid).await;

    // `client` is self-reported and diagnostic-only — see `local_protocol::WireClientInfo`'s
    // docs. Logged, never used for identity or authorization. Shared by both request shapes, so
    // read it out before the shape-specific match below consumes `validated`.
    let client = match &validated {
        ValidatedRequest::Lookup { client, .. } => client,
        ValidatedRequest::Create { client, .. } => client,
        ValidatedRequest::Update { client, .. } => client,
        ValidatedRequest::Delete { client, .. } => client,
        ValidatedRequest::List { client, .. } => client,
        ValidatedRequest::DescribeFillTarget { client } => client,
    };
    if let Some(client) = client {
        debug!(
            client_name = %client.name,
            client_version = %client.version,
            peer_pid = peer.as_ref().map(|p| p.pid),
            "agent_access: local credential request"
        );
    }

    // Builds the host-facing `CredentialRequestData` and captures the `(resource, operation,
    // delivery)` triple `build_response` needs below — shaped once here so the dispatch/reply
    // tail is identical for a lookup and a create.
    let (resource, operation, delivery, request_data) = match validated {
        ValidatedRequest::Lookup {
            resource,
            query,
            delivery,
            fill,
            ..
        } => {
            let query_type = CredentialQueryKind::from(query.kind);
            emit_event(
                &event_sink,
                "credential_requested",
                &peer,
                Some(query_kind_label(query_type).to_string()),
                None,
            );
            let request_data = CredentialRequestData {
                query_type,
                query_value: query.value,
                requester_fingerprint: None,
                requester_name: None,
                origin: CredentialRequestOrigin::Local,
                local_peer: peer.clone(),
                delivery_mode: Some(delivery),
                resource,
                operation: RequestOperation::Request,
                new_secret_name: None,
                new_secret_value: None,
                new_secret_note: None,
                project_hint: None,
                target_id: None,
                generate_value: false,
                generate_length: None,
                generate_symbols: None,
                // `Some` only for `delivery: "fill"` — `local_protocol::validate` guarantees
                // `fill` is `None` for every other delivery mode.
                fill_fields: fill.as_ref().and_then(|f| f.fields.clone()),
                fill_target_token: fill.as_ref().and_then(|f| f.target_token.clone()),
                openshell: None,
                provider_targets: Vec::new(),
            };
            (
                resource,
                RequestOperation::Request,
                Some(delivery),
                request_data,
            )
        }
        ValidatedRequest::Create {
            resource,
            name,
            value,
            generate,
            note,
            project,
            ..
        } => {
            emit_event(
                &event_sink,
                "credential_requested",
                &peer,
                Some("create".to_string()),
                None,
            );
            let request_data = CredentialRequestData {
                // No query on a create — `Name`/the proposed name gives a handler that inspects
                // these fields before checking `operation` something meaningful rather than an
                // empty string (see `CredentialRequestData::query_value`'s docs). Same
                // force-fill rule for `projectCreate` (M6): the proposed name, not the empty
                // string — the main-process activity buffer must never see names for a
                // non-lookup op, but `query_value` here is consumed only by the handler
                // dispatch, never persisted into the activity row (see `MainAgentAccessService`'s
                // `isCreate`/`operation !== Request` gate for that guarantee).
                query_type: CredentialQueryKind::Name,
                query_value: name.clone(),
                requester_fingerprint: None,
                requester_name: None,
                origin: CredentialRequestOrigin::Local,
                local_peer: peer.clone(),
                delivery_mode: None,
                resource,
                operation: RequestOperation::Create,
                new_secret_name: Some(name),
                // Moved (not cloned) from the already-`Zeroizing` `value` produced by
                // `local_protocol::validate` — never a second live copy of the incoming value.
                // `None` when the create instead opted for `generate` (M6) — mutually exclusive
                // by construction, enforced in `validate`.
                new_secret_value: value,
                new_secret_note: note,
                project_hint: project,
                target_id: None,
                generate_value: generate.is_some(),
                generate_length: generate.and_then(|g| g.length),
                generate_symbols: generate.and_then(|g| g.symbols),
                fill_fields: None,
                fill_target_token: None,
                openshell: None,
                provider_targets: Vec::new(),
            };
            (resource, RequestOperation::Create, None, request_data)
        }
        ValidatedRequest::Update {
            resource,
            target_id,
            name,
            value,
            generate,
            note,
            project,
            ..
        } => {
            emit_event(
                &event_sink,
                "credential_requested",
                &peer,
                Some("update".to_string()),
                None,
            );
            let request_data = CredentialRequestData {
                // Force-filled with `target_id`, never a name — the "Invariant guard extension"
                // in agent-access-architecture.md's "M6" section: the main-process activity
                // buffer must never see names for a non-lookup op, and an id is the only
                // meaningful stand-in `query_value` can carry here (mirrors `Create`'s use of
                // the proposed name, and `Delete`'s identical treatment below).
                query_type: CredentialQueryKind::Id,
                query_value: target_id.clone(),
                requester_fingerprint: None,
                requester_name: None,
                origin: CredentialRequestOrigin::Local,
                local_peer: peer.clone(),
                delivery_mode: None,
                resource,
                operation: RequestOperation::Update,
                // `name` carries the rename, `value` the agent-supplied replacement value,
                // `note` the note change (`Some("")` = clear), `project` the move-to hint —
                // every one of them "absent = unchanged" per the wire contract, already
                // enforced by `local_protocol::validate`.
                new_secret_name: name,
                new_secret_value: value,
                new_secret_note: note,
                project_hint: project,
                target_id: Some(target_id),
                generate_value: generate.is_some(),
                generate_length: generate.and_then(|g| g.length),
                generate_symbols: generate.and_then(|g| g.symbols),
                fill_fields: None,
                fill_target_token: None,
                openshell: None,
                provider_targets: Vec::new(),
            };
            (resource, RequestOperation::Update, None, request_data)
        }
        ValidatedRequest::Delete {
            resource,
            target_id,
            ..
        } => {
            emit_event(
                &event_sink,
                "credential_requested",
                &peer,
                Some("delete".to_string()),
                None,
            );
            let request_data = CredentialRequestData {
                // Force-filled with `target_id`, same rule as `Update` above.
                query_type: CredentialQueryKind::Id,
                query_value: target_id.clone(),
                requester_fingerprint: None,
                requester_name: None,
                origin: CredentialRequestOrigin::Local,
                local_peer: peer.clone(),
                delivery_mode: None,
                resource,
                operation: RequestOperation::Delete,
                new_secret_name: None,
                new_secret_value: None,
                new_secret_note: None,
                project_hint: None,
                target_id: Some(target_id),
                generate_value: false,
                generate_length: None,
                generate_symbols: None,
                fill_fields: None,
                fill_target_token: None,
                openshell: None,
                provider_targets: Vec::new(),
            };
            (resource, RequestOperation::Delete, None, request_data)
        }
        ValidatedRequest::List { resource, .. } => {
            emit_event(
                &event_sink,
                "credential_requested",
                &peer,
                Some("list".to_string()),
                None,
            );
            let request_data = CredentialRequestData {
                // Force-filled with an empty string — a list request has no single target to
                // name, same "nothing meaningful to carry" treatment as `DescribeFillTarget`
                // below.
                query_type: CredentialQueryKind::Search,
                query_value: String::new(),
                requester_fingerprint: None,
                requester_name: None,
                origin: CredentialRequestOrigin::Local,
                local_peer: peer.clone(),
                delivery_mode: None,
                resource,
                operation: RequestOperation::List,
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
                openshell: None,
                provider_targets: Vec::new(),
            };
            (resource, RequestOperation::List, None, request_data)
        }
        ValidatedRequest::DescribeFillTarget { .. } => {
            emit_event(
                &event_sink,
                "credential_requested",
                &peer,
                Some("describeFillTarget".to_string()),
                None,
            );
            let request_data = CredentialRequestData {
                // No query on a describe request either — see `RequestOperation
                // ::DescribeFillTarget`'s docs for why `query_type`/`query_value` carry no
                // meaningful data here (there is no stand-in the way `Create` has its proposed
                // name).
                query_type: CredentialQueryKind::Search,
                query_value: String::new(),
                requester_fingerprint: None,
                requester_name: None,
                origin: CredentialRequestOrigin::Local,
                local_peer: peer.clone(),
                delivery_mode: None,
                resource: ResourceKind::Credential,
                operation: RequestOperation::DescribeFillTarget,
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
                openshell: None,
                provider_targets: Vec::new(),
            };
            (
                ResourceKind::Credential,
                RequestOperation::DescribeFillTarget,
                None,
                request_data,
            )
        }
    };

    let outcome = tokio::time::timeout(
        CALLBACK_TIMEOUT,
        credential_handler.handle_credential_request(request_data),
    )
    .await;

    let dispatch = local_protocol::build_response(outcome, resource, operation, delivery);
    emit_event(
        &event_sink,
        dispatch.event_kind,
        &peer,
        None,
        dispatch.fields_shared,
    );

    reply(&mut stream, &dispatch.response).await;
}

/// §M8.4 per-socket op gating for the agent socket: the OpenShell ops are refused with a
/// dedicated message (rather than `unknown operation`), and everything else goes through the
/// existing validator — which itself rejects an `openshell` object as foreign.
fn validate_agent_request(request: WireRequest) -> Result<ValidatedRequest, &'static str> {
    if openshell::is_openshell_op(&request.op) {
        return Err(openshell::MSG_OP_NOT_AVAILABLE);
    }
    local_protocol::validate(request)
}

/// A validated request on the OpenShell socket.
enum OpenShellRequest {
    // Boxed: the resolve carries the whole gateway context, the hello almost nothing.
    Resolve(Box<ValidatedResolve>),
    Hello(ValidatedHello),
}

/// §M8.4 per-socket op gating for the OpenShell socket: only `openshellResolve` and
/// `openshellHello`; every other op gets `operation not available on this socket`.
fn validate_openshell_request(request: WireRequest) -> Result<OpenShellRequest, &'static str> {
    match request.op.as_str() {
        openshell::OP_RESOLVE => openshell::validate_resolve(request)
            .map(|resolve| OpenShellRequest::Resolve(Box::new(resolve))),
        openshell::OP_HELLO => openshell::validate_hello(request).map(OpenShellRequest::Hello),
        _ => Err(openshell::MSG_OP_NOT_AVAILABLE),
    }
}

/// Most bytes a peer may send after its request line before it is treated as gone. aac sends
/// nothing more; this only bounds a misbehaving peer.
const MAX_TRAILING_BYTES: usize = 64 * 1024;

/// Resolves once the peer has closed (EOF), errored, or sent more than [`MAX_TRAILING_BYTES`]
/// after its request line. Pending for as long as the peer keeps the connection open quietly.
async fn peer_hung_up<S: AsyncRead + Unpin>(stream: &mut S) {
    let mut buf = [0u8; 256];
    let mut trailing = 0usize;
    loop {
        match stream.read(&mut buf).await {
            Ok(0) | Err(_) => return,
            Ok(n) => {
                trailing += n;
                if trailing > MAX_TRAILING_BYTES {
                    return;
                }
            }
        }
    }
}

/// §M8.18: a per-process dispatch token, carried in `query_value` of an OpenShell
/// `ProviderResolve` (which has no other use for it) and in the `detail` of an
/// `openshellRequestAbandoned` event, so main can settle exactly the request aac abandoned.
fn next_dispatch_token() -> String {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    format!(
        "{}{}",
        OPENSHELL_DISPATCH_TOKEN_PREFIX,
        NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    )
}

/// Prefix of every OpenShell dispatch token (`openshell-dispatch:<n>`).
pub(crate) const OPENSHELL_DISPATCH_TOKEN_PREFIX: &str = "openshell-dispatch:";
/// §M8.18: emitted (with the dispatch token as `detail`, nothing else) when aac hangs up while
/// its request is still being dispatched.
pub(crate) const OPENSHELL_ABANDONED_EVENT_KIND: &str = "openshellRequestAbandoned";

/// Validate → attest → serve, for one OpenShell-socket request. Validation runs before the
/// (blocking, pool-offloaded) attestation so a malformed request costs no process lookups.
/// `None` means the peer hung up mid-dispatch and nothing is to be written.
async fn handle_openshell_request(
    request: WireRequest,
    peer_pid: Option<u32>,
    credential_handler: Arc<dyn CredentialRequestHandler>,
    event_sink: Arc<dyn EventSink>,
    limiter: Arc<OpenShellLimiter>,
    hangup: impl std::future::Future<Output = ()>,
) -> Option<OpenShellReply> {
    let validated = match validate_openshell_request(request) {
        Ok(validated) => validated,
        Err(message) => return Some(openshell::error_reply(message)),
    };
    let peer = attest_peer(peer_pid).await;
    serve_openshell(
        validated,
        peer,
        credential_handler,
        event_sink,
        limiter,
        AgentAccessEvent::now_ms_u64,
        hangup,
    )
    .await
}

/// Serves one validated OpenShell request for an already-attested `peer`. Split out (and
/// clock-injected) so tests can drive it with a synthetic peer and a pinned clock.
///
/// Order (§M8.5): attestation precheck → rate limit → dispatch under
/// `min(CALLBACK_TIMEOUT, deadlineMs)` → checked reply → cooldown bookkeeping. A hello stops
/// after the precheck: it is never dispatched, touches no vault data and opens no dialog.
///
/// §M8.18: if `hangup` resolves while the dispatch is still running, the dispatch is dropped,
/// an `openshellRequestAbandoned` event carries its token to main (which settles that request
/// as an undelivered, value-free timeout), and `None` is returned: nothing is written, no
/// cooldown starts, and the in-flight slot is released for the supervisor's retry.
async fn serve_openshell(
    validated: OpenShellRequest,
    peer: Option<LocalPeerInfo>,
    credential_handler: Arc<dyn CredentialRequestHandler>,
    event_sink: Arc<dyn EventSink>,
    limiter: Arc<OpenShellLimiter>,
    now_ms: fn() -> u64,
    hangup: impl std::future::Future<Output = ()>,
) -> Option<OpenShellReply> {
    if !openshell::precheck_attestation(peer.as_ref()) {
        debug!("agent_access: OpenShell request failed the attestation precheck");
        return Some(openshell::error_reply(openshell::MSG_NOT_VERIFIED));
    }

    let resolve = match validated {
        OpenShellRequest::Hello(hello) => {
            if let Some(client) = &hello.client {
                debug!(
                    client_name = %client.name,
                    client_version = %client.version,
                    "agent_access: OpenShell driver hello"
                );
            }
            // Timestamp only (§M8.4): no peer fields, no detail.
            emit_event(&event_sink, "openshellDriverSeen", &None, None, None);
            return Some(openshell::hello_reply());
        }
        OpenShellRequest::Resolve(resolve) => resolve,
    };

    let ValidatedResolve {
        context,
        targets,
        client,
    } = *resolve;
    let sandbox_id = context.sandbox_id.clone();
    let provider_id = context.provider_id.clone();
    let key = openshell::coalescing_key(&context, &targets);

    let in_flight = match limiter.try_begin(&sandbox_id, &provider_id, &key) {
        Ok(guard) => guard,
        Err(LimitRefusal::InFlight) => {
            return Some(openshell::reply_with(
                WireStatus::RateLimited,
                "Another request for this provider is already waiting for approval",
            ));
        }
        Err(LimitRefusal::CoolingDown) => {
            return Some(openshell::reply_with(
                WireStatus::RateLimited,
                "This provider was recently denied; try again later",
            ));
        }
    };
    let dispatch_token = next_dispatch_token();

    // Ids only (§M8.12 logging rule, mirrored here): never names, endpoints or values.
    debug!(
        provider_id = %provider_id,
        sandbox_id = %sandbox_id,
        client_name = client.as_ref().map(|c| c.name.as_str()),
        peer_pid = peer.as_ref().map(|p| p.pid),
        "agent_access: OpenShell resolve request"
    );
    emit_event(
        &event_sink,
        "credential_requested",
        &peer,
        Some("providerResolve".to_string()),
        None,
    );

    let dispatch_timeout = CALLBACK_TIMEOUT.min(context.deadline);
    let request_data = CredentialRequestData {
        // §M8.7 / §M8.18: no query rides a provider resolve; `query_value` carries only the
        // value-free dispatch token main uses to correlate an `openshellRequestAbandoned` event.
        query_type: CredentialQueryKind::Id,
        query_value: dispatch_token.clone(),
        requester_fingerprint: None,
        requester_name: None,
        // From the listener kind, never from the wire (§M8.5).
        origin: CredentialRequestOrigin::OpenShell,
        local_peer: peer.clone(),
        delivery_mode: None,
        resource: ResourceKind::Credential,
        operation: RequestOperation::ProviderResolve,
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
        openshell: Some(context),
        provider_targets: targets.clone(),
    };

    let dispatch = tokio::time::timeout(
        dispatch_timeout,
        credential_handler.handle_credential_request(request_data),
    );
    let outcome = tokio::select! {
        outcome = dispatch => outcome,
        () = hangup => {
            drop(in_flight);
            debug!(
                provider_id = %provider_id,
                sandbox_id = %sandbox_id,
                "agent_access: OpenShell driver hung up before the reply; dispatch abandoned"
            );
            emit_event(
                &event_sink,
                OPENSHELL_ABANDONED_EVENT_KIND,
                &None,
                Some(dispatch_token),
                None,
            );
            return None;
        }
    };

    let reply = openshell::build_reply(outcome, &targets, now_ms());
    if reply.starts_cooldown() {
        limiter.start_cooldown(&sandbox_id, &provider_id);
    }
    drop(in_flight);
    // Ids and the status only (§M8.12 logging rule).
    debug!(
        provider_id = %provider_id,
        sandbox_id = %sandbox_id,
        status = ?reply.status,
        "agent_access: OpenShell resolve answered"
    );
    emit_event(&event_sink, reply.event_kind, &peer, None, None);
    Some(reply)
}

/// Resolves `pid` into a full [`LocalPeerInfo`] (`LocalPeerInfo::from_pid`) and runs W2a
/// attestation (parent-chain walk + code-signature verification) on the blocking thread pool,
/// per both `peer_info`'s and `crate::attestation`'s blocking contracts. `None` in, `None` out —
/// there is nothing to attest when the peer PID itself couldn't be captured at accept time.
///
/// Both steps used to run partly on the accept path (`LocalPeerInfo::from_pid` was called
/// synchronously inside the platform `accept()` implementations) — a blocking `sysinfo`/`libproc`
/// call there would serialize every accept behind one peer's process lookup. `pid` is captured
/// at accept time (kernel-verified, never self-reported) and threaded through unchanged; only
/// its *resolution* into process metadata happens here, off that path.
///
/// A panic inside the blocking task (which neither `LocalPeerInfo::from_pid` nor
/// `crate::attestation::attest` is documented to cause, but this is a peer-triggered code path,
/// so treat it as possible anyway) must not take down the connection: degrade to a minimal,
/// pid-only `LocalPeerInfo` (mirroring `LocalPeerInfo::from_pid`'s own resolution-failure
/// fallback) rather than propagating the join error.
async fn attest_peer(pid: Option<u32>) -> Option<LocalPeerInfo> {
    let pid = pid?;
    let attested = tokio::task::spawn_blocking(move || {
        crate::attestation::attest(LocalPeerInfo::from_pid(pid))
    })
    .await
    .unwrap_or(LocalPeerInfo {
        pid,
        process_name: None,
        exe_path: None,
        parent: None,
        signature: None,
    });
    Some(attested)
}

fn query_kind_label(kind: CredentialQueryKind) -> &'static str {
    match kind {
        CredentialQueryKind::Domain => "domain",
        CredentialQueryKind::Id => "id",
        CredentialQueryKind::Search => "search",
        CredentialQueryKind::Name => "name",
    }
}

/// Hands an [`AgentAccessEvent`] to `event_sink` on its own detached task — mirrors
/// `client::forward_notification_event` so a slow/hung host callback can never stall the
/// connection handler that produced the event.
fn emit_event(
    event_sink: &Arc<dyn EventSink>,
    kind: &'static str,
    peer: &Option<LocalPeerInfo>,
    detail: Option<String>,
    fields_shared: Option<String>,
) {
    let sink = Arc::clone(event_sink);
    let peer_name = peer.as_ref().and_then(|p| p.process_name.clone());
    tokio::spawn(async move {
        sink.on_event(AgentAccessEvent {
            kind: kind.to_string(),
            timestamp_ms: AgentAccessEvent::now_ms(),
            peer_fingerprint: None,
            peer_name,
            detail,
            fields_shared,
        })
        .await;
    });
}

enum ReadOutcome {
    Line(Vec<u8>),
    Closed,
    TooLong,
}

/// Reads bytes up to and excluding the first `\n`, capped at
/// [`local_protocol::MAX_LINE_LEN`]. One byte at a time is enough here: this is a low-throughput,
/// one-request-per-connection protocol, and it keeps the cap check trivially exact (no
/// over-read past the limit to trim back off).
async fn read_request_line<S: AsyncRead + Unpin>(stream: &mut S) -> std::io::Result<ReadOutcome> {
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        let n = stream.read(&mut byte).await?;
        if n == 0 {
            return Ok(ReadOutcome::Closed);
        }
        if byte[0] == b'\n' {
            return Ok(ReadOutcome::Line(buf));
        }
        buf.push(byte[0]);
        if buf.len() > local_protocol::MAX_LINE_LEN {
            return Ok(ReadOutcome::TooLong);
        }
    }
}

async fn reply<S: AsyncWrite + Unpin>(stream: &mut S, response: &WireResponse) {
    let Ok(mut bytes) = serde_json::to_vec(response) else {
        // Serializing our own well-typed struct should never fail; if it somehow does, there's
        // nothing meaningful left to send.
        return;
    };
    bytes.push(b'\n');
    let _ = stream.write_all(&bytes).await;
}

#[cfg(test)]
mod tests {
    use async_trait::async_trait;
    use tokio::io::{AsyncBufReadExt, BufReader};

    use super::*;
    use crate::callbacks::{
        CallbackError, CredentialDenialReason, CredentialResponseData, ResourceKind,
    };

    struct ApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for ApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.origin, CredentialRequestOrigin::Local);
            assert!(request.requester_fingerprint.is_none());
            Ok(CredentialResponseData {
                approved: true,
                username: Some("user@example.com".to_string()),
                password: Some("hunter2".to_string()),
                totp: Some("123456".to_string()),
                credential_id: Some("cipher-1".to_string()),
                uri: Some(request.query_value),
                item_name: Some("GitHub".to_string()),
                ..Default::default()
            })
        }
    }

    struct SecretApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for SecretApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.origin, CredentialRequestOrigin::Local);
            assert_eq!(request.resource, ResourceKind::Secret);
            assert_eq!(request.query_type, CredentialQueryKind::Name);
            Ok(CredentialResponseData {
                approved: true,
                item_name: Some(request.query_value),
                secret_value: Some(zeroize::Zeroizing::new("super-secret".to_string())),
                secret_id: Some("secret-1".to_string()),
                ..Default::default()
            })
        }
    }

    /// Asserts a `secretCreate` request threads `operation`/the `new_secret_*` fields correctly
    /// into [`CredentialRequestData`], and that the incoming value moved into a `Zeroizing`
    /// field rather than an accidental plain `String` clone.
    struct CreateApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for CreateApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.origin, CredentialRequestOrigin::Local);
            assert_eq!(request.resource, ResourceKind::Secret);
            assert_eq!(request.operation, RequestOperation::Create);
            assert!(request.delivery_mode.is_none());
            assert_eq!(request.new_secret_name.as_deref(), Some("DB_PASSWORD"));
            assert_eq!(
                request.new_secret_value.as_deref().map(String::as_str),
                Some("hunter2")
            );
            assert_eq!(request.new_secret_note.as_deref(), Some("prod db"));
            assert_eq!(request.project_hint.as_deref(), Some("my-app"));
            Ok(CredentialResponseData {
                approved: true,
                item_name: Some("DB_PASSWORD".to_string()),
                secret_id: Some("secret-1".to_string()),
                ..Default::default()
            })
        }
    }

    /// Asserts a `projectCreate` request carries `resource: Project` and no value/generate/
    /// note/project fields.
    struct ProjectCreateApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for ProjectCreateApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.resource, ResourceKind::Project);
            assert_eq!(request.operation, RequestOperation::Create);
            assert_eq!(request.new_secret_name.as_deref(), Some("my-app"));
            assert!(request.new_secret_value.is_none());
            assert!(!request.generate_value);
            Ok(CredentialResponseData {
                approved: true,
                item_name: Some("my-app".to_string()),
                project_id: Some("project-1".to_string()),
                ..Default::default()
            })
        }
    }

    /// Asserts a `secretUpdate` request threads `target_id`/the `new_secret_*`/`generate_*`
    /// fields correctly, and that `query_value` is force-filled with the target id (M6's
    /// "Invariant guard extension" — the main-process activity buffer must never see names for
    /// a non-lookup op).
    struct UpdateApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for UpdateApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.resource, ResourceKind::Secret);
            assert_eq!(request.operation, RequestOperation::Update);
            assert_eq!(request.target_id.as_deref(), Some("secret-1"));
            assert_eq!(request.query_type, CredentialQueryKind::Id);
            assert_eq!(request.query_value, "secret-1");
            assert_eq!(request.new_secret_name.as_deref(), Some("NEW_NAME"));
            assert_eq!(
                request.new_secret_value.as_deref().map(String::as_str),
                Some("new-value")
            );
            assert_eq!(request.new_secret_note.as_deref(), Some(""));
            assert_eq!(request.project_hint.as_deref(), Some("my-app"));
            Ok(CredentialResponseData {
                approved: true,
                item_name: Some("NEW_NAME".to_string()),
                secret_id: Some("secret-1".to_string()),
                ..Default::default()
            })
        }
    }

    /// Asserts a `secretDelete` request threads `target_id` correctly and carries none of the
    /// create/update fields.
    struct DeleteApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for DeleteApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.resource, ResourceKind::Secret);
            assert_eq!(request.operation, RequestOperation::Delete);
            assert_eq!(request.target_id.as_deref(), Some("secret-1"));
            assert_eq!(request.query_type, CredentialQueryKind::Id);
            assert_eq!(request.query_value, "secret-1");
            assert!(request.new_secret_name.is_none());
            assert!(request.new_secret_value.is_none());
            Ok(CredentialResponseData {
                approved: true,
                item_name: Some("DB_PASSWORD".to_string()),
                secret_id: Some("secret-1".to_string()),
                ..Default::default()
            })
        }
    }

    /// Asserts a `projectList` request carries `resource: Project`, `operation: List`, and an
    /// empty `query_value` (M6's force-fill rule: "list -> empty string").
    struct ListApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for ListApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.resource, ResourceKind::Project);
            assert_eq!(request.operation, RequestOperation::List);
            assert_eq!(request.query_value, "");
            assert!(request.target_id.is_none());
            Ok(CredentialResponseData {
                approved: true,
                projects: Some(vec![crate::callbacks::ProjectEntry {
                    id: "project-1".to_string(),
                    name: "My Project".to_string(),
                    write: true,
                    organization: Some("Acme".to_string()),
                }]),
                ..Default::default()
            })
        }
    }

    /// Approves a `delivery: "fill"` request, returning a `fill_result` pass-through matching
    /// the wire example in agent-access-architecture.md's "M5" section. Also sets
    /// `password`/`totp` on the response (a misbehaving-handler scenario) so the round-trip test
    /// can assert the reply never echoes them regardless — see `build_approved_fill`'s docs.
    struct FillApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for FillApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.origin, CredentialRequestOrigin::Local);
            assert_eq!(request.resource, ResourceKind::Credential);
            assert_eq!(
                request.delivery_mode,
                Some(crate::callbacks::DeliveryMode::Fill)
            );
            Ok(CredentialResponseData {
                approved: true,
                username: Some("demo@bitnotes.io".to_string()),
                password: Some("hunter2".to_string()),
                totp: Some("123456".to_string()),
                credential_id: Some("cipher-1".to_string()),
                item_name: Some("bitnotes.io".to_string()),
                fill_result: Some(
                    r#"{"status":"filled","origin":"https://bitnotes.io",
                        "fields":[{"role":"username","status":"filled",
                        "target":"input#email (login form)"},
                        {"role":"password","status":"filled",
                        "target":"input[type=password]#pw"}]}"#
                        .to_string(),
                ),
                fill_fields_shared: Some(vec!["username".to_string(), "password".to_string()]),
                ..Default::default()
            })
        }
    }

    /// Denies a `delivery: "fill"` request with the given pre-prompt reason + value-free detail
    /// (origin for `OriginMismatch`, reason code for `NoSafeTarget`).
    struct FillDenyingHandler(CredentialDenialReason, &'static str);

    #[async_trait]
    impl CredentialRequestHandler for FillDenyingHandler {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            Ok(CredentialResponseData {
                approved: false,
                reason: Some(self.0),
                denial_detail: Some(self.1.to_string()),
                ..Default::default()
            })
        }
    }

    /// Approves a `describeFillTarget` request, asserting it carries no query (M5 invariant 12:
    /// "touches no vault data").
    struct DescribeFillTargetApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for DescribeFillTargetApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            assert_eq!(request.origin, CredentialRequestOrigin::Local);
            assert_eq!(request.operation, RequestOperation::DescribeFillTarget);
            assert!(request.delivery_mode.is_none());
            assert_eq!(request.query_value, "");
            Ok(CredentialResponseData {
                approved: true,
                fill_target: Some(
                    r#"{"origin":"https://bitnotes.io","formClass":"login",
                        "candidates":[],"refusals":[],"targetToken":"ft_abc",
                        "expiresInMs":30000}"#
                        .to_string(),
                ),
                ..Default::default()
            })
        }
    }

    struct DenyingHandler(Option<CredentialDenialReason>);

    #[async_trait]
    impl CredentialRequestHandler for DenyingHandler {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            Ok(CredentialResponseData {
                approved: false,
                reason: self.0,
                ..Default::default()
            })
        }
    }

    struct NoopEventSink;

    #[async_trait]
    impl EventSink for NoopEventSink {
        async fn on_event(&self, _event: AgentAccessEvent) {}
    }

    /// Forwards every event to an unbounded channel — lets tests assert on activity-log output
    /// without racing the detached `emit_event` task.
    struct ChannelEventSink(tokio::sync::mpsc::UnboundedSender<AgentAccessEvent>);

    #[async_trait]
    impl EventSink for ChannelEventSink {
        async fn on_event(&self, event: AgentAccessEvent) {
            let _ = self.0.send(event);
        }
    }

    async fn round_trip(
        request_line: &str,
        handler: Arc<dyn CredentialRequestHandler>,
        event_sink: Arc<dyn EventSink>,
    ) -> String {
        let (mut client, server) = tokio::io::duplex(4096);
        let task = tokio::spawn(handle_connection(
            server,
            None,
            ListenerKind::Agent,
            handler,
            event_sink,
            Arc::new(OpenShellLimiter::default()),
        ));

        client.write_all(request_line.as_bytes()).await.unwrap();

        let mut reader = BufReader::new(&mut client);
        let mut line = String::new();
        reader.read_line(&mut line).await.unwrap();
        task.await.unwrap();
        line
    }

    #[tokio::test]
    async fn approved_inject_reply_carries_values_and_reference() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\",\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(request, Arc::new(ApprovingHandler), Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://item/cipher-1\""));
        assert!(line.contains("hunter2"));
        assert!(line.contains("123456"));
        assert!(!line.contains("\"item\""));
    }

    #[tokio::test]
    async fn secret_request_wire_round_trip_inject() {
        let request = "{\"version\":1,\"op\":\"secretRequest\",\
            \"query\":{\"type\":\"name\",\"value\":\"DB_PASSWORD\"},\
            \"delivery\":\"inject\",\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(SecretApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(line.contains("\"secret\""));
        assert!(line.contains("super-secret"));
        assert!(line.contains("DB_PASSWORD"));
        assert!(!line.contains("\"credential\""));
        assert!(!line.contains("\"item\""));
    }

    #[tokio::test]
    async fn secret_request_wire_round_trip_reference_strips_value() {
        let request = "{\"version\":1,\"op\":\"secretRequest\",\
            \"query\":{\"type\":\"name\",\"value\":\"DB_PASSWORD\"},\
            \"delivery\":\"reference\"}\n";
        let line = round_trip(
            request,
            Arc::new(SecretApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(line.contains("\"item\""));
        assert!(line.contains("DB_PASSWORD"));
        assert!(
            !line.contains("\"secret\""),
            "reference-mode replies must never carry a secret object"
        );
        assert!(
            !line.contains("super-secret"),
            "the secret value must never appear in a reference-mode reply"
        );
    }

    #[tokio::test]
    async fn secret_request_with_domain_query_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"secretRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\"}\n";
        let line = round_trip(
            request,
            Arc::new(SecretApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"error\""));
    }

    /// End-to-end `secretCreate` round trip: the exact request literal from
    /// agent-access-architecture.md's "M4b — secret creation" wire section, matched against the
    /// exact approved-response literal from the same section.
    #[tokio::test]
    async fn secret_create_wire_round_trip() {
        let request = "{\"version\":1,\"op\":\"secretCreate\",\
            \"create\":{\"name\":\"DB_PASSWORD\",\"value\":\"hunter2\",\
            \"note\":\"prod db\",\"project\":\"my-app\"},\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(CreateApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(line.contains("\"item\""));
        assert!(line.contains("DB_PASSWORD"));
        assert!(
            !line.contains("\"secret\""),
            "a create response must never carry a secret object"
        );
        assert!(
            !line.contains("\"value\""),
            "a create response must never carry a value key"
        );
        assert!(
            !line.contains("hunter2"),
            "the created value must never be echoed back"
        );
        assert!(
            !line.contains("prod db"),
            "the note must never appear in a local reply"
        );
    }

    // --- M6 round trips: projectCreate/secretUpdate/secretDelete/projectList -----------------

    #[tokio::test]
    async fn project_create_wire_round_trip() {
        let request = "{\"version\":1,\"op\":\"projectCreate\",\
            \"create\":{\"name\":\"my-app\"},\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(ProjectCreateApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://project/project-1\""));
        assert!(line.contains("\"item\""));
        assert!(line.contains("my-app"));
        assert!(!line.contains("\"secret\""));
        assert!(!line.contains("\"credential\""));
    }

    #[tokio::test]
    async fn secret_update_wire_round_trip() {
        let request = "{\"version\":1,\"op\":\"secretUpdate\",\
            \"target\":{\"id\":\"secret-1\"},\
            \"update\":{\"name\":\"NEW_NAME\",\"value\":\"new-value\",\"note\":\"\",\
            \"project\":\"my-app\"},\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(UpdateApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(line.contains("\"item\""));
        assert!(line.contains("NEW_NAME"));
        assert!(
            !line.contains("\"secret\""),
            "an update response must never carry a secret object"
        );
        assert!(
            !line.contains("new-value"),
            "the updated value must never be echoed back"
        );
    }

    #[tokio::test]
    async fn secret_delete_wire_round_trip() {
        let request = "{\"version\":1,\"op\":\"secretDelete\",\
            \"target\":{\"id\":\"secret-1\"},\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(DeleteApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://secret/secret-1\""));
        assert!(line.contains("\"item\""));
        assert!(!line.contains("\"secret\""));
    }

    #[tokio::test]
    async fn project_list_wire_round_trip() {
        let request =
            "{\"version\":1,\"op\":\"projectList\",\"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(ListApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"projects\""));
        assert!(line.contains("My Project"));
        assert!(line.contains("bw://project/project-1"));
        assert!(!line.contains("\"reference\":\"bw://item"));
        assert!(!line.contains("\"item\""));
    }

    /// Force-fill matrix (M6's "Invariant guard extension"): `query_value` must never carry a
    /// name for a non-lookup op — create uses the proposed name (existing, M4b), update/delete
    /// use the target id, and list uses the empty string. Asserted here (rather than only via
    /// the handler assertions above) so the rule is pinned in one place per op.
    #[tokio::test]
    async fn query_value_force_fill_matrix() {
        struct RecordingHandler(Arc<std::sync::Mutex<Option<(CredentialQueryKind, String)>>>);

        #[async_trait]
        impl CredentialRequestHandler for RecordingHandler {
            async fn handle_credential_request(
                &self,
                request: CredentialRequestData,
            ) -> Result<CredentialResponseData, CallbackError> {
                *self.0.lock().unwrap() = Some((request.query_type, request.query_value));
                Ok(CredentialResponseData {
                    approved: true,
                    item_name: Some("x".to_string()),
                    secret_id: Some("id-1".to_string()),
                    project_id: Some("id-1".to_string()),
                    projects: Some(vec![]),
                    ..Default::default()
                })
            }
        }

        let cases: [(&str, CredentialQueryKind, &str); 4] = [
            (
                "{\"version\":1,\"op\":\"secretCreate\",\"create\":{\"name\":\"NEW\",\"value\":\"v\"}}\n",
                CredentialQueryKind::Name,
                "NEW",
            ),
            (
                "{\"version\":1,\"op\":\"secretUpdate\",\"target\":{\"id\":\"id-1\"},\"update\":{\"name\":\"n\"}}\n",
                CredentialQueryKind::Id,
                "id-1",
            ),
            (
                "{\"version\":1,\"op\":\"secretDelete\",\"target\":{\"id\":\"id-1\"}}\n",
                CredentialQueryKind::Id,
                "id-1",
            ),
            (
                "{\"version\":1,\"op\":\"projectList\"}\n",
                CredentialQueryKind::Search,
                "",
            ),
        ];

        for (request, expected_kind, expected_value) in cases {
            let recorded = Arc::new(std::sync::Mutex::new(None));
            let handler = Arc::new(RecordingHandler(Arc::clone(&recorded)));
            let _line = round_trip(request, handler, Arc::new(NoopEventSink)).await;
            let (kind, value) = recorded
                .lock()
                .unwrap()
                .clone()
                .unwrap_or_else(|| panic!("handler was never invoked for request {request:?}"));
            assert_eq!(kind, expected_kind, "request {request:?}");
            assert_eq!(value, expected_value, "request {request:?}");
        }
    }

    // --- fill / describeFillTarget wire round trips (M5) --------------------------------------

    #[tokio::test]
    async fn fill_request_wire_round_trip_approved() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"},\
            \"delivery\":\"fill\",\
            \"fill\":{\"fields\":[\"username\",\"password\"]},\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(FillApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://item/cipher-1\""));
        assert!(line.contains("\"item\""));
        assert!(line.contains("bitnotes.io"));
        assert!(line.contains("\"fill\""));
        assert!(line.contains("\"status\":\"filled\""));
        assert!(
            !line.contains("\"credential\""),
            "a fill-delivery reply must never carry a credential object"
        );
        assert!(
            !line.contains("hunter2"),
            "the password must never appear in a fill-delivery reply"
        );
        assert!(
            !line.contains("123456"),
            "the totp must never appear in a fill-delivery reply"
        );
    }

    #[tokio::test]
    async fn fill_request_origin_mismatch_is_a_pre_prompt_refusal() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"},\
            \"delivery\":\"fill\"}\n";
        let handler = Arc::new(FillDenyingHandler(
            CredentialDenialReason::OriginMismatch,
            "https://evil.example",
        ));
        let line = round_trip(request, handler, Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"originMismatch\""));
        assert!(line.contains("https://evil.example"));
        assert!(
            !line.contains("\"status\":\"denied\""),
            "a mechanical origin refusal must never be reported as a user denial"
        );
    }

    #[tokio::test]
    async fn fill_request_no_safe_target_is_a_pre_prompt_refusal_with_reason_passthrough() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"},\
            \"delivery\":\"fill\"}\n";
        let handler = Arc::new(FillDenyingHandler(
            CredentialDenialReason::NoSafeTarget,
            "looks-like-registration",
        ));
        let line = round_trip(request, handler, Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"noSafeTarget\""));
        assert!(line.contains("looks-like-registration"));
        assert!(
            !line.contains("\"status\":\"denied\""),
            "a mechanical no-safe-target refusal must never be reported as a user denial"
        );
    }

    #[tokio::test]
    async fn describe_fill_target_wire_round_trip_approved() {
        let request = "{\"version\":1,\"op\":\"describeFillTarget\",\
            \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n";
        let line = round_trip(
            request,
            Arc::new(DescribeFillTargetApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"fillTarget\""));
        assert!(line.contains("ft_abc"));
        assert!(
            !line.contains("\"item\""),
            "describeFillTarget touches no vault data — no item in the reply"
        );
        assert!(!line.contains("\"reference\""));
        assert!(!line.contains("\"credential\""));
        assert!(!line.contains("\"secret\""));
        // `fill` (the fill-delivery outcome object) is a different key from `fillTarget` and
        // must not appear on a describe reply.
        assert!(!line.contains("\"fill\":"));
    }

    #[tokio::test]
    async fn describe_fill_target_with_a_query_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"describeFillTarget\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"}}\n";
        let line = round_trip(
            request,
            Arc::new(DescribeFillTargetApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn secret_request_with_delivery_fill_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"secretRequest\",\
            \"query\":{\"type\":\"name\",\"value\":\"DB_PASSWORD\"},\
            \"delivery\":\"fill\"}\n";
        let line = round_trip(
            request,
            Arc::new(SecretApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn fill_request_with_unknown_role_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"},\
            \"delivery\":\"fill\",\
            \"fill\":{\"fields\":[\"username\",\"notes\"]}}\n";
        let line = round_trip(
            request,
            Arc::new(FillApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn fill_params_on_inject_delivery_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"},\
            \"delivery\":\"inject\",\
            \"fill\":{\"fields\":[\"username\"]}}\n";
        let line = round_trip(request, Arc::new(ApprovingHandler), Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn fill_emits_requested_and_approved_activity_events_with_filled_fields_shared() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"bitnotes.io\"},\
            \"delivery\":\"fill\"}\n";
        let _line = round_trip(
            request,
            Arc::new(FillApprovingHandler),
            Arc::new(ChannelEventSink(tx)),
        )
        .await;

        let requested = rx.recv().await.unwrap();
        assert_eq!(requested.kind, "credential_requested");
        assert_eq!(requested.detail.as_deref(), Some("domain"));

        let approved = rx.recv().await.unwrap();
        assert_eq!(approved.kind, "credential_approved");
        assert_eq!(approved.fields_shared.as_deref(), Some("username,password"));
    }

    #[tokio::test]
    async fn describe_fill_target_emits_requested_with_describe_detail() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let request = "{\"version\":1,\"op\":\"describeFillTarget\"}\n";
        let _line = round_trip(
            request,
            Arc::new(DescribeFillTargetApprovingHandler),
            Arc::new(ChannelEventSink(tx)),
        )
        .await;

        let requested = rx.recv().await.unwrap();
        assert_eq!(requested.kind, "credential_requested");
        assert_eq!(requested.detail.as_deref(), Some("describeFillTarget"));

        let approved = rx.recv().await.unwrap();
        assert_eq!(approved.kind, "credential_approved");
        assert!(
            approved.fields_shared.is_none(),
            "describeFillTarget touches no vault data, so nothing is \"shared\""
        );
    }

    #[tokio::test]
    async fn credential_request_with_create_object_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\",\
            \"create\":{\"name\":\"x\",\"value\":\"y\"}}\n";
        let line = round_trip(request, Arc::new(ApprovingHandler), Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn secret_create_with_no_create_object_is_rejected_as_protocol_error() {
        let request = "{\"version\":1,\"op\":\"secretCreate\"}\n";
        let line = round_trip(
            request,
            Arc::new(CreateApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .await;

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn secret_create_emits_requested_with_create_detail_and_no_fields_shared_on_approval() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let request = "{\"version\":1,\"op\":\"secretCreate\",\
            \"create\":{\"name\":\"DB_PASSWORD\",\"value\":\"hunter2\",\
            \"note\":\"prod db\",\"project\":\"my-app\"}}\n";
        let _line = round_trip(
            request,
            Arc::new(CreateApprovingHandler),
            Arc::new(ChannelEventSink(tx)),
        )
        .await;

        let requested = rx.recv().await.unwrap();
        assert_eq!(requested.kind, "credential_requested");
        assert_eq!(requested.detail.as_deref(), Some("create"));

        let approved = rx.recv().await.unwrap();
        assert_eq!(approved.kind, "credential_approved");
        assert!(
            approved.fields_shared.is_none(),
            "nothing is released on a create, so fields_shared must be None"
        );
    }

    #[tokio::test]
    async fn reference_mode_strips_values_even_though_handler_returned_them() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"reference\"}\n";
        let line = round_trip(request, Arc::new(ApprovingHandler), Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://item/cipher-1\""));
        assert!(line.contains("\"item\""));
        assert!(line.contains("GitHub"));
        assert!(!line.contains("\"credential\""));
        assert!(
            !line.contains("hunter2"),
            "password must never appear in a reference-mode reply"
        );
        assert!(
            !line.contains("123456"),
            "totp must never appear in a reference-mode reply"
        );
    }

    #[tokio::test]
    async fn denial_reason_not_found_maps_to_not_found_status() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\"}\n";
        let handler = Arc::new(DenyingHandler(Some(CredentialDenialReason::NotFound)));
        let line = round_trip(request, handler, Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"notFound\""));
    }

    #[tokio::test]
    async fn denial_reason_denied_maps_to_denied_status() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\"}\n";
        let handler = Arc::new(DenyingHandler(Some(CredentialDenialReason::Denied)));
        let line = round_trip(request, handler, Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"denied\""));
    }

    #[tokio::test]
    async fn denial_reason_locked_maps_to_locked_status_never_denied() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\"}\n";
        let handler = Arc::new(DenyingHandler(Some(CredentialDenialReason::Locked)));
        let line = round_trip(request, handler, Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"locked\""));
        assert!(
            !line.contains("\"status\":\"denied\""),
            "a locked vault must never be reported as a user denial"
        );
    }

    #[tokio::test]
    async fn denial_reason_internal_maps_to_error_status_never_denied() {
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\"}\n";
        let handler = Arc::new(DenyingHandler(Some(CredentialDenialReason::Internal)));
        let line = round_trip(request, handler, Arc::new(NoopEventSink)).await;

        assert!(line.contains("\"status\":\"error\""));
        assert!(
            !line.contains("\"status\":\"denied\""),
            "a non-user failure must never be reported as a user denial"
        );
    }

    #[tokio::test]
    async fn malformed_line_returns_error_reply() {
        let (mut client, server) = tokio::io::duplex(4096);
        let task = tokio::spawn(handle_connection(
            server,
            None,
            ListenerKind::Agent,
            Arc::new(ApprovingHandler),
            Arc::new(NoopEventSink),
            Arc::new(OpenShellLimiter::default()),
        ));
        client.write_all(b"not json at all\n").await.unwrap();

        let mut reader = BufReader::new(&mut client);
        let mut line = String::new();
        reader.read_line(&mut line).await.unwrap();
        task.await.unwrap();

        assert!(line.contains("\"status\":\"error\""));
    }

    #[tokio::test]
    async fn oversized_line_is_rejected() {
        let (mut client, server) = tokio::io::duplex(local_protocol::MAX_LINE_LEN * 2);
        let task = tokio::spawn(handle_connection(
            server,
            None,
            ListenerKind::Agent,
            Arc::new(ApprovingHandler),
            Arc::new(NoopEventSink),
            Arc::new(OpenShellLimiter::default()),
        ));

        let oversized = vec![b'a'; local_protocol::MAX_LINE_LEN + 1];
        client.write_all(&oversized).await.unwrap();

        let mut reader = BufReader::new(&mut client);
        let mut line = String::new();
        reader.read_line(&mut line).await.unwrap();
        task.await.unwrap();

        assert!(line.contains("\"status\":\"error\""));
        assert!(line.contains("request too large"));
    }

    #[tokio::test]
    async fn emits_requested_and_approved_activity_events() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let request = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
            \"delivery\":\"inject\"}\n";
        let _line = round_trip(
            request,
            Arc::new(ApprovingHandler),
            Arc::new(ChannelEventSink(tx)),
        )
        .await;

        let requested = rx.recv().await.unwrap();
        assert_eq!(requested.kind, "credential_requested");
        assert_eq!(requested.detail.as_deref(), Some("domain"));
        assert!(requested.peer_fingerprint.is_none());

        let approved = rx.recv().await.unwrap();
        assert_eq!(approved.kind, "credential_approved");
        assert_eq!(
            approved.fields_shared.as_deref(),
            Some("username,password,totp,uri")
        );
    }

    // --- accept_loop: concurrency cap (finding 1) and cancellation-on-abort (finding 2) -------

    use std::sync::atomic::{AtomicUsize, Ordering};

    use tokio::sync::{mpsc, watch};

    /// A [`LocalListener`] fed by a channel instead of a real socket/pipe, so `accept_loop`'s
    /// concurrency-cap and cancellation behavior can be exercised directly, without needing a
    /// platform transport.
    struct QueueListener {
        rx: mpsc::UnboundedReceiver<(tokio::io::DuplexStream, Option<u32>)>,
    }

    #[async_trait]
    impl LocalListener for QueueListener {
        type Stream = tokio::io::DuplexStream;

        async fn accept(&mut self) -> std::io::Result<(Self::Stream, Option<u32>)> {
            self.rx
                .recv()
                .await
                .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::BrokenPipe, "queue closed"))
        }
    }

    /// A [`CredentialRequestHandler`] that blocks inside the handler until `gate` is set to
    /// `true`, incrementing `active` for the duration. Lets tests deterministically observe "N
    /// requests are currently inside the handler" (via [`wait_until_active`]) without racing the
    /// scheduler.
    struct GatedHandler {
        gate: watch::Receiver<bool>,
        active: Arc<AtomicUsize>,
    }

    #[async_trait]
    impl CredentialRequestHandler for GatedHandler {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            self.active.fetch_add(1, Ordering::SeqCst);
            let mut gate = self.gate.clone();
            while !*gate.borrow() {
                if gate.changed().await.is_err() {
                    break;
                }
            }
            self.active.fetch_sub(1, Ordering::SeqCst);
            Ok(CredentialResponseData {
                approved: false,
                ..Default::default()
            })
        }
    }

    /// Polls `active` until it reaches `target`, bounded by an overall 5s timeout — used instead
    /// of a wake-based signal (e.g. `Notify::notify_one`, which only ever buffers a *single*
    /// permit and would silently coalesce N>1 concurrent signals) so tests can wait for exactly
    /// "N handlers are currently blocked" with an arbitrary N.
    async fn wait_until_active(active: &AtomicUsize, target: usize) {
        tokio::time::timeout(Duration::from_secs(5), async {
            while active.load(Ordering::SeqCst) != target {
                tokio::time::sleep(Duration::from_millis(2)).await;
            }
        })
        .await
        .unwrap_or_else(|_| {
            panic!(
                "active handler count never reached {target} (stuck at {})",
                active.load(Ordering::SeqCst)
            )
        });
    }

    const VALID_REQUEST: &str = "{\"version\":1,\"op\":\"credentialRequest\",\
        \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
        \"delivery\":\"inject\"}\n";

    #[tokio::test]
    async fn connections_beyond_the_cap_are_rate_limited_not_dispatched() {
        let (queue_tx, queue_rx) = mpsc::unbounded_channel();
        let listener = QueueListener { rx: queue_rx };

        let (_gate_tx, gate_rx) = watch::channel(false);
        let active = Arc::new(AtomicUsize::new(0));
        let handler = Arc::new(GatedHandler {
            gate: gate_rx,
            active: Arc::clone(&active),
        });

        let loop_task = tokio::spawn(accept_loop(
            listener,
            ListenerKind::Agent,
            handler,
            Arc::new(NoopEventSink) as Arc<dyn EventSink>,
        ));

        // Fill the listener to capacity: each connection's handler call blocks on `gate`, so
        // all `MAX_CONCURRENT_CONNECTIONS` permits stay held for the duration of this test.
        let mut saturating_clients = Vec::new();
        for _ in 0..MAX_CONCURRENT_CONNECTIONS {
            let (mut client, server) = tokio::io::duplex(4096);
            queue_tx.send((server, None)).unwrap();
            client.write_all(VALID_REQUEST.as_bytes()).await.unwrap();
            saturating_clients.push(client);
        }
        wait_until_active(&active, MAX_CONCURRENT_CONNECTIONS).await;

        // One more connection, beyond the cap: must be answered immediately with
        // `rateLimited`, never handed to the (still-blocked) credential handler.
        let (mut extra_client, extra_server) = tokio::io::duplex(4096);
        queue_tx.send((extra_server, None)).unwrap();
        extra_client
            .write_all(VALID_REQUEST.as_bytes())
            .await
            .unwrap();

        let mut reader = BufReader::new(&mut extra_client);
        let mut line = String::new();
        tokio::time::timeout(Duration::from_secs(5), reader.read_line(&mut line))
            .await
            .expect("a rate-limited reply must arrive promptly, not wait on the handler")
            .unwrap();
        assert!(line.contains("\"status\":\"rateLimited\""));

        // The excess connection must never have bumped `active` — it was never dispatched.
        assert_eq!(active.load(Ordering::SeqCst), MAX_CONCURRENT_CONNECTIONS);

        loop_task.abort();
    }

    #[tokio::test]
    async fn aborting_the_accept_loop_cancels_in_flight_connections() {
        let (queue_tx, queue_rx) = mpsc::unbounded_channel();
        let listener = QueueListener { rx: queue_rx };

        let (gate_tx, gate_rx) = watch::channel(false);
        let active = Arc::new(AtomicUsize::new(0));
        let handler = Arc::new(GatedHandler {
            gate: gate_rx,
            active: Arc::clone(&active),
        });

        let loop_task = tokio::spawn(accept_loop(
            listener,
            ListenerKind::Agent,
            handler,
            Arc::new(NoopEventSink) as Arc<dyn EventSink>,
        ));

        let (mut client, server) = tokio::io::duplex(4096);
        queue_tx.send((server, None)).unwrap();
        client.write_all(VALID_REQUEST.as_bytes()).await.unwrap();

        // Wait until the connection is genuinely in-flight (inside the handler, blocked on the
        // 60s-class approval callback this simulates) before simulating `stop()`.
        wait_until_active(&active, 1).await;

        // Mirrors `DesktopAgentAccess::stop`, which aborts the `JoinHandle` `local_listener::spawn`
        // returned — see `accept_loop`'s docs for why that cascades into aborting this
        // in-flight connection too.
        loop_task.abort();
        let join_error = loop_task.await.unwrap_err();
        assert!(join_error.is_cancelled());

        // No reply must ever be written for the in-flight request: the client sees the
        // connection close (EOF) rather than a late credential release.
        let mut buf = [0u8; 1];
        let read = tokio::time::timeout(Duration::from_millis(500), client.read(&mut buf)).await;
        match read {
            Ok(Ok(0)) => {} // EOF: closed without a reply — the desired outcome.
            Ok(Ok(_)) => panic!("a reply must never be written after stop()"),
            Ok(Err(_)) => {} // Connection reset is an acceptable variant of "closed".
            Err(_) => panic!("the connection must close promptly once stop() aborts the loop"),
        }

        // Not required for the assertions above, but avoids leaving a dangling waiter if the
        // abort somehow didn't take effect immediately.
        let _ = gate_tx.send(true);
    }
}

/// §M8.14 "Desktop Rust" seam tests for the OpenShell socket: per-socket op gating, origin from
/// the listener kind, the attestation precheck, the timeout clamp, rate limiting and the hello.
#[cfg(test)]
mod openshell_serve_tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use async_trait::async_trait;
    use tokio::{
        io::{AsyncBufReadExt, BufReader},
        sync::watch,
    };
    use zeroize::Zeroizing;

    use super::*;
    use crate::{
        attestation::{ParentProcessInfo, SignatureInfo, SignatureKind},
        callbacks::{
            CallbackError, CredentialDenialReason, CredentialResponseData, OpenShellLifetime,
            OpenShellLifetimeMode, OpenShellResolution, ProviderValue,
        },
    };

    const REQUEST_FIXTURE: &str =
        include_str!("../../tests/fixtures/openshell/openshell-resolve.request.json");
    const HELLO_FIXTURE: &str =
        include_str!("../../tests/fixtures/openshell/openshell-hello.request.json");

    fn good_peer() -> LocalPeerInfo {
        LocalPeerInfo {
            pid: 4242,
            process_name: Some("aac".to_string()),
            exe_path: Some("/nonexistent/bin/aac".to_string()),
            parent: Some(ParentProcessInfo {
                pid: 4241,
                process_name: Some("openshell-gateway".to_string()),
                exe_path: Some("/nonexistent/bin/openshell-gateway".to_string()),
            }),
            signature: Some(SignatureInfo {
                kind: SignatureKind::LinuxPathOnly,
                identity: "/nonexistent/bin/openshell-gateway".to_string(),
                valid: false,
            }),
        }
    }

    fn fixed_now() -> u64 {
        1_791_230_967_890
    }

    fn request_with(mutate: impl FnOnce(&mut serde_json::Value)) -> WireRequest {
        let mut value: serde_json::Value = serde_json::from_str(REQUEST_FIXTURE).unwrap();
        mutate(&mut value);
        serde_json::from_value(value).unwrap()
    }

    fn resolve_request() -> OpenShellRequest {
        validate_openshell_request(request_with(|_| {})).unwrap()
    }

    /// Counts dispatches and approves with a fixed ttl window, asserting the request shape.
    struct CountingApprover {
        calls: AtomicUsize,
    }

    #[async_trait]
    impl CredentialRequestHandler for CountingApprover {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            assert_eq!(request.origin, CredentialRequestOrigin::OpenShell);
            assert_eq!(request.operation, RequestOperation::ProviderResolve);
            assert_eq!(request.query_type, CredentialQueryKind::Id);
            assert!(request
                .query_value
                .starts_with(OPENSHELL_DISPATCH_TOKEN_PREFIX));
            assert!(request.delivery_mode.is_none());
            let context = request.openshell.expect("openshell context");
            assert_eq!(context.sandbox_id, "sbx-01J9Z6");
            assert_eq!(request.provider_targets.len(), 2);
            assert!(request.local_peer.is_some());
            Ok(CredentialResponseData {
                approved: true,
                openshell: Some(OpenShellResolution {
                    lifetime: OpenShellLifetime {
                        mode: OpenShellLifetimeMode::Ttl,
                        expires_at_ms: Some(fixed_now() + 3_600_000),
                    },
                    values: request
                        .provider_targets
                        .iter()
                        .map(|target| ProviderValue {
                            credential_key: target.credential_key.clone(),
                            value: Zeroizing::new(format!("value-of-{}", target.credential_key)),
                        })
                        .collect(),
                }),
                ..Default::default()
            })
        }
    }

    fn counting() -> Arc<CountingApprover> {
        Arc::new(CountingApprover {
            calls: AtomicUsize::new(0),
        })
    }

    /// Panics if dispatched — proves a refusal happened before the handler.
    struct MustNotDispatch;

    #[async_trait]
    impl CredentialRequestHandler for MustNotDispatch {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            panic!("this request must never be dispatched");
        }
    }

    struct CountingDenier {
        calls: AtomicUsize,
    }

    #[async_trait]
    impl CredentialRequestHandler for CountingDenier {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            Ok(CredentialResponseData {
                approved: false,
                reason: Some(CredentialDenialReason::Denied),
                ..Default::default()
            })
        }
    }

    struct Hanging;

    #[async_trait]
    impl CredentialRequestHandler for Hanging {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            std::future::pending().await
        }
    }

    /// Blocks until `gate` flips, then denies.
    struct Gated {
        gate: watch::Receiver<bool>,
        active: Arc<AtomicUsize>,
    }

    #[async_trait]
    impl CredentialRequestHandler for Gated {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            self.active.fetch_add(1, Ordering::SeqCst);
            let mut gate = self.gate.clone();
            let _ = gate.wait_for(|open| *open).await;
            Ok(CredentialResponseData {
                approved: false,
                reason: Some(CredentialDenialReason::NotFound),
                ..Default::default()
            })
        }
    }

    struct NoopSink;

    #[async_trait]
    impl EventSink for NoopSink {
        async fn on_event(&self, _event: AgentAccessEvent) {}
    }

    struct ChannelSink(tokio::sync::mpsc::UnboundedSender<AgentAccessEvent>);

    #[async_trait]
    impl EventSink for ChannelSink {
        async fn on_event(&self, event: AgentAccessEvent) {
            let _ = self.0.send(event);
        }
    }

    async fn serve(
        request: OpenShellRequest,
        peer: Option<LocalPeerInfo>,
        handler: Arc<dyn CredentialRequestHandler>,
        limiter: &Arc<OpenShellLimiter>,
    ) -> (WireStatus, String) {
        let reply = serve_openshell(
            request,
            peer,
            handler,
            Arc::new(NoopSink),
            Arc::clone(limiter),
            fixed_now,
            std::future::pending(),
        )
        .await
        .expect("a reply when the peer stays connected");
        (
            reply.status,
            String::from_utf8(reply.bytes.to_vec()).unwrap(),
        )
    }

    async fn round_trip(line: &str, kind: ListenerKind) -> String {
        let (mut client, server) = tokio::io::duplex(8192);
        let task = tokio::spawn(handle_connection(
            server,
            None,
            kind,
            Arc::new(MustNotDispatch),
            Arc::new(NoopSink),
            Arc::new(OpenShellLimiter::default()),
        ));
        client.write_all(line.as_bytes()).await.unwrap();
        let mut reader = BufReader::new(&mut client);
        let mut reply_line = String::new();
        reader.read_line(&mut reply_line).await.unwrap();
        task.await.unwrap();
        reply_line
    }

    // --- per-socket op gating -------------------------------------------------------------------

    #[tokio::test]
    async fn the_agent_socket_refuses_both_openshell_ops() {
        for line in [REQUEST_FIXTURE, HELLO_FIXTURE] {
            let reply = round_trip(line, ListenerKind::Agent).await;
            assert_eq!(
                reply,
                "{\"version\":1,\"status\":\"error\",\"message\":\"operation not available on this socket\"}\n"
            );
        }
    }

    #[tokio::test]
    async fn the_openshell_socket_refuses_every_other_op() {
        for op in [
            "credentialRequest",
            "secretRequest",
            "secretCreate",
            "projectList",
            "describeFillTarget",
            "somethingElse",
        ] {
            let line = format!(
                "{{\"version\":1,\"op\":\"{op}\",\"query\":{{\"type\":\"id\",\"value\":\"x\"}},\"delivery\":\"inject\"}}\n"
            );
            let reply = round_trip(&line, ListenerKind::OpenShell).await;
            assert_eq!(
                reply,
                "{\"version\":1,\"status\":\"error\",\"message\":\"operation not available on this socket\"}\n",
                "{op}"
            );
        }
    }

    #[test]
    fn the_agent_validator_rejects_an_openshell_object_as_foreign() {
        let line = "{\"version\":1,\"op\":\"credentialRequest\",\
            \"query\":{\"type\":\"id\",\"value\":\"x\"},\"delivery\":\"inject\",\
            \"openshell\":{\"deadlineMs\":25000}}";
        let request: WireRequest = serde_json::from_str(line).unwrap();
        match validate_agent_request(request) {
            Err(message) => assert_eq!(message, "openshell object is not valid for this operation"),
            Ok(_) => panic!("an openshell object must be rejected on the agent socket"),
        }
    }

    #[tokio::test]
    async fn a_real_connection_without_attestation_is_refused_without_dispatch() {
        // `peer_pid: None` (as for an unresolvable peer) means no attestation → precheck fails.
        let reply = round_trip(REQUEST_FIXTURE, ListenerKind::OpenShell).await;
        assert_eq!(
            reply,
            "{\"version\":1,\"status\":\"error\",\"message\":\"OpenShell gateway could not be verified\"}\n"
        );
    }

    // --- origin and dispatch ---------------------------------------------------------------------

    #[tokio::test]
    async fn origin_is_openshell_from_the_listener_kind_and_wire_fields_cannot_change_it() {
        let handler = counting();
        let limiter = Arc::new(OpenShellLimiter::default());
        // A forged `origin` key on the wire is simply an unknown field: ignored, and the handler
        // (which asserts `origin == OpenShell`) still sees the listener-derived origin.
        let request = validate_openshell_request(request_with(|v| {
            v["origin"] = serde_json::json!("local");
            v["openshell"]["origin"] = serde_json::json!("local");
        }))
        .unwrap();
        let (status, text) = serve(request, Some(good_peer()), handler.clone(), &limiter).await;
        assert_eq!(status, WireStatus::Approved);
        assert_eq!(handler.calls.load(Ordering::SeqCst), 1);
        assert!(
            text.contains("\"credentialKey\":\"GITHUB_TOKEN\",\"value\":\"value-of-GITHUB_TOKEN\"")
        );
    }

    #[tokio::test]
    async fn attestation_failures_are_refused_without_dispatch() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let mut no_parent = good_peer();
        no_parent.parent = None;
        let mut wrong_parent = good_peer();
        wrong_parent.parent.as_mut().unwrap().exe_path = Some("/bin/zsh".to_string());
        let mut not_aac = good_peer();
        not_aac.exe_path = Some("/usr/bin/curl".to_string());
        let mut unsigned = good_peer();
        unsigned.signature = None;

        for peer in [
            None,
            Some(no_parent),
            Some(wrong_parent),
            Some(not_aac),
            Some(unsigned),
        ] {
            let (status, text) =
                serve(resolve_request(), peer, Arc::new(MustNotDispatch), &limiter).await;
            assert_eq!(status, WireStatus::Error);
            assert!(text.contains("OpenShell gateway could not be verified"));
        }
    }

    #[tokio::test(start_paused = true)]
    async fn the_dispatch_timeout_is_clamped_to_the_request_deadline() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let request = validate_openshell_request(request_with(|v| {
            v["openshell"]["deadlineMs"] = serde_json::json!(5000);
        }))
        .unwrap();
        let started = tokio::time::Instant::now();
        let (status, _) = serve(request, Some(good_peer()), Arc::new(Hanging), &limiter).await;
        assert_eq!(status, WireStatus::Timeout);
        let waited = started.elapsed();
        assert!(
            waited >= Duration::from_millis(5000) && waited < Duration::from_millis(5100),
            "waited {waited:?}"
        );
    }

    #[test]
    fn the_timeout_clamp_never_exceeds_the_callback_timeout() {
        assert_eq!(
            CALLBACK_TIMEOUT.min(Duration::from_millis(28_000)),
            Duration::from_millis(28_000)
        );
        assert_eq!(
            CALLBACK_TIMEOUT.min(Duration::from_secs(120)),
            CALLBACK_TIMEOUT
        );
    }

    // --- rate limiting ---------------------------------------------------------------------------

    #[tokio::test(start_paused = true)]
    async fn a_denial_starts_a_sixty_second_cooldown_for_the_pair() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let denier = Arc::new(CountingDenier {
            calls: AtomicUsize::new(0),
        });

        let (status, _) = serve(
            resolve_request(),
            Some(good_peer()),
            denier.clone(),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::Denied);

        let (status, text) = serve(
            resolve_request(),
            Some(good_peer()),
            denier.clone(),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::RateLimited);
        assert!(text.contains("\"status\":\"rateLimited\""));
        assert_eq!(
            denier.calls.load(Ordering::SeqCst),
            1,
            "no dispatch while cooling down"
        );

        tokio::time::advance(Duration::from_secs(61)).await;
        let (status, _) = serve(
            resolve_request(),
            Some(good_peer()),
            denier.clone(),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::Denied);
        assert_eq!(denier.calls.load(Ordering::SeqCst), 2);
    }

    /// Replies like the renderer does when a request's own deadline passes while the coalesced
    /// dialog is still open (§M8.18).
    struct RendererTimeout {
        calls: AtomicUsize,
    }

    #[async_trait]
    impl CredentialRequestHandler for RendererTimeout {
        async fn handle_credential_request(
            &self,
            _request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            Ok(CredentialResponseData {
                approved: false,
                reason: Some(CredentialDenialReason::Timeout),
                ..Default::default()
            })
        }
    }

    #[tokio::test]
    async fn a_renderer_reported_timeout_does_not_start_the_cooldown() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let handler = Arc::new(RendererTimeout {
            calls: AtomicUsize::new(0),
        });
        for _ in 0..2 {
            let (status, _) = serve(
                resolve_request(),
                Some(good_peer()),
                handler.clone(),
                &limiter,
            )
            .await;
            assert_eq!(status, WireStatus::Timeout);
        }
        assert_eq!(
            handler.calls.load(Ordering::SeqCst),
            2,
            "the retry reaches the renderer"
        );
    }

    #[tokio::test]
    async fn a_hang_up_abandons_the_dispatch_writes_nothing_and_reports_the_token() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let limiter = Arc::new(OpenShellLimiter::default());
        let (hangup_tx, hangup_rx) = tokio::sync::oneshot::channel::<()>();
        let task = {
            let limiter = Arc::clone(&limiter);
            tokio::spawn(async move {
                serve_openshell(
                    resolve_request(),
                    Some(good_peer()),
                    Arc::new(Hanging),
                    Arc::new(ChannelSink(tx)),
                    limiter,
                    fixed_now,
                    async {
                        let _ = hangup_rx.await;
                    },
                )
                .await
            })
        };
        // The request is dispatched (credential_requested) before aac goes away.
        let first = tokio::time::timeout(Duration::from_secs(5), rx.recv())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(first.kind, "credential_requested");
        hangup_tx.send(()).unwrap();
        assert!(task.await.unwrap().is_none(), "nothing is written");

        let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(event.kind, OPENSHELL_ABANDONED_EVENT_KIND);
        let token = event.detail.expect("dispatch token");
        assert!(token.starts_with(OPENSHELL_DISPATCH_TOKEN_PREFIX));
        assert!(event.peer_name.is_none());
        assert!(event.fields_shared.is_none());

        // No cooldown and the slot is free: the supervisor's retry is dispatched.
        let (status, _) = serve(resolve_request(), Some(good_peer()), counting(), &limiter).await;
        assert_eq!(status, WireStatus::Approved);
    }

    #[tokio::test]
    async fn peer_hung_up_resolves_when_the_peer_closes() {
        let (client, server) = tokio::io::duplex(8192);
        let (hangup_seen_tx, hangup_seen_rx) = tokio::sync::oneshot::channel::<()>();
        let mut stream = server;
        let task = tokio::spawn(async move {
            let hangup = async {
                peer_hung_up(&mut stream).await;
                let _ = hangup_seen_tx.send(());
            };
            hangup.await;
        });
        drop(client);
        tokio::time::timeout(Duration::from_secs(5), hangup_seen_rx)
            .await
            .unwrap()
            .unwrap();
        task.await.unwrap();
    }

    #[test]
    fn dispatch_tokens_are_unique() {
        let a = next_dispatch_token();
        let b = next_dispatch_token();
        assert_ne!(a, b);
        assert!(a.starts_with(OPENSHELL_DISPATCH_TOKEN_PREFIX));
    }

    #[tokio::test(start_paused = true)]
    async fn a_dispatch_the_renderer_never_answers_starts_the_cooldown() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let (status, _) = serve(
            resolve_request(),
            Some(good_peer()),
            Arc::new(Hanging),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::Timeout);
        let (status, _) = serve(
            resolve_request(),
            Some(good_peer()),
            Arc::new(MustNotDispatch),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::RateLimited);
    }

    #[tokio::test]
    async fn only_one_request_per_provider_waits_for_approval() {
        let limiter = Arc::new(OpenShellLimiter::default());
        let (gate_tx, gate_rx) = watch::channel(false);
        let active = Arc::new(AtomicUsize::new(0));
        let gated = Arc::new(Gated {
            gate: gate_rx,
            active: Arc::clone(&active),
        });

        let first = {
            let limiter = Arc::clone(&limiter);
            let gated = Arc::clone(&gated);
            tokio::spawn(async move {
                serve(resolve_request(), Some(good_peer()), gated, &limiter).await
            })
        };
        while active.load(Ordering::SeqCst) == 0 {
            tokio::task::yield_now().await;
        }

        // An identical request (a supervisor retry) may coalesce onto the same approval.
        let identical = {
            let limiter = Arc::clone(&limiter);
            let gated = Arc::clone(&gated);
            tokio::spawn(async move {
                serve(resolve_request(), Some(good_peer()), gated, &limiter).await
            })
        };
        while active.load(Ordering::SeqCst) < 2 {
            tokio::task::yield_now().await;
        }

        // Same provider, even from another sandbox: refused immediately.
        let other_sandbox = validate_openshell_request(request_with(|v| {
            v["openshell"]["sandbox"]["id"] = serde_json::json!("sbx-other");
        }))
        .unwrap();
        let (status, _) = serve(
            other_sandbox,
            Some(good_peer()),
            Arc::new(MustNotDispatch),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::RateLimited);

        // A different provider is not blocked.
        let other_provider = validate_openshell_request(request_with(|v| {
            v["openshell"]["provider"]["id"] = serde_json::json!("prov-other");
        }))
        .unwrap();
        let (status, _) = serve(other_provider, Some(good_peer()), counting(), &limiter).await;
        assert_eq!(status, WireStatus::Approved);

        // Same provider and sandbox, but a different target set: refused too.
        let other_targets = validate_openshell_request(request_with(|v| {
            v["openshell"]["targets"]
                .as_array_mut()
                .unwrap()
                .truncate(1);
        }))
        .unwrap();
        let (status, _) = serve(
            other_targets,
            Some(good_peer()),
            Arc::new(MustNotDispatch),
            &limiter,
        )
        .await;
        assert_eq!(status, WireStatus::RateLimited);

        gate_tx.send(true).unwrap();
        let (status, _) = first.await.unwrap();
        assert_eq!(status, WireStatus::NotFound);
        let (status, _) = identical.await.unwrap();
        assert_eq!(status, WireStatus::NotFound);

        // The slot was released: the provider can ask again.
        let (status, _) = serve(resolve_request(), Some(good_peer()), counting(), &limiter).await;
        assert_eq!(status, WireStatus::Approved);
    }

    // --- hello ----------------------------------------------------------------------------------

    #[tokio::test]
    async fn hello_emits_driver_seen_with_no_peer_fields_and_never_dispatches() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let hello: WireRequest = serde_json::from_str(HELLO_FIXTURE).unwrap();
        let reply = serve_openshell(
            validate_openshell_request(hello).unwrap(),
            Some(good_peer()),
            Arc::new(MustNotDispatch),
            Arc::new(ChannelSink(tx)),
            Arc::new(OpenShellLimiter::default()),
            fixed_now,
            std::future::pending(),
        )
        .await
        .unwrap();
        assert_eq!(
            String::from_utf8(reply.bytes.to_vec()).unwrap(),
            "{\"version\":1,\"status\":\"approved\"}\n"
        );
        let event = tokio::time::timeout(Duration::from_secs(5), rx.recv())
            .await
            .unwrap()
            .unwrap();
        assert_eq!(event.kind, "openshellDriverSeen");
        assert!(event.peer_name.is_none());
        assert!(event.peer_fingerprint.is_none());
        assert!(event.detail.is_none());
        assert!(event.fields_shared.is_none());
        assert!(!event.timestamp_ms.is_empty());
    }

    #[tokio::test]
    async fn hello_that_fails_the_precheck_emits_nothing() {
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
        let hello: WireRequest = serde_json::from_str(HELLO_FIXTURE).unwrap();
        let reply = serve_openshell(
            validate_openshell_request(hello).unwrap(),
            None,
            Arc::new(MustNotDispatch),
            Arc::new(ChannelSink(tx)),
            Arc::new(OpenShellLimiter::default()),
            fixed_now,
            std::future::pending(),
        )
        .await
        .unwrap();
        assert_eq!(reply.status, WireStatus::Error);
        tokio::task::yield_now().await;
        assert!(rx.try_recv().is_err());
    }
}
