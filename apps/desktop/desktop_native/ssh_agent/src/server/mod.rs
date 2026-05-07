//! SSH Agent Server implementation
//!
//! Adheres to the protocol defined in:
//! <https://datatracker.ietf.org/doc/draft-ietf-sshm-ssh-agent/>

mod auth_policy;
mod connection;
mod listener;
mod peer_info;
mod protocol;

use std::sync::Arc;

use anyhow::Result;
pub(crate) use auth_policy::AuthPolicy;
// external exports for napi
pub use auth_policy::{AuthRequest, SIGNamespace, SignRequest};
use connection::{Connection, ConnectionHandler};
pub(crate) use listener::Listener;
use tokio::{sync::mpsc, task::JoinHandle};
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};

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
    pub(crate) fn new(keystore: Arc<K>, auth_policy: Arc<A>) -> Self {
        Self {
            keystore,
            auth_policy,
            cancellation_token: None,
            accept_handle: None,
        }
    }

    pub(crate) fn start_with_default_listeners(&mut self) -> Result<()> {
        let listeners = listener::create_listeners()?;
        self.start(listeners)
    }

    /// Starts the server, listening on the provided listeners.
    ///
    /// Each listener runs in its own task and sends accepted connections to a shared
    /// channel. The accept loop dispatches each connection to a handler task.
    fn start<L>(&mut self, listeners: Vec<L>) -> Result<()>
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

        self.accept_handle = Some(accept_handle);
        self.cancellation_token = Some(cancel_token);

        Ok(())
    }

    pub(crate) fn is_running(&self) -> bool {
        self.cancellation_token.is_some()
    }

    pub(crate) fn stop(&mut self) {
        if let Some(cancel_token) = self.cancellation_token.take() {
            debug!("Stopping server");

            // Signal cancellation to all tasks
            cancel_token.cancel();

            // Abort the accept loop task
            if let Some(handle) = self.accept_handle.take() {
                handle.abort();
            }

            info!("Server stopped");
        } else {
            warn!("Cancellation token is None, server already stopped.");
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

        debug!("Spawning listener tasks");
        listener::spawn_listener_tasks(listeners, &tx, &cancel_token);

        // Dropping tx exlicitly allows it to close when all listener tasks exit,
        // this is necessary for the recv block below to exit when listeners exit.
        drop(tx);

        info!("Accepting connections");
        loop {
            tokio::select! {
                () = cancel_token.cancelled() => {
                    debug!("Accept loop received cancellation signal");
                    break;
                }
                conn = rx.recv() => if let Some(connection) = conn {
                    info!(peer_info = ?connection.peer_info, "Connection accepted");

                    let handler = ConnectionHandler::new(
                        keystore.clone(),
                        auth_policy.clone(),
                        connection,
                        cancel_token.clone(),
                    );
                    tokio::spawn(async move { handler.handle().await });
                } else {
                    debug!("All listener tasks exited");
                    break;
                }
            }
        }

        debug!("Accept loop exited");
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use anyhow::anyhow;
    use tokio::io::DuplexStream;

    use super::{connection::Connection, AuthPolicy, AuthRequest, Listener, SSHAgentServer};
    use crate::{authorization::AuthError, storage::keystore::MockKeyStore};

    struct AlwaysAllowPolicy;

    #[async_trait::async_trait]
    impl AuthPolicy for AlwaysAllowPolicy {
        async fn authorize(&self, _request: &AuthRequest) -> Result<bool, AuthError> {
            Ok(true)
        }
    }

    struct StubListener {
        rx: tokio::sync::mpsc::Receiver<Connection<DuplexStream>>,
    }

    #[async_trait::async_trait]
    impl Listener for StubListener {
        type Stream = DuplexStream;

        async fn accept(&mut self) -> anyhow::Result<Connection<Self::Stream>> {
            self.rx
                .recv()
                .await
                .ok_or_else(|| anyhow!("stub listener closed"))
        }
    }

    fn make_stub_listener() -> (
        StubListener,
        tokio::sync::mpsc::Sender<Connection<DuplexStream>>,
    ) {
        let (tx, rx) = tokio::sync::mpsc::channel(8);
        (StubListener { rx }, tx)
    }

    fn make_server() -> SSHAgentServer<MockKeyStore, AlwaysAllowPolicy> {
        SSHAgentServer::new(Arc::new(MockKeyStore::new()), Arc::new(AlwaysAllowPolicy))
    }

    #[tokio::test]
    async fn test_start_sets_running() {
        let mut server = make_server();
        let (listener, _tx) = make_stub_listener();

        server.start(vec![listener]).unwrap();

        assert!(server.is_running());
        server.stop();
    }

    #[tokio::test]
    async fn test_double_start_returns_error() {
        let mut server = make_server();
        let (listener1, _tx1) = make_stub_listener();
        let (listener2, _tx2) = make_stub_listener();

        server.start(vec![listener1]).unwrap();

        assert!(server.start(vec![listener2]).is_err());
        server.stop();
    }

    #[tokio::test]
    async fn test_stop_when_not_running_is_noop() {
        let mut server = make_server();

        server.stop();

        assert!(!server.is_running());
    }

    #[tokio::test]
    async fn test_stop_clears_running_state() {
        let mut server = make_server();
        let (listener, _tx) = make_stub_listener();
        server.start(vec![listener]).unwrap();

        server.stop();

        assert!(!server.is_running());
    }

    #[tokio::test]
    async fn test_server_can_restart() {
        let mut server = make_server();
        let (listener1, _tx1) = make_stub_listener();
        server.start(vec![listener1]).unwrap();
        server.stop();

        let (listener2, _tx2) = make_stub_listener();
        server.start(vec![listener2]).unwrap();

        assert!(server.is_running());
        server.stop();
    }
}
