//! SSH Agent Server implementation
//!
//! Adheres to the protocol defined in:
//! <https://datatracker.ietf.org/doc/draft-ietf-sshm-ssh-agent/>

mod auth_policy;
mod connection;
mod listener;
mod peer_info;

use std::sync::Arc;

use anyhow::Result;
pub(crate) use auth_policy::AuthPolicy;
// external exports for napi
pub use auth_policy::{AuthRequest, SIGNamespace, SignRequest};
use connection::Connection;
pub(crate) use listener::Listener;
use tokio::{sync::mpsc, task::JoinHandle};
use tokio_util::sync::CancellationToken;
use tracing::{debug, info};

use crate::KeyStore;

/// Buffer accepted connections pending dispatch to handler tasks.
const CONNECTION_CHANNEL_CAPACITY: usize = 32;

/// SSH Agent protocol server.
///
/// Handles SSH agent protocol messages and delegates to provided
/// keystore and authorization policy implementations.
///
/// The server internally manages its lifecycle - it can be created, started, stopped,
/// and restarted without being re-created.
pub struct SSHAgentServer<K, A> {
    /// The storage of SSH key data
    keystore: Arc<K>,
    /// The authenticator policy to invoke for operations that require authorization
    auth_policy: Arc<A>,
    /// Async task coordination to use when asked to stop. Is `None` when not running.
    cancellation_token: Option<CancellationToken>,
    /// Task handle for the accept loop. Is `None` when not running.
    accept_handle: Option<JoinHandle<()>>,
}

impl<K, A> SSHAgentServer<K, A>
where
    K: KeyStore + 'static,
    A: AuthPolicy + 'static,
{
    /// Creates a new [`SSHAgentServer`]
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

        let cancel_token = CancellationToken::new();

        info!("Starting server");

        let accept_handle = tokio::spawn(Self::accept(
            listeners,
            self.keystore.clone(),
            self.auth_policy.clone(),
            cancel_token.clone(),
        ));

        info!("Server started");

        self.accept_handle = Some(accept_handle);
        self.cancellation_token = Some(cancel_token);

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.cancellation_token.is_some()
    }

    pub fn stop(&mut self) {
        if let Some(cancel_token) = self.cancellation_token.take() {
            info!("Stopping server");

            // Signal cancellation to all tasks
            cancel_token.cancel();

            // Abort the accept loop task
            if let Some(handle) = self.accept_handle.take() {
                handle.abort();
            }

            info!("Server stopped");
        } else {
            debug!("Cancellation token is None, server already stopped.");
        }
    }

    /// Spawns listener tasks for each listener.
    /// Incoming connections from listener tasks are dispatched to handler tasks.
    /// Loops until cancelled or all listener tasks have exited.
    async fn accept<L>(
        listeners: Vec<L>,
        keystore: Arc<K>,
        auth_policy: Arc<A>,
        cancel_token: CancellationToken,
    ) where
        L: Listener + 'static,
        L::Stream: 'static,
    {
        let (tx, mut rx) = mpsc::channel::<Connection<L::Stream>>(CONNECTION_CHANNEL_CAPACITY);

        debug!("Accept loop spawning listener tasks");
        listener::spawn_listener_tasks(listeners, &tx, &cancel_token);

        // Dropping tx exlicitly allows it to close when all listener tasks exit,
        // this is necessary for the recv block below to exit when listeners exit.
        drop(tx);

        info!("Accept loop starting");
        loop {
            tokio::select! {
                () = cancel_token.cancelled() => {
                    debug!("Accept loop received cancellation signal");
                    break;
                }
                conn = rx.recv() => if let Some(connection) = conn {
                    info!(peer_info = ?connection.peer_info, "Connection accepted");

                    // TODO: PM-30755 Spawn handler for this connection
                    // let handler = ConnectionHandler::new(
                    //     keystore.clone(),
                    //     auth_policy.clone(),
                    //     connection,
                    //     token.clone(),
                    // );
                    // tokio::spawn(async move { handler.handle().await });

                    // TODO: PM-30755 temporary to avoid unused var warnings
                    let _ = connection;
                    let _ = keystore;
                    let _ = auth_policy;
                } else {
                    debug!("All listener tasks exited");
                    break;
                }
            }
        }

        info!("Accept loop exited");
    }
}
