//! Unix domain socket transport for the credential agent.

use std::{fs, os::unix::fs::PermissionsExt, path::PathBuf};

use anyhow::{anyhow, Result};
use tokio::net::UnixStream;
use tracing::{debug, error, info};

use super::{Connection, Listener};
use crate::{provider::PeerContext, server::peer_info};

/// Overrides the default socket path. Mirrors `BITWARDEN_SSH_AUTH_SOCK` for the SSH agent.
const ENV_BITWARDEN_CREDENTIAL_SOCK: &str = "BITWARDEN_CREDENTIAL_SOCK";

const FLATPAK_DATA_DIR: &str = ".var/app/com.bitwarden.desktop/data";

const SOCKFILE_NAME: &str = ".bitwarden-credential-agent.sock";

/// Only the owning user may talk to the agent.
const SOCKET_MODE: u32 = 0o600;

pub(crate) struct UnixListener {
    inner: tokio::net::UnixListener,
}

impl UnixListener {
    /// Binds the agent socket, replacing any stale socket file left by a previous run.
    ///
    /// The path comes from `BITWARDEN_CREDENTIAL_SOCK` when set, otherwise
    /// `$HOME/.bitwarden-credential-agent.sock`.
    pub(crate) fn new() -> Result<Self> {
        let socket_path = socket_path()?;

        remove_stale_socket(&socket_path)?;

        let inner = tokio::net::UnixListener::bind(&socket_path)
            .map_err(|e| anyhow!("Unable to bind to socket {}: {e}", socket_path.display()))?;

        set_user_permissions(&socket_path)?;

        info!(?socket_path, "credential agent socket ready");

        Ok(Self { inner })
    }
}

#[async_trait::async_trait]
impl Listener for UnixListener {
    type Stream = UnixStream;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        let (stream, _addr) = self.inner.accept().await?;

        Ok(Connection {
            peer: peer_context(&stream),
            stream,
        })
    }
}

fn peer_context(stream: &UnixStream) -> PeerContext {
    let pid = stream
        .peer_cred()
        .ok()
        .and_then(|cred| cred.pid())
        .and_then(|pid| u32::try_from(pid).ok());

    match pid {
        Some(pid) => peer_info::context_from_pid(pid),
        None => PeerContext::default(),
    }
}

/// Resolves the socket path clients are expected to connect to.
pub fn socket_path() -> Result<PathBuf> {
    if let Ok(path) = std::env::var(ENV_BITWARDEN_CREDENTIAL_SOCK) {
        return Ok(PathBuf::from(path));
    }

    debug!(
        socket_path_env_var = ENV_BITWARDEN_CREDENTIAL_SOCK,
        "not set, using default path"
    );
    default_socket_path()
}

fn is_flatpak() -> bool {
    std::env::var("container") == Ok("flatpak".to_string())
}

fn default_socket_path() -> Result<PathBuf> {
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
    fs::set_permissions(path, fs::Permissions::from_mode(SOCKET_MODE)).map_err(|e| {
        anyhow!(
            "Could not set socket permissions for {}: {e}",
            path.display()
        )
    })
}

fn remove_stale_socket(path: &PathBuf) -> Result<()> {
    if let Ok(true) = fs::exists(path) {
        fs::remove_file(path)
            .map_err(|e| anyhow!("Error removing stale socket {}: {e}", path.display()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[serial_test::serial]
    fn test_default_socket_path_is_in_home() {
        let path = default_socket_path().unwrap();

        let expected =
            PathBuf::from_iter([std::env::var("HOME").unwrap(), SOCKFILE_NAME.to_string()]);
        assert_eq!(path, expected);
    }

    #[test]
    #[serial_test::serial]
    fn test_env_var_overrides_socket_path() {
        let custom_path = "/tmp/bw-credential-agent-custom-test.sock";
        // SAFETY: tests touching env vars are serialized via #[serial].
        unsafe { std::env::set_var(ENV_BITWARDEN_CREDENTIAL_SOCK, custom_path) };

        let path = socket_path().unwrap();

        unsafe { std::env::remove_var(ENV_BITWARDEN_CREDENTIAL_SOCK) };
        assert_eq!(path, PathBuf::from(custom_path));
    }

    #[tokio::test]
    async fn test_peer_context_of_connected_stream_is_resolved() {
        // A socketpair reports the creating process (this test) on both ends.
        let (stream, _peer) = tokio::net::UnixStream::pair().unwrap();

        let context = peer_context(&stream);

        assert_eq!(context.pid, Some(std::process::id()));
    }

    #[test]
    fn test_socket_is_owner_only() {
        let path = std::env::temp_dir().join("bw-credential-agent-perm-test.sock");
        fs::write(&path, "").unwrap();

        set_user_permissions(&path).unwrap();

        let mode = fs::metadata(&path).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, SOCKET_MODE);
        remove_stale_socket(&path).unwrap();
    }
}
