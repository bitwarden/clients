//! SSH Agent Server implementation
//!
//! Adheres to the protocol defined in:
//! <https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html>

mod auth_policy;
mod connection_handler;
mod listener;
mod peer_info;

use std::sync::Arc;

use anyhow::Result;
pub(crate) use auth_policy::AuthPolicy;
pub use auth_policy::{AuthRequest, SignRequest};
pub(crate) use listener::Listener;
use peer_info::PeerInfo;
use tokio::{sync::mpsc, task::JoinHandle};
use tokio_util::sync::CancellationToken;
use tracing::{debug, info};

use crate::crypto::keystore::KeyStore;

/// SSH Agent protocol server.
///
/// Handles SSH agent protocol messages and delegates to provided
/// keystore and authorization policy implementations.
///
/// The server internally manages its lifecycle - it can be created, started, stopped,
/// and restarted without being re-created.
pub struct SshAgentServer<K, A> {
    /// The storeage of SSH key data
    keystore: Arc<K>,
    /// The authenticator policy to invoke for operations that require authorization
    auth_policy: Arc<A>,
    /// Async task coordination to use when asked to stop. Is `None` when non running.
    cancellation_token: Option<CancellationToken>,
    /// Task handle for the accept loop. Is `None` when not running.
    accept_handle: Option<JoinHandle<()>>,
}

impl<K, A> SshAgentServer<K, A>
where
    K: KeyStore + 'static,
    A: AuthPolicy + 'static,
{
    /// Creates a new [`SshAgentServer`]
    pub fn new(keystore: Arc<K>, auth_policy: Arc<A>) -> Self {
        Self {
            keystore,
            auth_policy,
            cancellation_token: None,
            accept_handle: None,
        }
    }

    /// Starts the server, listening on the provided listeners.
    ///
    /// Each listener runs in its own task and sends accepted connections to a shared
    /// channel. The accept loop dispatches each connection to a handler task.
    pub fn start<L>(&mut self, listeners: Vec<L>) -> Result<()>
    where
        L: Listener + 'static,
    {
        if self.is_running() {
            return Err(anyhow::anyhow!("Server is already running"));
        }

        let token = CancellationToken::new();

        info!("Starting server");

        let accept_handle = tokio::spawn(Self::accept(
            listeners,
            self.keystore.clone(),
            self.auth_policy.clone(),
            token.clone(),
        ));

        info!("Server started");

        self.accept_handle = Some(accept_handle);
        self.cancellation_token = Some(token);

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.cancellation_token.is_some()
    }

    pub fn stop(&mut self) {
        if let Some(token) = self.cancellation_token.take() {
            info!("Stopping server");

            // Signal cancellation to all tasks
            token.cancel();

            // Abort the accept loop task
            if let Some(handle) = self.accept_handle.take() {
                handle.abort();
            }

            info!("Server stopped");
        } else {
            debug!("Cancellation token is None, server already stopped.");
        }
    }

    /// Dispatches incoming connections to handler tasks.
    ///
    /// [`listener::spawn_listener_tasks`], then loops reading accepted connections
    /// from the channel until cancelled or all listener tasks have exited.
    async fn accept<L>(
        listeners: Vec<L>,
        keystore: Arc<K>,
        auth_policy: Arc<A>,
        token: CancellationToken,
    ) where
        L: Listener + 'static,
        L::Stream: 'static,
    {
        // Creates an mpsc channel spawns per-listener tasks
        let (tx, mut rx) = mpsc::channel::<(L::Stream, PeerInfo)>(32);

        debug!("Accept loop spawning listener tasks");
        listener::spawn_listener_tasks(listeners, tx, token.clone());
        // `tx` dropped ; channel closes when all listener tasks exit

        info!("Accept loop starting");
        loop {
            tokio::select! {
                () = token.cancelled() => {
                    debug!("Accept loop received cancellation signal");
                    break;
                }
                conn = rx.recv() => match conn {
                    Some((stream, peer_info)) => {
                        info!(?peer_info, "Connection accepted");

                        // TODO: Spawn handler for this connection
                        // let handler = ConnectionHandler::new(
                        //     keystore.clone(),
                        //     auth_policy.clone(),
                        //     stream,
                        //     token.clone(),
                        // );
                        // tokio::spawn(async move { handler.handle().await });

                        // TODO: temporary to avoid unused var warnings
                        let _ = stream;
                        let _ = keystore;
                        let _ = auth_policy;
                    }
                    None => {
                        // All listener tasks have exited naturally
                        debug!("All listener tasks exited");
                        break;
                    }
                }
            }
        }

        info!("Accept loop exited");
    }
}
