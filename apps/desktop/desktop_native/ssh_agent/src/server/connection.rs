//! SSH agent client connection and connection handler

use std::sync::Arc;

use tokio::io::{AsyncRead, AsyncWrite};
use tokio_util::sync::CancellationToken;
use tracing::info;

use super::{auth_policy::AuthPolicy, peer_info::PeerInfo, KeyStore};

/// An accepted connection from an SSH agent client, bundling the I/O stream
/// with information about the connecting peer.
pub(crate) struct Connection<S> {
    /// The I/O stream for this connection
    pub(crate) stream: S,
    /// Information about the connected peer process
    pub(crate) peer_info: PeerInfo,
}

/// Handles an individual SSH agent client connection
pub(crate) struct ConnectionHandler<K, A, S> {
    keystore: Arc<K>,
    auth_policy: Arc<A>,
    connection: Connection<S>,
    token: CancellationToken,
}

impl<K, A, S> ConnectionHandler<K, A, S>
where
    K: KeyStore,
    A: AuthPolicy,
    S: AsyncRead + AsyncWrite + Unpin,
{
    /// Create a new connection handler
    pub fn new(
        keystore: Arc<K>,
        auth_policy: Arc<A>,
        connection: Connection<S>,
        token: CancellationToken,
    ) -> Self {
        Self {
            keystore,
            auth_policy,
            connection,
            token,
        }
    }

    /// Handle incoming SSH agent protocol messages from the client
    #[allow(clippy::never_loop)] // TODO PM-30755 remove
    pub async fn handle(self) {
        info!(peer_info = ?self.connection.peer_info, "Connection handler started");

        loop {
            tokio::select! {
                () = self.token.cancelled() => {
                    info!("Connection handler received cancellation signal");
                    break;
                }

                // TODO: PM-30755
                // read SSH protocol message from self.connection.stream
                // parse message type, use auth policy and keystore to satisfy requests
                // build response and write back to self.connection.stream
            }
        }

        info!("Connection handler shutting down");
    }
}
