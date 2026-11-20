//! Windows named pipe listener for the SSH agent server

use std::{ffi::c_void, io, mem, os::windows::io::AsRawHandle, time::Duration};

use anyhow::{anyhow, Result};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeServer, ServerOptions};
use tracing::{error, info, warn};
use windows::{
    core::{HSTRING, PWSTR},
    Win32::{
        Foundation::{
            CloseHandle, LocalFree, ERROR_ACCESS_DENIED, ERROR_PIPE_BUSY, HANDLE, HLOCAL,
        },
        Security::{
            Authorization::{
                ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
                SDDL_REVISION_1,
            },
            GetTokenInformation, TokenUser, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY,
            TOKEN_USER,
        },
        System::{
            Pipes::GetNamedPipeClientProcessId,
            Threading::{GetCurrentProcess, OpenProcessToken},
        },
    },
};

use super::Listener;
use crate::server::{
    connection::Connection,
    peer_info::PeerInfo,
    start_error::{StartError, StartErrorKind},
};

/// The fixed named pipe path that OpenSSH clients expect on Windows
pub(super) const PIPE_NAME: &str = r"\\.\pipe\openssh-ssh-agent";

/// Delay between connect attempts while all pipe instances are busy.
const PIPE_BUSY_RETRY_DELAY: Duration = Duration::from_millis(20);

/// Windows named pipe listener for the SSH agent server
pub(crate) struct WindowsListener {
    inner: NamedPipeServer,
    security: UserOnlySecurityDescriptor,
}

impl WindowsListener {
    /// Creates a new [`WindowsListener`], binding to the OpenSSH named pipe path.
    ///
    /// The first pipe server instance is created synchronously so the pipe name is
    /// registered in the OS before this function returns. It is created with
    /// `FILE_FLAG_FIRST_PIPE_INSTANCE`, so creation fails if another process (for example the
    /// Windows OpenSSH agent service) already owns the pipe name, rather than silently becoming
    /// an additional instance that clients would be round-robined to. Remote clients are
    /// rejected and the DACL only grants access to the current user.
    ///
    /// # Errors
    ///
    /// Returns [`StartErrorKind::AddressInUse`] if the pipe name is already owned by another
    /// server (`ERROR_ACCESS_DENIED` / `ERROR_PIPE_BUSY`), [`StartErrorKind::Unknown`] otherwise,
    /// including when the user-only security descriptor cannot be built.
    pub(crate) fn new() -> Result<Self, StartError> {
        let security = UserOnlySecurityDescriptor::for_current_user().map_err(|e| {
            error!(error = %e, "Could not build the named pipe security descriptor");
            StartError::io_with_kind(
                StartErrorKind::Unknown,
                "could not build the pipe security descriptor",
                e,
            )
        })?;

        let server = create_pipe_instance(&security, true).map_err(|e| {
            StartError::io_with_kind(
                classify_create_error(&e),
                "could not create the named pipe",
                e,
            )
        })?;

        info!(pipe_name = PIPE_NAME, "Named pipe listener ready");

        Ok(Self {
            inner: server,
            security,
        })
    }
}

#[async_trait::async_trait]
impl Listener for WindowsListener {
    type Stream = NamedPipeServer;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        self.inner.connect().await?;

        // Create the next server instance before handing off the current one, so the
        // pipe name remains available for subsequent clients without a gap.
        let next = create_pipe_instance(&self.security, false)
            .map_err(|e| anyhow!("Failed to create next pipe instance after accept: {e}"))?;

        let stream = mem::replace(&mut self.inner, next);
        let peer_info = get_peer_info(&stream);

        Ok(Connection { stream, peer_info })
    }
}

/// Maps a pipe creation error to a start error kind.
///
/// With `FILE_FLAG_FIRST_PIPE_INSTANCE`, Windows reports an existing pipe of the same name as
/// `ERROR_ACCESS_DENIED`; `ERROR_PIPE_BUSY` likewise means another server holds the name.
fn classify_create_error(error: &io::Error) -> StartErrorKind {
    match error
        .raw_os_error()
        .and_then(|code| u32::try_from(code).ok())
    {
        Some(code) if code == ERROR_ACCESS_DENIED.0 || code == ERROR_PIPE_BUSY.0 => {
            StartErrorKind::AddressInUse
        }
        _ => StartErrorKind::from_io(error),
    }
}

/// Creates one server instance of [`PIPE_NAME`] with the user-only DACL.
fn create_pipe_instance(
    security: &UserOnlySecurityDescriptor,
    first: bool,
) -> io::Result<NamedPipeServer> {
    let mut options = ServerOptions::new();
    options
        .first_pipe_instance(first)
        .reject_remote_clients(true);

    let mut attributes = SECURITY_ATTRIBUTES {
        nLength: u32::try_from(mem::size_of::<SECURITY_ATTRIBUTES>())
            .map_err(|_| io::Error::from(io::ErrorKind::InvalidInput))?,
        lpSecurityDescriptor: security.0 .0,
        bInheritHandle: false.into(),
    };

    // SAFETY: `attributes` is a valid SECURITY_ATTRIBUTES living on the stack for the duration of
    // the call, and its descriptor pointer is owned by `security`, which outlives the call.
    unsafe {
        options
            .create_with_security_attributes_raw(PIPE_NAME, (&raw mut attributes).cast::<c_void>())
    }
}

/// A self-relative security descriptor granting `GENERIC_ALL` to the current user only
/// (protected DACL, so nothing is inherited). Freed with `LocalFree` on drop.
struct UserOnlySecurityDescriptor(PSECURITY_DESCRIPTOR);

// SAFETY: the descriptor is an immutable, heap-allocated (LocalAlloc) buffer that is only read
// by the OS when creating pipe instances; it is never mutated after creation.
unsafe impl Send for UserOnlySecurityDescriptor {}
// SAFETY: see `Send`; shared references only pass the pointer to read-only OS calls.
unsafe impl Sync for UserOnlySecurityDescriptor {}

impl UserOnlySecurityDescriptor {
    fn for_current_user() -> io::Result<Self> {
        let sid = current_user_sid_string()?;
        // D:P = protected DACL; (A;;GA;;;<sid>) = allow GENERIC_ALL to the current user.
        let sddl = HSTRING::from(format!("D:P(A;;GA;;;{sid})"));

        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        // SAFETY: `sddl` is a valid NUL-terminated wide string and `descriptor` is a valid out
        // pointer. On success the OS allocates the descriptor with LocalAlloc; we free it in Drop.
        unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                &sddl,
                SDDL_REVISION_1,
                &raw mut descriptor,
                None,
            )
        }
        .map_err(io::Error::from)?;

        Ok(Self(descriptor))
    }
}

impl Drop for UserOnlySecurityDescriptor {
    fn drop(&mut self) {
        // SAFETY: the pointer was allocated by ConvertStringSecurityDescriptorToSecurityDescriptorW
        // with LocalAlloc and is freed exactly once here.
        unsafe {
            LocalFree(Some(HLOCAL(self.0 .0)));
        }
    }
}

/// Returns the current process user's SID in string form (for example `S-1-5-21-...`).
fn current_user_sid_string() -> io::Result<String> {
    let mut token = HANDLE::default();
    // SAFETY: GetCurrentProcess returns a pseudo handle; `token` is a valid out pointer.
    unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &raw mut token) }
        .map_err(io::Error::from)?;

    let result = token_user_sid_string(token);

    // SAFETY: `token` was opened above and is closed exactly once.
    if let Err(error) = unsafe { CloseHandle(token) } {
        warn!(%error, "Failed to close process token handle");
    }

    result
}

fn token_user_sid_string(token: HANDLE) -> io::Result<String> {
    let mut needed = 0u32;
    // SAFETY: size query with no buffer; `needed` is a valid out pointer. This call is expected
    // to fail with ERROR_INSUFFICIENT_BUFFER while reporting the needed size.
    let _ = unsafe { GetTokenInformation(token, TokenUser, None, 0, &raw mut needed) };
    if needed == 0 {
        return Err(io::Error::last_os_error());
    }

    // u64 storage keeps the buffer suitably aligned for TOKEN_USER.
    let words = (needed as usize).div_ceil(mem::size_of::<u64>());
    let mut buffer = vec![0u64; words];
    // SAFETY: `buffer` is at least `needed` bytes, aligned, and writable.
    unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            Some(buffer.as_mut_ptr().cast::<c_void>()),
            needed,
            &raw mut needed,
        )
    }
    .map_err(io::Error::from)?;

    // SAFETY: on success the buffer starts with a TOKEN_USER whose SID points into the buffer,
    // which is alive for the rest of this function.
    let sid = unsafe { (*buffer.as_ptr().cast::<TOKEN_USER>()).User.Sid };

    let mut sid_string = PWSTR::null();
    // SAFETY: `sid` is valid (see above); `sid_string` is a valid out pointer. The OS allocates
    // the string with LocalAlloc; it is freed below.
    unsafe { ConvertSidToStringSidW(sid, &raw mut sid_string) }.map_err(io::Error::from)?;

    // SAFETY: on success `sid_string` is a valid NUL-terminated wide string.
    let converted = unsafe { sid_string.to_string() };
    // SAFETY: allocated by ConvertSidToStringSidW with LocalAlloc; freed exactly once.
    unsafe {
        LocalFree(Some(HLOCAL(sid_string.0.cast())));
    }

    converted.map_err(|_| io::Error::from(io::ErrorKind::InvalidData))
}

/// Returns `true` if a client can open the pipe `address` within `timeout`.
/// Only opens the pipe; nothing is written to it. Retries while all instances are busy.
pub(super) async fn probe(address: &str, timeout: Duration) -> bool {
    let attempt = async {
        loop {
            match ClientOptions::new().open(address) {
                Ok(_client) => return true,
                Err(e) if e.raw_os_error() == i32::try_from(ERROR_PIPE_BUSY.0).ok() => {
                    tokio::time::sleep(PIPE_BUSY_RETRY_DELAY).await;
                }
                Err(_) => return false,
            }
        }
    };
    tokio::time::timeout(timeout, attempt)
        .await
        .unwrap_or(false)
}

// Gathers peer process info from a connected named pipe server handle.
//
// TODO: PM-30755 Add test coverage for peer info gathering once the connection handler
// is implemented and `PeerInfo` is observable via the SSH protocol exchange.
fn get_peer_info(server: &NamedPipeServer) -> Option<PeerInfo> {
    let mut pid: u32 = 0;
    let handle = HANDLE(server.as_raw_handle().cast());

    // SAFETY: `handle` is valid for the lifetime of this call (server is still alive),
    // and `pid` is a local stack variable that Windows writes the client PID into.
    if let Err(error) = unsafe { GetNamedPipeClientProcessId(handle, &raw mut pid) } {
        warn!(%error, "Failed to get named pipe client process id");
        return None;
    }

    PeerInfo::from_pid(pid)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::server::listener::PROBE_TIMEOUT;

    #[serial_test::serial]
    #[tokio::test]
    async fn test_new_creates_pipe() {
        WindowsListener::new().unwrap();
    }

    #[serial_test::serial]
    #[tokio::test]
    async fn test_get_peer_info_connected_client_returns_some() {
        let server = ServerOptions::new().create(PIPE_NAME).unwrap();
        // Keep the client alive so the connection stays open for the duration of the check
        let _client = ClientOptions::new().open(PIPE_NAME).unwrap();
        server.connect().await.unwrap();

        let peer_info = get_peer_info(&server);

        assert!(peer_info.is_some());
    }

    #[serial_test::serial]
    #[tokio::test]
    async fn test_new_fails_address_in_use_when_pipe_owned_elsewhere() {
        // Another server already owns the pipe name.
        let _other = ServerOptions::new().create(PIPE_NAME).unwrap();

        let error = WindowsListener::new()
            .err()
            .expect("must not become a second instance");

        assert_eq!(error.kind(), StartErrorKind::AddressInUse);
        assert!(!error.to_string().contains("openssh-ssh-agent"));
    }

    #[serial_test::serial]
    #[tokio::test]
    async fn test_listener_accepts_after_first_instance() {
        let mut listener = WindowsListener::new().unwrap();

        let _client1 = ClientOptions::new().open(PIPE_NAME).unwrap();
        let _conn1 = listener.accept().await.unwrap();
        // The follow-up instance (first_pipe_instance=false) must be creatable.
        let _client2 = ClientOptions::new().open(PIPE_NAME).unwrap();
        let _conn2 = listener.accept().await.unwrap();
    }

    #[test]
    fn test_current_user_sid_string_is_a_sid() {
        let sid = current_user_sid_string().unwrap();
        assert!(sid.starts_with("S-1-"));
    }

    #[test]
    fn test_classify_create_error() {
        let denied = io::Error::from_raw_os_error(i32::try_from(ERROR_ACCESS_DENIED.0).unwrap());
        let busy = io::Error::from_raw_os_error(i32::try_from(ERROR_PIPE_BUSY.0).unwrap());
        assert_eq!(classify_create_error(&denied), StartErrorKind::AddressInUse);
        assert_eq!(classify_create_error(&busy), StartErrorKind::AddressInUse);
        assert_eq!(
            classify_create_error(&io::Error::from(io::ErrorKind::Other)),
            StartErrorKind::Unknown
        );
    }

    #[serial_test::serial]
    #[tokio::test]
    async fn test_probe_reports_reachability() {
        assert!(!probe(PIPE_NAME, PROBE_TIMEOUT).await);

        let _listener = WindowsListener::new().unwrap();

        assert!(probe(PIPE_NAME, PROBE_TIMEOUT).await);
    }
}
