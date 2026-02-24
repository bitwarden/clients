//! SSH agent client connection listener abstraction

use anyhow::Result;
use tokio::{
    io::{AsyncRead, AsyncWrite},
    sync::mpsc::Sender,
};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error};

use super::peer_info::PeerInfo;

/// Implementors handle platform-specific socket/pipe creation and connection acceptance.
#[async_trait::async_trait]
pub(crate) trait Listener: Send + Sync {
    /// The stream type returned by `accept()`
    type Stream: AsyncRead + AsyncWrite + Send + Unpin + 'static;

    /// Accept a new connection, returning the stream and peer information
    async fn accept(&mut self) -> Result<(Self::Stream, PeerInfo)>;
}

/// Spawns an independent tokio task for each listener in `listeners`.
///
/// Each task loops calling `listener.accept()` and forwards accepted connections to `tx`.
/// Tasks exit when the cancellation token is triggered or the channel receiver is dropped.
pub(crate) fn spawn_listener_tasks<L>(
    listeners: Vec<L>,
    tx: Sender<(L::Stream, PeerInfo)>,
    token: CancellationToken,
) where
    L: Listener + 'static,
{
    for mut listener in listeners {
        let tx = tx.clone();
        let token = token.clone();
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
