//! Unix socket transport: owner-only, never steals a live socket, drops other users' peers.

use std::{
    fs,
    os::unix::fs::{MetadataExt, PermissionsExt},
    path::{Path, PathBuf},
};

use anyhow::{anyhow, bail, Result};
use tokio::net::UnixStream;
use tracing::{info, warn};

use super::{Connection, Listener};

const ENV_SOCKET_PATH: &str = "BITWARDEN_ACCESS_SOCK";
const FLATPAK_DATA_DIR: &str = ".var/app/com.bitwarden.desktop/data";
const SOCKFILE_NAME: &str = ".bitwarden-access.sock";
const SOCKET_MODE: u32 = 0o600;

pub(crate) struct UnixListener {
    inner: tokio::net::UnixListener,
    path: PathBuf,
    inode: u64,
}

impl UnixListener {
    pub(crate) fn new() -> Result<Self> {
        let path = socket_path()?;
        remove_stale_socket(&path)?;

        // Bind under a umask so the socket is never briefly reachable by others.
        // SAFETY: umask has no preconditions; the previous mask is restored right after bind.
        let previous = unsafe { libc::umask(0o177) };
        let bound = tokio::net::UnixListener::bind(&path);
        // SAFETY: as above.
        unsafe { libc::umask(previous) };
        let inner = bound.map_err(|e| anyhow!("Unable to bind {}: {e}", path.display()))?;

        fs::set_permissions(&path, fs::Permissions::from_mode(SOCKET_MODE))?;
        let inode = fs::metadata(&path)?.ino();
        info!(socket_path = %path.display(), "agent socket ready");

        Ok(Self { inner, path, inode })
    }
}

impl Drop for UnixListener {
    fn drop(&mut self) {
        // Only remove the file if it is still ours, not a newer instance's.
        if fs::metadata(&self.path).is_ok_and(|m| m.ino() == self.inode) {
            let _ = fs::remove_file(&self.path);
        }
    }
}

#[async_trait::async_trait]
impl Listener for UnixListener {
    type Stream = UnixStream;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        loop {
            let (stream, _addr) = self.inner.accept().await?;
            let cred = match stream.peer_cred() {
                Ok(cred) => cred,
                Err(error) => {
                    warn!(%error, "dropping a peer without credentials");
                    continue;
                }
            };
            // SAFETY: geteuid has no preconditions.
            if cred.uid() != unsafe { libc::geteuid() } {
                warn!(uid = cred.uid(), "dropping a peer owned by another user");
                continue;
            }

            let peer_pid = cred.pid().and_then(|pid| u32::try_from(pid).ok());
            return Ok(Connection { stream, peer_pid });
        }
    }
}

pub fn socket_path() -> Result<PathBuf> {
    if let Ok(path) = std::env::var(ENV_SOCKET_PATH) {
        return Ok(PathBuf::from(path));
    }

    let Ok(Some(mut home)) = homedir::my_home() else {
        bail!("Could not determine home directory");
    };
    if std::env::var("container").as_deref() == Ok("flatpak") {
        home = home.join(FLATPAK_DATA_DIR);
    }
    Ok(home.join(SOCKFILE_NAME))
}

fn remove_stale_socket(path: &Path) -> Result<()> {
    if !fs::exists(path)? {
        return Ok(());
    }
    if std::os::unix::net::UnixStream::connect(path).is_ok() {
        bail!("Another process is serving {}", path.display());
    }
    fs::remove_file(path)
        .map_err(|e| anyhow!("Error removing stale socket {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("bw-access-{name}-{}.sock", std::process::id()))
    }

    #[test]
    #[serial_test::serial]
    fn test_default_socket_path_is_in_home() {
        let path = socket_path().unwrap();

        assert_eq!(
            path,
            PathBuf::from(std::env::var("HOME").unwrap()).join(SOCKFILE_NAME)
        );
    }

    #[test]
    #[serial_test::serial]
    fn test_env_var_overrides_socket_path() {
        // SAFETY: tests touching env vars are serialized via #[serial].
        unsafe { std::env::set_var(ENV_SOCKET_PATH, "/tmp/custom.sock") };
        let path = socket_path().unwrap();
        unsafe { std::env::remove_var(ENV_SOCKET_PATH) };

        assert_eq!(path, PathBuf::from("/tmp/custom.sock"));
    }

    #[test]
    fn test_removes_a_dead_socket_but_refuses_a_live_one() {
        let dead = temp_path("dead");
        drop(std::os::unix::net::UnixListener::bind(&dead).unwrap());
        remove_stale_socket(&dead).unwrap();
        assert!(!dead.exists());

        let live = temp_path("live");
        let _listener = std::os::unix::net::UnixListener::bind(&live).unwrap();
        assert!(remove_stale_socket(&live).is_err());
        assert!(live.exists());
        fs::remove_file(&live).unwrap();
    }

    #[tokio::test]
    #[serial_test::serial]
    async fn test_binds_owner_only_and_cleans_up() {
        let path = temp_path("bind");
        // SAFETY: tests touching env vars are serialized via #[serial].
        unsafe { std::env::set_var(ENV_SOCKET_PATH, &path) };
        let listener = UnixListener::new().unwrap();
        unsafe { std::env::remove_var(ENV_SOCKET_PATH) };

        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            SOCKET_MODE
        );
        drop(listener);
        assert!(!path.exists());
    }
}
