//! Lifecycle of the agent listener.

use std::sync::Arc;

use anyhow::Result;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info};

use crate::{router::Router, server};

/// Transport only: it never holds vault data; the router's answerer resolves every request.
pub struct BitwardenCredentialAgent {
    router: Arc<Router>,
    /// `Some` exactly while the listener task is running.
    cancel_token: Option<CancellationToken>,
}

impl BitwardenCredentialAgent {
    pub fn new(router: Arc<Router>) -> Self {
        Self {
            router,
            cancel_token: None,
        }
    }

    /// Binds the platform socket and starts accepting clients.
    ///
    /// Must be called from within a Tokio runtime. Calling this while the agent is already
    /// running is a no-op, so callers can start it idempotently.
    ///
    /// # Errors
    ///
    /// Returns an error if the socket or named pipe cannot be created.
    pub fn start(&mut self) -> Result<()> {
        if self.is_running() {
            debug!("agent already running");
            return Ok(());
        }

        let listener = server::listener::create_listener()?;

        let token = CancellationToken::new();
        let router = self.router.clone();
        let task_token = token.clone();
        tokio::spawn(async move { server::serve(listener, router, task_token).await });

        self.cancel_token = Some(token);
        info!("agent started");

        Ok(())
    }

    /// Stops accepting clients and cancels in-flight requests. Safe to call when stopped.
    pub fn stop(&mut self) {
        if let Some(token) = self.cancel_token.take() {
            token.cancel();
            info!("agent stopped");
        }
    }

    pub fn is_running(&self) -> bool {
        self.cancel_token
            .as_ref()
            .is_some_and(|token| !token.is_cancelled())
    }
}

impl Drop for BitwardenCredentialAgent {
    fn drop(&mut self) {
        self.stop();
    }
}
