//! Unix domain socket listener for the SSH agent server

use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf};

use anyhow::{anyhow, Result};
use tokio::net::UnixStream;
use tracing::{error, info};

use super::Listener;
use crate::server::{connection::Connection, peer_info::PeerInfo};

/// Environment variable that overrides the default socket path
const ENV_BITWARDEN_SSH_AUTH_SOCK: &str = "BITWARDEN_SSH_AUTH_SOCK";

const FLATPAK_DATA_DIR: &str = ".var/app/com.bitwarden.desktop/data";

const SOCKFILE_NAME: &str = ".bitwarden-ssh-agent.sock";

/// Unix domain socket listener for the SSH agent server
pub(crate) struct UnixListener {
    inner: tokio::net::UnixListener,
}

impl UnixListener {
    /// Creates a new [`UnixListener`], binding to the resolved socket path.
    ///
    /// The socket path is resolved from the `BITWARDEN_SSH_AUTH_SOCK` environment variable if set,
    /// otherwise it defaults to `$HOME/.bitwarden-ssh-agent.sock`.
    /// Any stale socket file at that path is removed before binding.
    /// Permissions are set to `0o600` so only the current user can access the socket.
    ///
    /// # Errors
    ///
    /// Returns an error if the socket path cannot be resolved, the stale socket cannot be removed,
    /// binding fails, or permissions cannot be set.
    pub(crate) fn new() -> Result<Self> {
        let socket_path = get_socket_path()?;

        remove_stale_socket(&socket_path)?;

        info!(?socket_path, "Binding socket");

        let listener = tokio::net::UnixListener::bind(&socket_path)
            .map_err(|e| anyhow!("Unable to bind to socket {}: {e}", socket_path.display()))?;

        set_user_permissions(&socket_path)?;

        info!(?socket_path, "socket listener ready");

        Ok(Self { inner: listener })
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

fn get_socket_path() -> Result<PathBuf> {
    if let Ok(path) = std::env::var(ENV_BITWARDEN_SSH_AUTH_SOCK) {
        Ok(PathBuf::from(path))
    } else {
        info!(
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

fn set_user_permissions(path: &PathBuf) -> Result<()> {
    fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|e| {
        anyhow!(
            "Could not set socket permissions for {}: {e}",
            path.display()
        )
    })
}

fn remove_stale_socket(path: &PathBuf) -> Result<()> {
    if let Ok(true) = std::fs::exists(path) {
        std::fs::remove_file(path)
            .map_err(|e| anyhow!("Error removing stale socket {}: {e}", path.display()))?;
    }
    Ok(())
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

    fn rand_path_in_temp() -> PathBuf {
        let mut path = std::env::temp_dir();
        let s: String = rand::rng()
            .sample_iter(&Alphanumeric)
            .take(16)
            .map(char::from)
            .collect();
        path.push(s);
        path
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
    fn test_remove_stale_socket_exists() {
        let path = rand_path_in_temp();
        fs::write(&path, "").unwrap();
        remove_stale_socket(&path).unwrap();
        assert!(!fs::exists(&path).unwrap());
    }

    #[test]
    fn test_remove_stale_socket_not_found() {
        let path = rand_path_in_temp();
        remove_stale_socket(&path).unwrap();
        assert!(!fs::exists(&path).unwrap());
    }

    #[test]
    fn test_set_user_permissions() {
        let path = rand_path_in_temp();
        fs::write(&path, "").unwrap();

        set_user_permissions(&path).unwrap();

        let permissions = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(permissions, 0o100_600);

        remove_stale_socket(&path).unwrap();
    }
}
