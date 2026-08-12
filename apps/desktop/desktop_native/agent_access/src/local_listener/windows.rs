//! Windows named pipe transport for the Agent Access local listener.
//!
//! Modeled closely on `ssh_agent::server::listener::windows` (copy-adapted, not depended on —
//! see `agent_access`'s crate docs for why this crate stays independent of `ssh_agent`).
//!
//! Developed and reviewed on macOS — this file cannot be exercised locally. Behavior is kept as
//! close as possible to the proven `ssh_agent` v2 Windows listener rather than introducing any
//! novel logic here, except where noted below.
//!
//! # Needs Windows-native review/CI
//!
//! Every line in this file is written against the documented `windows`-crate/Win32 APIs and
//! reviewed for correctness on paper, but none of it has ever been compiled or run on Windows —
//! this macOS dev environment cannot compile `cfg(windows)` code at all. Treat this file as
//! unverified until it's built and exercised on a Windows CI runner or machine.
//!
//! TODO(agent-access): the owner-only DACL below needs three more `windows` crate features than
//! this crate's `Cargo.toml` currently enables for `cfg(windows)` (`Win32_Foundation` +
//! `Win32_System_Pipes` only): `Win32_Security`, `Win32_Security_Authorization`, and
//! `Win32_System_Memory` (for `LocalFree`). Adding them is out of this change's scope — the
//! `Cargo.toml`/`Cargo.lock`/`build.js` files are owned by a different workstream in this PR —
//! so this file will not compile against the current dependency manifest until that lands.

use std::{ffi::c_void, mem, os::windows::io::AsRawHandle};

use async_trait::async_trait;
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
use tokio::time::{sleep, Duration};
use tracing::{info, warn};
use windows::Win32::{
    Foundation::{HANDLE, HLOCAL},
    Security::{
        Authorization::{ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1},
        PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES,
    },
    System::{Memory::LocalFree, Pipes::GetNamedPipeClientProcessId},
};

use super::LocalListener;

/// Backoff applied after a `create`-failure while accepting new connections. Without this, a
/// persistent failure (e.g. handle/resource exhaustion) would otherwise make `accept()` return
/// `Err` immediately on every call, and `accept_loop` (`local_listener::mod`) retries on `Err`
/// with no delay of its own — hot-looping a CPU core. Long enough to shed a hot loop, short
/// enough that a transient failure recovers quickly.
const CREATE_FAILURE_BACKOFF: Duration = Duration::from_millis(250);

/// SDDL for "Generic-All to the Owner SID only, protected from inheritance": `D:` starts a DACL,
/// `P` (protected) blocks ACEs from an inheritable parent security descriptor, and the single
/// `(A;;GA;;;OW)` ACE grants (`A`) generic-all (`GA`) access to the owner (`OW`) and nobody else
/// — matching the Unix listener's `0600` (current user only, no group/other bits) and the
/// architecture doc's "DACL: current user only" for this transport.
const OWNER_ONLY_SDDL: &str = "D:P(A;;GA;;;OW)";

pub(super) struct WindowsLocalListener {
    inner: NamedPipeServer,
    pipe_name: String,
}

impl WindowsLocalListener {
    /// Creates a new [`WindowsLocalListener`], binding to `pipe_name`.
    ///
    /// The first pipe server instance is created synchronously so the pipe name is registered
    /// in the OS before this function returns — matches `bind()` on the Unix side, where the
    /// socket file already exists by the time `spawn()` hands back control.
    ///
    /// # Errors
    ///
    /// Returns an error if the named pipe cannot be created — including if a pipe of this name
    /// already exists (see `first_instance: true` below).
    pub(super) fn bind(pipe_name: &str) -> std::io::Result<Self> {
        let inner = create_owner_only_pipe(pipe_name, /* first_instance */ true)?;
        info!(pipe_name, "agent_access: local named pipe listener ready");
        Ok(Self {
            inner,
            pipe_name: pipe_name.to_string(),
        })
    }
}

#[async_trait]
impl LocalListener for WindowsLocalListener {
    type Stream = NamedPipeServer;

    async fn accept(&mut self) -> std::io::Result<(Self::Stream, Option<u32>)> {
        self.inner.connect().await?;

        // Create the next server instance before handing off the current one, so the pipe name
        // remains available for subsequent clients without a gap.
        let next = match create_owner_only_pipe(&self.pipe_name, /* first_instance */ false) {
            Ok(server) => server,
            Err(error) => {
                warn!(
                    %error,
                    "agent_access: failed to create the next named pipe instance, backing off \
                     before the next accept attempt"
                );
                // See `CREATE_FAILURE_BACKOFF`'s docs: without this, a persistent create
                // failure would hot-loop `accept_loop`'s immediate retry-on-error.
                sleep(CREATE_FAILURE_BACKOFF).await;
                return Err(error);
            }
        };
        let stream = mem::replace(&mut self.inner, next);

        let peer_pid = get_peer_pid(&stream);
        Ok((stream, peer_pid))
    }
}

/// Creates one named pipe server instance with an owner-only DACL (see [`OWNER_ONLY_SDDL`]),
/// matching the Unix listener's `0600` posture.
///
/// `first_instance` must be `true` only for the very first instance, created in [`bind`]. This
/// maps to `ServerOptions::first_pipe_instance`, which sets `FILE_FLAG_FIRST_PIPE_INSTANCE` —
/// pipe creation then fails loudly (`ERROR_ACCESS_DENIED`) if a pipe of this name already
/// exists, rather than silently succeeding as one of several instances of an
/// already-squatted pipe (e.g. malware pre-registering the same name to intercept the first
/// connection). Every subsequent instance (created in `accept()` to keep the name available for
/// the next client) must pass `false` — a second `first_pipe_instance(true)` call against an
/// already-registered name would itself fail with `ERROR_ACCESS_DENIED`.
///
/// [`bind`]: WindowsLocalListener::bind
fn create_owner_only_pipe(
    pipe_name: &str,
    first_instance: bool,
) -> std::io::Result<NamedPipeServer> {
    // NUL-terminated UTF-16, as `PCWSTR` requires. Built at runtime (rather than a `w!("...")`
    // literal) to avoid depending on that macro's availability across `windows`-crate versions.
    let sddl_wide: Vec<u16> = OWNER_ONLY_SDDL.encode_utf16().chain(Some(0)).collect();

    let mut descriptor = PSECURITY_DESCRIPTOR::default();
    // SAFETY: `sddl_wide` is a valid NUL-terminated UTF-16 string, live for the duration of this
    // call. `descriptor` is an out-param: on success the callee writes a newly `LocalAlloc`'d
    // security descriptor into it, which is `LocalFree`'d below once the pipe has been created —
    // the descriptor only needs to outlive the `create_with_security_attributes_raw` call, which
    // (per that API's contract) reads what it needs rather than retaining the pointer.
    let convert_result = unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            windows::core::PCWSTR(sddl_wide.as_ptr()),
            SDDL_REVISION_1,
            &mut descriptor,
            None,
        )
    };
    if let Err(error) = convert_result {
        return Err(std::io::Error::other(format!(
            "agent_access: failed to build an owner-only security descriptor for the named \
             pipe: {error}"
        )));
    }

    let mut attrs = SECURITY_ATTRIBUTES {
        nLength: mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor.0,
        bInheritHandle: false.into(),
    };

    let mut options = ServerOptions::new();
    options.first_pipe_instance(first_instance);
    // SAFETY: `attrs` is a fully initialized, stack-local `SECURITY_ATTRIBUTES` whose
    // `lpSecurityDescriptor` points at the live descriptor built above for the duration of this
    // call — freed immediately after, matching `create_with_security_attributes_raw`'s
    // documented contract that the descriptor need not outlive the call itself.
    let result = unsafe {
        options.create_with_security_attributes_raw(pipe_name, &mut attrs as *mut _ as *mut c_void)
    };

    // SAFETY: `descriptor.0` is the non-null pointer `ConvertStringSecurityDescriptorToSecurityDescriptorW`
    // allocated via `LocalAlloc` on success above (confirmed by the `convert_result` check);
    // freeing it here is required to avoid leaking one descriptor per pipe-instance creation —
    // `accept()` creates a fresh instance on every call.
    unsafe {
        let _ = LocalFree(Some(HLOCAL(descriptor.0)));
    }

    result
}

/// Captures the peer's PID from the OS-verified named-pipe client identity at accept time
/// (never self-reported by the client).
fn get_peer_pid(server: &NamedPipeServer) -> Option<u32> {
    let mut pid: u32 = 0;
    let handle = HANDLE(server.as_raw_handle().cast());

    // SAFETY: `handle` is valid for the lifetime of this call (server is still alive), and
    // `pid` is a local stack variable that Windows writes the client PID into.
    if let Err(error) = unsafe { GetNamedPipeClientProcessId(handle, &raw mut pid) } {
        warn!(%error, "agent_access: failed to get named pipe client process id");
        return None;
    }
    Some(pid)
}

#[cfg(test)]
mod tests {
    use tokio::net::windows::named_pipe::ClientOptions;

    use super::*;

    fn test_pipe_name() -> String {
        format!(
            r"\\.\pipe\bitwarden-agent-access-test-{}",
            std::process::id()
        )
    }

    #[tokio::test]
    async fn new_creates_pipe() {
        WindowsLocalListener::bind(&test_pipe_name()).unwrap();
    }

    #[tokio::test]
    async fn bind_fails_loudly_against_an_already_squatted_pipe_name() {
        let pipe_name = test_pipe_name();
        // Simulate a pre-existing (e.g. squatted) pipe of the same name.
        let _squatter = ServerOptions::new().create(&pipe_name).unwrap();

        let result = WindowsLocalListener::bind(&pipe_name);
        assert!(
            result.is_err(),
            "binding must fail loudly when a pipe of this name already exists, not silently \
             become one of several instances of it"
        );
    }

    #[tokio::test]
    async fn get_peer_pid_on_a_connected_client_returns_some() {
        let pipe_name = test_pipe_name();
        let server = ServerOptions::new().create(&pipe_name).unwrap();
        // Keep the client alive so the connection stays open for the duration of the check.
        let _client = ClientOptions::new().open(&pipe_name).unwrap();
        server.connect().await.unwrap();

        assert!(get_peer_pid(&server).is_some());
    }
}
