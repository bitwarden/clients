//! Windows named pipe transport for the credential agent.

use std::{mem, os::windows::io::AsRawHandle};

use anyhow::{anyhow, Result};
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
use tracing::{info, warn};
use windows::Win32::{Foundation::HANDLE, System::Pipes::GetNamedPipeClientProcessId};

use super::{Connection, Listener};
use crate::{provider::PeerContext, server::peer_info};

/// The pipe clients connect to. Also see [`crate::pipe_name`].
pub(crate) const PIPE_NAME: &str = r"\\.\pipe\bitwarden-credential-agent";

pub(crate) struct WindowsListener {
    inner: NamedPipeServer,
}

impl WindowsListener {
    /// Creates the first pipe instance synchronously, so the name is registered with the
    /// OS before this returns and clients never race the listener.
    pub(crate) fn new() -> Result<Self> {
        let inner = ServerOptions::new()
            .first_pipe_instance(true)
            .create(PIPE_NAME)
            .map_err(|e| anyhow!("Unable to create named pipe {PIPE_NAME}: {e}"))?;

        info!(pipe_name = PIPE_NAME, "credential agent pipe ready");

        Ok(Self { inner })
    }
}

#[async_trait::async_trait]
impl Listener for WindowsListener {
    type Stream = NamedPipeServer;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        self.inner.connect().await?;

        // Create the next instance before handing off the current one, so the pipe name
        // stays available to subsequent clients without a gap.
        let next = ServerOptions::new()
            .create(PIPE_NAME)
            .map_err(|e| anyhow!("Failed to create next pipe instance after accept: {e}"))?;

        let stream = mem::replace(&mut self.inner, next);

        Ok(Connection {
            peer: peer_context(&stream),
            stream,
        })
    }
}

fn peer_context(server: &NamedPipeServer) -> PeerContext {
    let mut pid: u32 = 0;
    let handle = HANDLE(server.as_raw_handle().cast());

    // SAFETY: `handle` is valid for the duration of the call because `server` is still
    // alive, and `pid` is a local Windows writes the client pid into.
    if let Err(error) = unsafe { GetNamedPipeClientProcessId(handle, &raw mut pid) } {
        warn!(%error, "Failed to get named pipe client process id");
        return PeerContext::default();
    }

    peer_info::context_from_pid(pid)
}
