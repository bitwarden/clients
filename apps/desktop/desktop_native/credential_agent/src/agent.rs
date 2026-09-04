//! Lifecycle of the credential agent: owns the listener task and the provider it serves from.

use std::sync::Arc;

use anyhow::Result;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info};

use crate::{provider::CredentialProvider, server};

/// The Bitwarden credential agent.
///
/// ```text
/// bw-credential (CLI) --[unix socket / named pipe]--> agent --[napi]--> Electron (vault + prompt)
/// ```
///
/// The agent is pure transport and policy plumbing: it never holds vault data. Every request
/// is resolved by the [`CredentialProvider`], which lives on the Electron side.
pub struct BitwardenCredentialAgent<P: CredentialProvider> {
    provider: Arc<P>,
    /// `Some` exactly while the listener task is running.
    cancel_token: Option<CancellationToken>,
}

impl<P: CredentialProvider> BitwardenCredentialAgent<P> {
    pub fn new(provider: P) -> Self {
        Self {
            provider: Arc::new(provider),
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
            debug!("credential agent already running");
            return Ok(());
        }

        let listener = server::listener::create_listener()?;

        let token = CancellationToken::new();
        let provider = self.provider.clone();
        let task_token = token.clone();
        tokio::spawn(async move { server::serve(listener, provider, task_token).await });

        self.cancel_token = Some(token);
        info!("credential agent started");

        Ok(())
    }

    /// Stops accepting clients and cancels in-flight requests. Safe to call when stopped.
    pub fn stop(&mut self) {
        if let Some(token) = self.cancel_token.take() {
            token.cancel();
            info!("credential agent stopped");
        }
    }

    pub fn is_running(&self) -> bool {
        self.cancel_token
            .as_ref()
            .is_some_and(|token| !token.is_cancelled())
    }
}

impl<P: CredentialProvider> Drop for BitwardenCredentialAgent<P> {
    fn drop(&mut self) {
        self.stop();
    }
}
