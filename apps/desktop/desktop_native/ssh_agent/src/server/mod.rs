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
use tokio::{sync::Mutex, task::JoinHandle};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info};

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
    K: KeyStore,
    A: AuthPolicy,
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

    pub fn start(&mut self) -> Result<()> {
        if self.is_running() {
            return Err(anyhow::anyhow!("Server is already running"));
        }

        let token = CancellationToken::new();

        // TODO: Create socket/pipe listener
        //
        // let listener = Arc::new(tokio::sync::Mutex::new(create_listener()?));
        //
        // // Spawn accept loop to handle incoming connections
        // let accept_handle = tokio::spawn(Self::accept_loop(
        //     listener,
        //     self.keystore.clone(),
        //     self.auth_policy.clone(),
        //     token.clone(),
        // ));
        // self.accept_handle = Some(accept_handle);

        self.cancellation_token = Some(token);

        Ok(())
    }

    pub fn is_running(&self) -> bool {
        self.cancellation_token.is_some()
    }

    pub fn stop(&mut self) {
        if let Some(token) = self.cancellation_token.take() {
            info!("Stopping SSH agent server");

            // Signal cancellation to all tasks
            token.cancel();

            // Abort the accept loop task
            if let Some(handle) = self.accept_handle.take() {
                handle.abort();
            }

            info!("SSH agent server stopped");
        } else {
            debug!("Cancellation token is None, server already stopped.");
        }
    }

    /// Handles incoming connections and spawns handler tasks.
    /// Runs until the cancellation token is triggered or an unrecoverable error occurs.
    async fn accept<L>(
        listener: Arc<Mutex<L>>,
        keystore: Arc<K>,
        auth_policy: Arc<A>,
        token: CancellationToken,
    ) where
        L: Listener,
    {
        loop {
            tokio::select! {
                () = token.cancelled() => {
                    debug!("Accept loop received cancellation signal");
                    break;
                }

                result = async { listener.lock().await.accept().await } => match result {
                    Ok((stream, peer_info)) => {
                        info!(?peer_info, "Connection accepted");

                        // TODO: Spawn handler for this connection
                        // Example:
                        // let handler = handler::ConnectionHandler::new(
                        //     keystore.clone(),
                        //     auth_policy.clone(),
                        //     stream,
                        //     token.clone(),
                        // );
                        // tokio::spawn(async move {
                        //     handler.handle().await
                        // });

                        // TODO: temporary to avoid unused var warnings
                        let _ = stream;
                        let _ = keystore;
                        let _ = auth_policy;
                    }
                    Err(error) => {
                        error!(%error, "Listener accept failed");
                    }
                }
            }
        }

        info!("Accept loop exiting");
    }
}
