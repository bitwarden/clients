//! Unix domain socket listener for the SSH agent server

use std::{
    fs, io,
    os::unix::fs::{DirBuilderExt, FileTypeExt, MetadataExt, PermissionsExt},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU32, Ordering},
        mpsc, Mutex, PoisonError,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use anyhow::{anyhow, Result};
use tokio::net::UnixStream;
use tracing::{debug, error, info, warn};

use super::{Listener, PROBE_TIMEOUT};
use crate::server::{
    connection::Connection,
    peer_info::PeerInfo,
    start_error::{StartError, StartErrorKind},
};

/// Environment variable that overrides the default socket path
const ENV_BITWARDEN_SSH_AUTH_SOCK: &str = "BITWARDEN_SSH_AUTH_SOCK";

const FLATPAK_DATA_DIR: &str = ".var/app/com.bitwarden.desktop/data";

const SOCKFILE_NAME: &str = ".bitwarden-ssh-agent.sock";

/// Name of the socket inside the private staging directory. Kept short so the staged path does
/// not exceed `sun_path` limits when the final path is close to them.
const STAGED_SOCKET_NAME: &str = "s";

/// Maximum attempts to create a uniquely named staging directory.
const STAGING_DIR_ATTEMPTS: u32 = 16;

/// Identity of the socket file this process most recently published. Used to recognise our own
/// socket on restart, when the previous listener task may not have dropped its file descriptor
/// yet (so a connect probe would still succeed).
static OWNED_SOCKET: Mutex<Option<SocketIdentity>> = Mutex::new(None);

static STAGING_COUNTER: AtomicU32 = AtomicU32::new(0);

/// Unix domain socket listener for the SSH agent server
pub(crate) struct UnixListener {
    inner: tokio::net::UnixListener,
}

impl UnixListener {
    /// Creates a new [`UnixListener`], binding to the resolved socket path.
    ///
    /// The socket path is resolved from the `BITWARDEN_SSH_AUTH_SOCK` environment variable if set,
    /// otherwise it defaults to `$HOME/.bitwarden-ssh-agent.sock` (inside the Flatpak data
    /// directory when running as a Flatpak).
    ///
    /// # Errors
    ///
    /// See [`UnixListener::bind`].
    pub(crate) fn new() -> Result<Self, StartError> {
        let socket_path = get_socket_path().map_err(|error| {
            error!(%error, "Could not resolve the SSH agent socket path");
            StartError::new(StartErrorKind::Unknown, "could not resolve the socket path")
        })?;

        Self::bind(&socket_path)
    }

    /// Binds a listener at `socket_path`.
    ///
    /// - An existing socket is only removed if it was published by this process or nothing answers
    ///   a connect probe (stale). A socket another agent is listening on is left alone. A socket
    ///   published by this process is replaced even if its listener is still alive: on restart the
    ///   previous listener task may not have dropped it yet, and the Electron caller can replace an
    ///   agent instance without stopping it first.
    /// - A non-socket file (including a symlink) is never removed.
    /// - The socket is bound inside a private `0o700` staging directory, set to `0o600`, and only
    ///   then hard-linked into place, so it is never reachable with umask-derived permissions.
    ///
    /// # Errors
    ///
    /// Returns [`StartErrorKind::AddressInUse`] if another agent listens on the path or a
    /// non-socket file occupies it, [`StartErrorKind::PermissionDenied`] if the OS denies access,
    /// otherwise [`StartErrorKind::Unknown`].
    pub(crate) fn bind(socket_path: &Path) -> Result<Self, StartError> {
        prepare_socket_path(socket_path)?;

        debug!(?socket_path, "Binding socket");

        let std_listener = bind_user_only(socket_path)?;
        std_listener
            .set_nonblocking(true)
            .map_err(|e| StartError::io("could not configure the socket", e))?;
        let inner = tokio::net::UnixListener::from_std(std_listener)
            .map_err(|e| StartError::io("could not register the socket", e))?;

        info!(?socket_path, "socket listener ready");

        Ok(Self { inner })
    }
}

#[async_trait::async_trait]
impl Listener for UnixListener {
    type Stream = UnixStream;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        let (stream, _addr) = self.inner.accept().await?;

        let peer_info = get_peer_info(&stream);

        Ok(Connection { stream, peer_info })
    }
}

// Gathers peer process info from a connected Unix stream's credentials.
//
// TODO: PM-30755 Add test coverage for peer info gathering once the connection handler
// is implemented and `PeerInfo` is observable via the SSH protocol exchange.
fn get_peer_info(stream: &UnixStream) -> Option<PeerInfo> {
    let pid = stream
        .peer_cred()
        .ok()
        .and_then(|cred| cred.pid())
        .and_then(|pid| u32::try_from(pid).ok())?;

    PeerInfo::from_pid(pid)
}

pub(super) fn get_socket_path() -> Result<PathBuf> {
    if let Ok(path) = std::env::var(ENV_BITWARDEN_SSH_AUTH_SOCK) {
        Ok(PathBuf::from(path))
    } else {
        debug!(
            socket_path_env_var = ENV_BITWARDEN_SSH_AUTH_SOCK,
            "not set, using default path"
        );
        get_default_socket_path()
    }
}

fn is_flatpak() -> bool {
    std::env::var("container") == Ok("flatpak".to_string())
}

fn get_default_socket_path() -> Result<PathBuf> {
    let Ok(Some(mut home)) = homedir::my_home() else {
        error!("Could not determine home directory");
        return Err(anyhow!("Could not determine home directory"));
    };

    if is_flatpak() {
        home = home.join(FLATPAK_DATA_DIR);
    }

    Ok(home.join(SOCKFILE_NAME))
}

/// Returns `true` if a client can connect to the socket at `address` within `timeout`.
/// Only connects; nothing is written to the socket.
pub(super) async fn probe(address: &str, timeout: Duration) -> bool {
    matches!(
        tokio::time::timeout(timeout, UnixStream::connect(address)).await,
        Ok(Ok(_))
    )
}

/// Result of a blocking connect probe against an existing socket file.
#[derive(Debug)]
enum ProbeOutcome {
    /// Something accepted the connection.
    Listening,
    /// Nothing is bound to the socket (stale socket file).
    Refused,
    /// The path disappeared before the probe.
    Missing,
    /// The connect did not complete in time (for example a live agent with a full backlog).
    TimedOut,
    /// Any other error; the socket must be treated as not ours.
    Failed(io::Error),
}

/// Connects to `path` on a helper thread, giving up after `timeout`.
///
/// A blocking connect on Linux can wait on a live listener whose backlog is full, so the
/// connect runs on its own thread instead of blocking the caller indefinitely.
fn probe_blocking(path: &Path, timeout: Duration) -> ProbeOutcome {
    let (tx, rx) = mpsc::channel();
    let path = path.to_path_buf();
    let spawned = std::thread::Builder::new()
        .name("ssh-agent-socket-probe".to_string())
        .spawn(move || {
            // The receiver may have timed out and gone away; nothing to do in that case.
            let _ = tx.send(std::os::unix::net::UnixStream::connect(&path).map(drop));
        });
    if let Err(e) = spawned {
        return ProbeOutcome::Failed(e);
    }

    match rx.recv_timeout(timeout) {
        Ok(Ok(())) => ProbeOutcome::Listening,
        Ok(Err(e)) => match e.kind() {
            io::ErrorKind::ConnectionRefused => ProbeOutcome::Refused,
            io::ErrorKind::NotFound => ProbeOutcome::Missing,
            _ => ProbeOutcome::Failed(e),
        },
        Err(_) => ProbeOutcome::TimedOut,
    }
}

/// Makes `path` available for binding, removing only a socket that is provably ours or stale.
fn prepare_socket_path(path: &Path) -> Result<(), StartError> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(e) => return Err(StartError::io("could not inspect the socket path", e)),
    };

    if !metadata.file_type().is_socket() {
        warn!("A non-socket file exists at the SSH agent socket path; leaving it untouched");
        return Err(StartError::new(
            StartErrorKind::AddressInUse,
            "a non-socket file exists at the socket path",
        ));
    }

    if is_owned_socket(&metadata) {
        debug!("Replacing socket previously published by this process");
        return remove_socket_file(path);
    }

    match probe_blocking(path, PROBE_TIMEOUT) {
        ProbeOutcome::Refused => {
            debug!("Removing stale socket");
            remove_socket_file(path)
        }
        ProbeOutcome::Missing => Ok(()),
        ProbeOutcome::Listening | ProbeOutcome::TimedOut => {
            warn!("Another agent is listening on the SSH agent socket path; leaving it untouched");
            Err(StartError::new(
                StartErrorKind::AddressInUse,
                "another agent is listening on the socket path",
            ))
        }
        ProbeOutcome::Failed(e) => Err(StartError::io("could not probe the existing socket", e)),
    }
}

fn remove_socket_file(path: &Path) -> Result<(), StartError> {
    match fs::remove_file(path) {
        Err(e) if e.kind() != io::ErrorKind::NotFound => {
            Err(StartError::io("could not remove the stale socket", e))
        }
        _ => Ok(()),
    }
}

/// Binds a socket that is only ever reachable with `0o600` permissions, then publishes it at
/// `path`.
///
/// The socket is bound inside a freshly created `0o700` directory next to `path` (same
/// filesystem), its mode set to `0o600`, and it is then hard-linked to `path`. `link(2)` fails
/// if `path` already exists, so a concurrently created file is never replaced. This avoids
/// changing the process-wide umask, which would race with other threads in the Electron main
/// process.
fn bind_user_only(path: &Path) -> Result<std::os::unix::net::UnixListener, StartError> {
    let parent = match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent,
        _ => Path::new("."),
    };

    let staging = StagingDir::create(parent)?;
    let staged_socket = staging.path.join(STAGED_SOCKET_NAME);

    let listener = std::os::unix::net::UnixListener::bind(&staged_socket)
        .map_err(|e| StartError::io("could not bind the socket", e))?;

    fs::set_permissions(&staged_socket, fs::Permissions::from_mode(0o600))
        .map_err(|e| StartError::io("could not set socket permissions", e))?;

    fs::hard_link(&staged_socket, path)
        .map_err(|e| StartError::io("could not publish the socket", e))?;

    // Remove the staging link and directory before recording the identity: dropping the extra
    // link changes the inode's ctime.
    drop(staging);
    record_owned_socket(path);

    Ok(listener)
}

/// A private, uniquely named directory used to bind the socket before publishing it.
/// Removed (with the staged socket link) on drop.
struct StagingDir {
    path: PathBuf,
}

impl StagingDir {
    fn create(parent: &Path) -> Result<Self, StartError> {
        let mut last_error = None;
        for _ in 0..STAGING_DIR_ATTEMPTS {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_or(0, |d| d.subsec_nanos());
            let name = format!(
                ".bwsa-{:x}{:x}{:x}",
                std::process::id(),
                STAGING_COUNTER.fetch_add(1, Ordering::Relaxed),
                nanos
            );
            let path = parent.join(name);
            // `mkdir` is exclusive and does not follow a symlink at the final component.
            match fs::DirBuilder::new().mode(0o700).create(&path) {
                Ok(()) => return Ok(Self { path }),
                Err(e) if e.kind() == io::ErrorKind::AlreadyExists => last_error = Some(e),
                Err(e) => {
                    return Err(StartError::io(
                        "could not create a private directory for the socket",
                        e,
                    ))
                }
            }
        }
        Err(StartError::io_with_kind(
            StartErrorKind::Unknown,
            "could not create a private directory for the socket",
            last_error.unwrap_or_else(|| io::Error::from(io::ErrorKind::AlreadyExists)),
        ))
    }
}

impl Drop for StagingDir {
    fn drop(&mut self) {
        let _ = fs::remove_file(self.path.join(STAGED_SOCKET_NAME));
        if let Err(error) = fs::remove_dir(&self.path) {
            warn!(%error, "Could not remove the SSH agent socket staging directory");
        }
    }
}

/// Identity of a socket inode, robust against inode number reuse via the change time.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct SocketIdentity {
    dev: u64,
    ino: u64,
    ctime: i64,
    ctime_nsec: i64,
}

impl SocketIdentity {
    fn of(metadata: &fs::Metadata) -> Self {
        Self {
            dev: metadata.dev(),
            ino: metadata.ino(),
            ctime: metadata.ctime(),
            ctime_nsec: metadata.ctime_nsec(),
        }
    }
}

fn record_owned_socket(path: &Path) {
    let identity = fs::symlink_metadata(path)
        .ok()
        .map(|m| SocketIdentity::of(&m));
    *OWNED_SOCKET.lock().unwrap_or_else(PoisonError::into_inner) = identity;
}

fn is_owned_socket(metadata: &fs::Metadata) -> bool {
    *OWNED_SOCKET.lock().unwrap_or_else(PoisonError::into_inner)
        == Some(SocketIdentity::of(metadata))
}

#[cfg(test)]
mod tests {
    use rand::{distr::Alphanumeric, Rng};

    use super::*;

    #[test]
    #[serial_test::serial]
    fn test_default_socket_path_success() {
        let path = get_default_socket_path().unwrap();
        let expected =
            PathBuf::from_iter([std::env::var("HOME").unwrap(), SOCKFILE_NAME.to_string()]);
        assert_eq!(path, expected);
    }

    #[test]
    #[serial_test::serial]
    fn test_socket_path_env_var_override() {
        let custom_path = "/tmp/bw-ssh-agent-custom-test.sock";
        // SAFETY: tests touching env vars are serialized via #[serial]
        unsafe { std::env::set_var(ENV_BITWARDEN_SSH_AUTH_SOCK, custom_path) };

        let path = get_socket_path().unwrap();

        unsafe { std::env::remove_var(ENV_BITWARDEN_SSH_AUTH_SOCK) };
        assert_eq!(path, PathBuf::from(custom_path));
    }

    #[test]
    #[serial_test::serial]
    fn test_socket_address_uses_same_resolution_as_bind() {
        let custom_path = "/tmp/bw-ssh-agent-address-test.sock";
        // SAFETY: tests touching env vars are serialized via #[serial]
        unsafe { std::env::set_var(ENV_BITWARDEN_SSH_AUTH_SOCK, custom_path) };

        let address = super::super::socket_address().unwrap();
        let path = get_socket_path().unwrap();

        unsafe { std::env::remove_var(ENV_BITWARDEN_SSH_AUTH_SOCK) };
        assert_eq!(address, custom_path);
        assert_eq!(PathBuf::from(address), path);
    }

    #[test]
    #[serial_test::serial]
    fn test_socket_address_default_matches_default_path() {
        let address = super::super::socket_address().unwrap();
        assert_eq!(PathBuf::from(address), get_default_socket_path().unwrap());
    }

    #[test]
    #[serial_test::serial]
    fn test_default_socket_path_flatpak() {
        // SAFETY: tests touching env vars are serialized via #[serial]
        unsafe { std::env::set_var("container", "flatpak") };

        let path = get_default_socket_path().unwrap();

        unsafe { std::env::remove_var("container") };
        let expected = PathBuf::from_iter([
            std::env::var("HOME").unwrap(),
            FLATPAK_DATA_DIR.to_string(),
            SOCKFILE_NAME.to_string(),
        ]);
        assert_eq!(path, expected);
    }

    /// Creates a fresh, empty directory under the temp dir. Each test gets its own so the
    /// "nothing left behind" assertions are meaningful.
    fn rand_dir_in_temp() -> PathBuf {
        let s: String = rand::rng()
            .sample_iter(&Alphanumeric)
            .take(12)
            .map(char::from)
            .collect();
        let path = std::env::temp_dir().join(format!("bwsa-test-{s}"));
        fs::create_dir(&path).unwrap();
        path
    }

    fn dir_entries(dir: &Path) -> Vec<String> {
        let mut entries: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        entries.sort();
        entries
    }

    #[tokio::test]
    async fn test_get_peer_info_connected_stream_returns_some() {
        // UnixStream::pair() creates a connected socketpair; peer_cred() on either end
        // returns the credentials of the creating process (this test process).
        let (stream, _peer) = tokio::net::UnixStream::pair().unwrap();

        let peer_info = get_peer_info(&stream);

        assert!(peer_info.is_some());
    }

    #[test]
    fn test_prepare_missing_path_is_ok() {
        let dir = rand_dir_in_temp();
        prepare_socket_path(&dir.join("agent.sock")).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn test_prepare_refuses_regular_file_and_keeps_it() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");
        fs::write(&path, "not a socket").unwrap();

        let error = prepare_socket_path(&path).unwrap_err();

        assert_eq!(error.kind(), StartErrorKind::AddressInUse);
        assert_eq!(fs::read_to_string(&path).unwrap(), "not a socket");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn test_prepare_does_not_follow_symlink() {
        let dir = rand_dir_in_temp();
        let target = dir.join("target.sock");
        let stale = std::os::unix::net::UnixListener::bind(&target).unwrap();
        drop(stale); // leaves a stale socket file behind
        let path = dir.join("agent.sock");
        std::os::unix::fs::symlink(&target, &path).unwrap();

        let error = prepare_socket_path(&path).unwrap_err();

        assert_eq!(error.kind(), StartErrorKind::AddressInUse);
        assert!(fs::symlink_metadata(&path)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(fs::exists(&target).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn test_prepare_keeps_live_socket_of_other_agent() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");
        let _other_agent = std::os::unix::net::UnixListener::bind(&path).unwrap();

        let error = prepare_socket_path(&path).unwrap_err();

        assert_eq!(error.kind(), StartErrorKind::AddressInUse);
        assert!(fs::exists(&path).unwrap());
        std::os::unix::net::UnixStream::connect(&path).expect("other agent still reachable");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn test_prepare_removes_stale_socket() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");
        drop(std::os::unix::net::UnixListener::bind(&path).unwrap());
        assert!(fs::exists(&path).unwrap());

        prepare_socket_path(&path).unwrap();

        assert!(!fs::exists(&path).unwrap());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn test_probe_blocking_outcomes() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");

        assert!(matches!(
            probe_blocking(&path, PROBE_TIMEOUT),
            ProbeOutcome::Missing
        ));

        let listener = std::os::unix::net::UnixListener::bind(&path).unwrap();
        assert!(matches!(
            probe_blocking(&path, PROBE_TIMEOUT),
            ProbeOutcome::Listening
        ));

        drop(listener);
        assert!(matches!(
            probe_blocking(&path, PROBE_TIMEOUT),
            ProbeOutcome::Refused
        ));
        fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_bind_publishes_user_only_socket_without_leftovers() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");

        let _listener = UnixListener::bind(&path).unwrap();

        let mode = fs::symlink_metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode, 0o140_600);
        assert_eq!(dir_entries(&dir), vec!["agent.sock".to_string()]);
        fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_bind_user_only_never_replaces_existing_file() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");
        // Simulates a file appearing between prepare_socket_path and the publish step.
        fs::write(&path, "raced").unwrap();

        let error = bind_user_only(&path).unwrap_err();

        assert_eq!(error.kind(), StartErrorKind::AddressInUse);
        assert_eq!(fs::read_to_string(&path).unwrap(), "raced");
        assert_eq!(dir_entries(&dir), vec!["agent.sock".to_string()]);
        fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_bind_replaces_own_socket_while_previous_listener_alive() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");

        // The previous listener is still alive (as during a stop/start before the listener task
        // has dropped it), so a connect probe would succeed. It must still be replaced.
        let _previous = UnixListener::bind(&path).unwrap();
        let _current = UnixListener::bind(&path).unwrap();

        assert!(probe(path.to_str().unwrap(), PROBE_TIMEOUT).await);
        fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_bind_permission_denied_on_unwritable_dir() {
        let dir = rand_dir_in_temp();
        fs::set_permissions(&dir, fs::Permissions::from_mode(0o500)).unwrap();

        let result = UnixListener::bind(&dir.join("agent.sock"));

        fs::set_permissions(&dir, fs::Permissions::from_mode(0o700)).unwrap();
        // Running as root would bypass the directory permissions; only assert when it failed.
        if let Err(error) = result {
            assert_eq!(error.kind(), StartErrorKind::PermissionDenied);
            assert!(!error.to_string().contains(dir.to_str().unwrap()));
        }
        fs::remove_dir_all(dir).unwrap();
    }

    #[tokio::test]
    async fn test_probe_reports_reachability() {
        let dir = rand_dir_in_temp();
        let path = dir.join("agent.sock");
        let address = path.to_str().unwrap().to_string();

        assert!(!probe(&address, PROBE_TIMEOUT).await, "missing socket");

        let listener = std::os::unix::net::UnixListener::bind(&path).unwrap();
        assert!(probe(&address, PROBE_TIMEOUT).await, "listening socket");

        drop(listener);
        assert!(!probe(&address, PROBE_TIMEOUT).await, "stale socket");

        fs::remove_file(&path).unwrap();
        fs::write(&path, "").unwrap();
        assert!(!probe(&address, PROBE_TIMEOUT).await, "regular file");
        fs::remove_dir_all(dir).unwrap();
    }
}
