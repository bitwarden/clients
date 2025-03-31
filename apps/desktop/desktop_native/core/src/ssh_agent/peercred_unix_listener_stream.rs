use futures::Stream;
use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::net::{UnixListener, UnixStream};

use super::peerinfo;
use super::peerinfo::models::PeerInfo;

#[derive(Debug)]
pub struct PeercredUnixListenerStream {
    inner: UnixListener,
}

impl PeercredUnixListenerStream {
    pub fn new(listener: UnixListener) -> Self {
        Self { inner: listener }
    }
}

impl Stream for PeercredUnixListenerStream {
    type Item = io::Result<(UnixStream, PeerInfo)>;

    fn poll_next(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<io::Result<(UnixStream, PeerInfo)>>> {
        match self.inner.poll_accept(cx) {
            Poll::Ready(Ok((stream, _))) => {
                let pid = match stream.peer_cred() {
                    Ok(peer) => match peer.pid() {
                        Some(pid) => pid,
                        None => {
                            return Poll::Ready(Some(Ok((stream, PeerInfo::unknown()))));
                        }
                    },
                    Err(_) => return Poll::Ready(Some(Ok((stream, PeerInfo::unknown())))),
                };
                let peer_info = peerinfo::gather::get_peer_info(pid as u32);
                match peer_info {
                    Ok(info) => Poll::Ready(Some(Ok((stream, info)))),
                    Err(_) => Poll::Ready(Some(Ok((stream, PeerInfo::unknown())))),
                }
            }
            Poll::Ready(Err(err)) => Poll::Ready(Some(Err(err))),
            Poll::Pending => Poll::Pending,
        }
    }
}

impl AsRef<UnixListener> for PeercredUnixListenerStream {
    fn as_ref(&self) -> &UnixListener {
        &self.inner
    }
}

impl AsMut<UnixListener> for PeercredUnixListenerStream {
    fn as_mut(&mut self) -> &mut UnixListener {
        &mut self.inner
    }
}
