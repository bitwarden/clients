use futures::Stream;
use std::os::unix::fs::PermissionsExt;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::{fs, io};
use tokio::net::{UnixListener, UnixStream};
use tracing::{error, info};

use crate::agent::desktop_agent::BitwardenDesktopAgent;
use crate::transport::peer_info::{PeerInfo, PeerType};

pub struct UnixListenerStream {
    inner: tokio::net::UnixListener,
}

impl UnixListenerStream {
    fn new(listener: tokio::net::UnixListener) -> Self {
        Self { inner: listener }
    }

    /// Start listening on the given Unix socket path.
    /// This will return only once the lister stops. Returning will attempt to clean up the socket file.
    pub async fn listen(
        ssh_path: String,
        agent: BitwardenDesktopAgent,
    ) -> Result<(), anyhow::Error> {
        info!(socket = %ssh_path, "Starting SSH Unix listener");

        // Remove existing socket file if it exists
        let socket_path = std::path::Path::new(&ssh_path);
        if let Err(e) = std::fs::remove_file(socket_path) {
            error!(error = %e, socket = %ssh_path, "Could not remove existing socket file");
            if e.kind() != std::io::ErrorKind::NotFound {
                return Err(anyhow::Error::new(e));
            }
        }

        match UnixListener::bind(socket_path) {
            Ok(listener) => {
                // Only the current user should be able to access the socket
                if let Err(e) = fs::set_permissions(socket_path, fs::Permissions::from_mode(0o600))
                {
                    error!(error = %e, socket = ?socket_path, "Could not set socket permissions");
                    return Err(anyhow::Error::new(e));
                }

                let stream = Self::new(listener);
                agent.serve(stream).await;
            }
            Err(e) => {
                error!(error = %e, socket = %ssh_path, "Unable to start start agent server");
            }
        }

        let _ = std::fs::remove_file(socket_path);
        info!(socket = %ssh_path, "SSH Unix listener stopped");

        Ok(())
    }
}

impl Stream for UnixListenerStream {
    type Item = io::Result<(UnixStream, PeerInfo)>;

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<io::Result<(UnixStream, PeerInfo)>>> {
        match self.inner.poll_accept(cx) {
            Poll::Ready(Ok((stream, _))) => {
                let pid = stream
                    .peer_cred()
                    .ok()
                    .and_then(|peer| peer.pid().and_then(|pid| u32::try_from(pid).ok()));

                let peer_info = match pid {
                    Some(pid) => PeerInfo::new(pid, PeerType::UnixSocket),
                    None => PeerInfo::unknown(PeerType::UnixSocket),
                };

                Poll::Ready(Some(Ok((stream, peer_info))))
            }
            Poll::Ready(Err(err)) => Poll::Ready(Some(Err(err))),
            Poll::Pending => Poll::Pending,
        }
    }
}

impl AsRef<tokio::net::UnixListener> for UnixListenerStream {
    fn as_ref(&self) -> &tokio::net::UnixListener {
        &self.inner
    }
}

impl AsMut<tokio::net::UnixListener> for UnixListenerStream {
    fn as_mut(&mut self) -> &mut tokio::net::UnixListener {
        &mut self.inner
    }
}
