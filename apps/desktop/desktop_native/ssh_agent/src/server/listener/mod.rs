//! SSH agent client connection listener abstraction

#[cfg(unix)]
pub(crate) mod unix;

#[cfg(windows)]
pub(crate) mod windows;

use std::time::Duration;

use anyhow::Result;
use tokio::{
    io::{AsyncRead, AsyncWrite},
    sync::mpsc::Sender,
};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error};

use super::{connection::Connection, StartError};

/// Implementors handle platform-specific socket/pipe creation and connection acceptance.
#[async_trait::async_trait]
pub(crate) trait Listener: Send + Sync {
    /// The stream type returned by `accept()`
    type Stream: AsyncRead + AsyncWrite + Send + Unpin + 'static;

    /// Accept a new connection
    async fn accept(&mut self) -> Result<Connection<Self::Stream>>;
}

/// Upper bound for a single connectivity probe of an agent address.
pub(crate) const PROBE_TIMEOUT: Duration = Duration::from_millis(500);

/// Creates the listeners for the Unix platform.
#[cfg(unix)]
pub(crate) fn create_listeners() -> Result<Vec<impl Listener>, StartError> {
    Ok(vec![unix::UnixListener::new()?])
}

/// Creates the listeners for the Windows platform.
#[cfg(windows)]
pub(crate) fn create_listeners() -> Result<Vec<impl Listener>, StartError> {
    Ok(vec![windows::WindowsListener::new()?])
}

/// Returns the address the agent listens on: the Unix socket path or the Windows pipe name.
///
/// This is the single source of truth used both when binding and when reporting the address to
/// Electron.
///
/// # Errors
///
/// Unix only: fails if the default path cannot be resolved (no home directory) or the path is
/// not valid UTF-8. The error text never contains the path.
pub fn socket_address() -> Result<String> {
    #[cfg(unix)]
    {
        unix::get_socket_path()?
            .into_os_string()
            .into_string()
            .map_err(|_| anyhow::anyhow!("SSH agent socket path is not valid UTF-8"))
    }
    #[cfg(windows)]
    {
        Ok(windows::PIPE_NAME.to_string())
    }
}

/// Returns `true` if a client can connect to `address` (a Unix socket path or a Windows pipe
/// name) within a short timeout.
///
/// Only a transport-level connect is performed. No agent protocol message is sent, so the
/// listening agent never sees a list or sign request and no approval prompt is triggered.
pub async fn probe_address(address: &str) -> bool {
    #[cfg(unix)]
    {
        unix::probe(address, PROBE_TIMEOUT).await
    }
    #[cfg(windows)]
    {
        windows::probe(address, PROBE_TIMEOUT).await
    }
}

/// Spawns an independent tokio task for each listener in `listeners`.
///
/// Each task loops calling `listener.accept()` and forwards accepted connections to `tx`.
/// Tasks exit when the cancellation token is triggered or the channel receiver is dropped.
pub(crate) fn spawn_listener_tasks<L>(
    listeners: Vec<L>,
    tx: &Sender<Connection<L::Stream>>,
    cancel_token: &CancellationToken,
) where
    L: Listener + 'static,
{
    for mut listener in listeners {
        let tx = tx.clone();
        let token = cancel_token.clone();
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    () = token.cancelled() => {
                        debug!("Listener task received cancellation signal");
                        break;
                    }
                    result = listener.accept() => match result {
                        Ok(conn) => {
                            // Receiver dropped; main loop has exited
                            if tx.send(conn).await.is_err() {
                                break;
                            }
                        }
                        // Continue to retry on transient errors
                        Err(error) => {
                            error!(%error, "Listener accept failed");
                        }
                    }
                }
            }
        });
    }
}
