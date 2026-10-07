//! Unix domain socket transport for the Agent Access local listener.
//!
//! Modeled closely on `ssh_agent::server::listener::unix` (copy-adapted, not depended on — see
//! `agent_access`'s crate docs for why this crate stays independent of `ssh_agent`).

use std::{fs, os::unix::fs::PermissionsExt, path::Path};

use async_trait::async_trait;
use tokio::net::{UnixListener as TokioUnixListener, UnixStream};
use tracing::{debug, info, warn};

use super::LocalListener;

pub(super) struct UnixLocalListener {
    inner: TokioUnixListener,
}

impl UnixLocalListener {
    /// Binds to `socket_path`, unlinking a stale socket file left over from a previous run
    /// first (refusing to bind at all if the "stale" file turns out to be a live socket — see
    /// [`remove_stale_socket`]), and restricting permissions to `0600` (current user only) once
    /// bound.
    pub(super) fn bind(socket_path: &str) -> std::io::Result<Self> {
        let path = Path::new(socket_path);

        remove_stale_socket(path)?;

        debug!(?path, "agent_access: binding local socket");
        let inner = bind_with_tightened_umask(path)?;
        fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;

        info!(?path, "agent_access: local socket listener ready");
        Ok(Self { inner })
    }
}

/// Binds `path` while a tightened process umask (`0o177`, i.e. deny every group/other
/// permission bit) is in effect, so the socket file can never be briefly group/world-accessible
/// between `bind(2)` creating it and `UnixLocalListener::bind`'s `fs::set_permissions` call
/// tightening it to `0600` afterward. `umask` is process-global state (not thread-local, and not
/// scoped to this call in any OS-provided way), so a concurrent `umask` call from elsewhere in
/// the process could still interleave — same caveat as any other bare `libc::umask` use — but
/// this crate controls its own process's startup path and nothing else in it touches `umask`.
/// The `fs::set_permissions` call right after `bind()` returns is kept as defense in depth even
/// though it should now be a no-op in the common case.
fn bind_with_tightened_umask(path: &Path) -> std::io::Result<TokioUnixListener> {
    // SAFETY: `umask(2)` only reads/writes process-global state and takes no pointers; there is
    // nothing platform-unsafe about the call itself (`unsafe` here is solely because the `libc`
    // binding is declared `unsafe fn`, not because of memory-safety risk).
    let previous_umask = unsafe { libc::umask(0o177) };
    let result = TokioUnixListener::bind(path);
    // Always restore, even on bind failure, so a failed `start()` doesn't leave the process's
    // umask permanently tightened for unrelated file creation elsewhere in the app.
    unsafe { libc::umask(previous_umask) };
    result
}

#[async_trait]
impl LocalListener for UnixLocalListener {
    type Stream = UnixStream;

    async fn accept(&mut self) -> std::io::Result<(Self::Stream, Option<u32>)> {
        loop {
            let (stream, _addr) = self.inner.accept().await?;
            match classify_peer(&stream) {
                PeerCheck::SameUser(pid) => return Ok((stream, Some(pid))),
                // Credentials (or specifically the pid) couldn't be read at all — e.g. the peer
                // already exited. Best-effort degrade to "no peer info", matching the prior
                // behavior for this case; not a security rejection, so still serviced.
                PeerCheck::Unresolvable => return Ok((stream, None)),
                PeerCheck::DifferentUser { peer_uid, our_uid } => {
                    // Defense in depth: the `0600` mode (tightened further by
                    // `bind_with_tightened_umask` above) should already make this unreachable,
                    // but a cross-user connection must never be serviced even if some future
                    // change to file permissions or a race lets one through. Drop `stream`
                    // silently (no wire reply) and keep accepting — a different-user peer isn't
                    // speaking to a server it's entitled to hear back from.
                    warn!(
                        peer_uid,
                        our_uid,
                        "agent_access: rejecting local connection from a different OS user"
                    );
                }
            }
        }
    }
}

/// Outcome of checking a locally-accepted connection's kernel-verified peer credentials
/// (`peer_cred()`, never self-reported) against this process's own effective UID.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PeerCheck {
    /// Same-user peer with a resolvable PID — safe to service.
    SameUser(u32),
    /// The kernel-verified peer UID does not match this process's effective UID — must be
    /// rejected outright, never serviced.
    DifferentUser { peer_uid: u32, our_uid: u32 },
    /// Credentials (or specifically the peer PID) could not be read — degrade to "no peer info"
    /// rather than a hard reject; this is a resolution failure, not a security signal.
    Unresolvable,
}

fn classify_peer(stream: &UnixStream) -> PeerCheck {
    let Ok(cred) = stream.peer_cred() else {
        return PeerCheck::Unresolvable;
    };
    classify_peer_credentials(cred.uid(), cred.pid(), effective_uid())
}

/// Pure decision function (no I/O) so the UID-mismatch rejection logic can be unit-tested in
/// isolation from a live socket.
fn classify_peer_credentials(peer_uid: u32, peer_pid: Option<i32>, our_uid: u32) -> PeerCheck {
    if peer_uid != our_uid {
        return PeerCheck::DifferentUser { peer_uid, our_uid };
    }
    match peer_pid.and_then(|pid| u32::try_from(pid).ok()) {
        Some(pid) => PeerCheck::SameUser(pid),
        None => PeerCheck::Unresolvable,
    }
}

fn effective_uid() -> u32 {
    // SAFETY: `geteuid(2)` takes no arguments, returns a plain integer, and cannot fail.
    unsafe { libc::geteuid() }
}

/// Removes a stale socket file left over from a previous (e.g. crashed) run before binding — but
/// only after confirming nothing is actually listening on it.
///
/// If `path` names a *live* socket, unlinking it would silently steal the endpoint from whatever
/// process is already serving it — concretely, a second desktop instance (the known `dev
/// --watch` nested-instance case) would otherwise hijack the first instance's socket out from
/// under it. This refuses to bind instead: a `connect(2)` to `path` succeeding means something is
/// listening (unlinking is refused, `AddrInUse`); a `ConnectionRefused` means the file is stale
/// (nothing is listening — safe to unlink); any other outcome is treated as ambiguous and also
/// refused, deny-safe, rather than guessing.
fn remove_stale_socket(path: &Path) -> std::io::Result<()> {
    if !fs::exists(path).unwrap_or(false) {
        return Ok(());
    }

    match std::os::unix::net::UnixStream::connect(path) {
        Ok(_) => Err(std::io::Error::new(
            std::io::ErrorKind::AddrInUse,
            format!(
                "agent_access: refusing to bind {path:?}: a live socket is already listening \
                 there (another instance may already be running)"
            ),
        )),
        Err(error) if error.kind() == std::io::ErrorKind::ConnectionRefused => {
            fs::remove_file(path)
        }
        Err(error) => Err(std::io::Error::new(
            error.kind(),
            format!(
                "agent_access: could not determine whether {path:?} is a live socket, \
                 refusing to unlink it: {error}"
            ),
        )),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    };

    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    use super::*;
    use crate::callbacks::{
        AgentAccessEvent, CallbackError, CredentialRequestData, CredentialRequestHandler,
        CredentialResponseData, EventSink,
    };

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    /// A unique path per test run under the OS temp dir — avoids colliding with a stale socket
    /// left by a previous (possibly crashed) test process, and avoids needing a new `tempfile`
    /// dependency for something this simple.
    fn unique_socket_path() -> std::path::PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("agent-access-test-{}-{n}.sock", std::process::id()))
    }

    #[tokio::test]
    async fn classify_peer_on_a_connected_socketpair_is_same_user() {
        // UnixStream::pair() creates a connected socketpair; peer_cred() on either end returns
        // the credentials of the creating process (this test process), so both uid and pid
        // should resolve as "same user".
        let (stream, _peer) = tokio::net::UnixStream::pair().unwrap();
        assert!(matches!(classify_peer(&stream), PeerCheck::SameUser(_)));
    }

    // --- classify_peer_credentials: pure decision logic, no live socket needed (finding 3) ----

    #[test]
    fn same_uid_and_resolvable_pid_is_same_user() {
        let result = classify_peer_credentials(1000, Some(4242), 1000);
        assert_eq!(result, PeerCheck::SameUser(4242));
    }

    #[test]
    fn mismatched_uid_is_rejected_even_with_a_resolvable_pid() {
        let result = classify_peer_credentials(1001, Some(4242), 1000);
        assert_eq!(
            result,
            PeerCheck::DifferentUser {
                peer_uid: 1001,
                our_uid: 1000
            }
        );
    }

    #[test]
    fn same_uid_with_no_pid_is_unresolvable_not_a_reject() {
        // A same-user peer whose pid couldn't be read is a resolution failure, not a security
        // signal — must not be conflated with `DifferentUser`.
        let result = classify_peer_credentials(1000, None, 1000);
        assert_eq!(result, PeerCheck::Unresolvable);
    }

    #[test]
    fn mismatched_uid_takes_priority_over_an_unresolvable_pid() {
        let result = classify_peer_credentials(1001, None, 1000);
        assert_eq!(
            result,
            PeerCheck::DifferentUser {
                peer_uid: 1001,
                our_uid: 1000
            },
            "a cross-user peer must be rejected outright, never downgraded to a soft failure"
        );
    }

    // --- remove_stale_socket (finding 4) -------------------------------------------------------

    #[test]
    fn remove_stale_socket_unlinks_a_file_nothing_is_listening_on() {
        let path = unique_socket_path();
        // A real socket file, bound then immediately dropped: the file remains on disk (Rust's
        // `UnixListener` doesn't unlink on drop), but nothing is listening on it anymore — the
        // canonical "stale socket from a crashed run" shape, unlike a plain `fs::write`.
        {
            let _listener = std::os::unix::net::UnixListener::bind(&path).unwrap();
        }
        assert!(fs::exists(&path).unwrap());

        remove_stale_socket(&path).expect("a stale socket must be unlinked, not refused");
        assert!(!fs::exists(&path).unwrap());
    }

    #[test]
    fn remove_stale_socket_is_a_noop_when_nothing_exists() {
        let path = unique_socket_path();
        remove_stale_socket(&path).unwrap(); // must not error or panic
        assert!(!fs::exists(&path).unwrap());
    }

    #[test]
    fn remove_stale_socket_refuses_to_unlink_a_live_socket() {
        let path = unique_socket_path();
        // Kept alive (not dropped) for the duration of the check — this is the "another
        // instance is already running" case (the dev `--watch` nested-instance gotcha).
        let _live_listener = std::os::unix::net::UnixListener::bind(&path).unwrap();

        let error = remove_stale_socket(&path).expect_err("a live socket must never be unlinked");
        assert_eq!(error.kind(), std::io::ErrorKind::AddrInUse);
        assert!(
            fs::exists(&path).unwrap(),
            "the live socket file must still exist after a refused removal"
        );

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn remove_stale_socket_refuses_to_unlink_an_ambiguous_non_socket_file() {
        // A plain regular file at the path (not created via `bind`) can't be positively
        // identified as a stale socket — `connect(2)` against it fails with something other
        // than `ConnectionRefused` (e.g. `ENOTSOCK`). Deny-safe: refuse rather than guess.
        let path = unique_socket_path();
        fs::write(&path, "").unwrap();

        let result = remove_stale_socket(&path);
        assert!(
            result.is_err(),
            "an unidentifiable file must not be unlinked"
        );
        assert!(fs::exists(&path).unwrap());

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn bind_refuses_to_hijack_a_live_socket_from_another_instance() {
        let path = unique_socket_path();
        let _first_instance = std::os::unix::net::UnixListener::bind(&path).unwrap();

        let result = UnixLocalListener::bind(path.to_str().unwrap());
        assert!(
            result.is_err(),
            "binding must refuse to steal a socket a live instance is already serving"
        );

        let _ = fs::remove_file(&path);
    }

    #[tokio::test]
    async fn bind_sets_user_only_permissions() {
        let path = unique_socket_path();
        let listener = UnixLocalListener::bind(path.to_str().unwrap()).unwrap();
        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
        drop(listener);
        let _ = fs::remove_file(&path);
    }

    struct ApprovingHandler;

    #[async_trait]
    impl CredentialRequestHandler for ApprovingHandler {
        async fn handle_credential_request(
            &self,
            request: CredentialRequestData,
        ) -> Result<CredentialResponseData, CallbackError> {
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

    struct NoopEventSink;

    #[async_trait]
    impl EventSink for NoopEventSink {
        async fn on_event(&self, _event: AgentAccessEvent) {}
    }

    /// Integration-style test: binds a real Unix socket in the OS temp dir, connects with a
    /// real `tokio::net::UnixStream`, and round-trips a full request against a mock handler —
    /// exercising `super::spawn` end to end rather than just `handle_connection` in isolation.
    #[tokio::test]
    async fn real_socket_round_trips_a_credential_request() {
        let path = unique_socket_path();
        let path_str = path.to_str().unwrap().to_string();

        let handle = crate::local_listener::spawn(
            path_str.clone(),
            crate::local_listener::ListenerKind::Agent,
            Arc::new(ApprovingHandler),
            Arc::new(NoopEventSink),
        )
        .expect("bind should succeed against a fresh temp path");

        let stream = tokio::net::UnixStream::connect(&path)
            .await
            .expect("socket should already be listening by the time spawn() returns");
        let (read_half, mut write_half) = stream.into_split();

        write_half
            .write_all(
                b"{\"version\":1,\"op\":\"credentialRequest\",\
                \"query\":{\"type\":\"domain\",\"value\":\"example.com\"},\
                \"delivery\":\"inject\",\
                \"client\":{\"name\":\"aac\",\"version\":\"0.1.0\"}}\n",
            )
            .await
            .unwrap();

        let mut reader = BufReader::new(read_half);
        let mut line = String::new();
        reader.read_line(&mut line).await.unwrap();

        assert!(line.contains("\"status\":\"approved\""));
        assert!(line.contains("\"reference\":\"bw://item/cipher-1\""));
        assert!(line.contains("hunter2"));

        handle.abort();
        let _ = fs::remove_file(&path);
    }
}
