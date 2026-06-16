//! Buffered IPC server for the Safari web extension.
//!
//! Safari's native component (`SafariWebExtensionHandler`) is a stateless, per-request handler with
//! no long-lived process, so the desktop app cannot push messages to it. Instead, this server
//! buffers messages destined for the extension and lets the extension drain them by polling.
//!
//! Connections are short-lived. Each frame is a JSON [`Request`]:
//! - `{"op":"send","payload":"..."}` forwards an extension → desktop payload to the consumer
//!   channel and replies `{"ok":true}`.
//! - `{"op":"receive"}` drains the outbound (desktop → extension) queue and replies
//!   `{"messages":[...]}`.
//!
//! Payloads are opaque, end-to-end encrypted by the SDK IPC layer; this server never inspects them.

use std::{
    collections::VecDeque,
    error::Error,
    path::PathBuf,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use anyhow::Result;
use futures::{SinkExt, StreamExt, TryFutureExt};
use interprocess::local_socket::{tokio::prelude::*, GenericFilePath, ListenerOptions};
use serde::{Deserialize, Serialize};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    sync::mpsc,
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

/// The maximum number of outbound (desktop → extension) messages buffered while the extension is
/// not polling (e.g. its service worker has been terminated). Past this, the oldest messages are
/// dropped. The SDK IPC layer provides its own retry/timeout semantics, so occasional loss of a
/// stale message is tolerable.
const OUTBOUND_QUEUE_CAPACITY: usize = 128;

/// How long an outbound message stays in the buffer before it is considered stale and evicted.
const OUTBOUND_TTL: Duration = Duration::from_secs(60);

/// A request issued by the Safari extension over a buffered-server connection.
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "lowercase")]
enum Request {
    /// Forward an extension → desktop payload to the desktop.
    Send { payload: String },
    /// Drain and return all currently buffered desktop → extension messages.
    Receive,
}

/// Reply to a [`Request::Send`].
#[derive(Debug, Serialize)]
struct SendResponse {
    ok: bool,
}

/// Reply to a [`Request::Receive`].
#[derive(Debug, Serialize)]
struct ReceiveResponse {
    messages: Vec<String>,
}

/// A bounded, TTL-evicting FIFO queue of outbound payloads.
///
/// Kept as a plain synchronous struct so it can be unit tested without a runtime. Time is passed in
/// explicitly (`now`) so eviction can be tested deterministically.
struct OutboundQueue {
    messages: VecDeque<(Instant, String)>,
    capacity: usize,
    ttl: Duration,
}

impl OutboundQueue {
    fn new(capacity: usize, ttl: Duration) -> Self {
        Self {
            messages: VecDeque::new(),
            capacity,
            ttl,
        }
    }

    /// Evict messages older than the TTL. Messages are stored in FIFO order, so the oldest are at
    /// the front.
    fn evict_expired(&mut self, now: Instant) {
        while let Some((enqueued_at, _)) = self.messages.front() {
            if now.duration_since(*enqueued_at) >= self.ttl {
                self.messages.pop_front();
            } else {
                break;
            }
        }
    }

    fn push(&mut self, payload: String, now: Instant) {
        self.evict_expired(now);
        // Bounded queue: drop the oldest message to make room.
        if self.messages.len() >= self.capacity {
            self.messages.pop_front();
        }
        self.messages.push_back((now, payload));
    }

    fn drain(&mut self, now: Instant) -> Vec<String> {
        self.evict_expired(now);
        self.messages.drain(..).map(|(_, payload)| payload).collect()
    }
}

type Outbound = Arc<Mutex<OutboundQueue>>;

/// Buffered IPC server that the Safari web extension polls.
pub struct BufferedServer {
    /// The paths that the server is listening on.
    pub paths: Vec<PathBuf>,
    cancel_token: CancellationToken,
    outbound: Outbound,
}

impl BufferedServer {
    /// Create and start the buffered IPC server without blocking.
    ///
    /// # Parameters
    ///
    /// - `paths`: The socket paths to listen on.
    /// - `inbound_send`: Each extension → desktop payload received over a `send` request is
    ///   forwarded to this channel.
    pub fn start(
        paths: Vec<PathBuf>,
        inbound_send: mpsc::Sender<String>,
    ) -> Result<Self, Box<dyn Error>> {
        let cancel_token = CancellationToken::new();
        let outbound: Outbound = Arc::new(Mutex::new(OutboundQueue::new(
            OUTBOUND_QUEUE_CAPACITY,
            OUTBOUND_TTL,
        )));

        for path in paths.iter() {
            // If the unix socket file already exists, we get an error when trying to bind to it, so
            // we remove it first.
            if !cfg!(windows) && path.exists() {
                info!("Removing existing buffered IPC socket at: {}", path.display());
                std::fs::remove_file(path)?;
            }

            let name = path.as_os_str().to_fs_name::<GenericFilePath>()?;
            let opts = ListenerOptions::new().name(name);
            let Ok(listener) = opts.create_tokio() else {
                info!(
                    "Failed to create buffered IPC listener for path: {}",
                    path.display()
                );
                continue;
            };
            info!("Buffered IPC server bound and listening at: {}", path.display());

            tokio::spawn(listen_incoming(
                listener,
                inbound_send.clone(),
                outbound.clone(),
                cancel_token.clone(),
            ));
        }

        Ok(BufferedServer {
            paths,
            cancel_token,
            outbound,
        })
    }

    /// Buffer a desktop → extension message to be delivered on the next `receive` poll.
    pub fn enqueue(&self, message: String) {
        let mut queue = self.outbound.lock().expect("outbound mutex poisoned");
        queue.push(message, Instant::now());
    }

    /// Stop the buffered IPC server.
    pub fn stop(&self) {
        self.cancel_token.cancel();
    }
}

impl Drop for BufferedServer {
    fn drop(&mut self) {
        self.stop();
    }
}

async fn listen_incoming(
    listener: LocalSocketListener,
    inbound_send: mpsc::Sender<String>,
    outbound: Outbound,
    cancel_token: CancellationToken,
) {
    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                info!("Buffered IPC server cancelled.");
                break;
            },

            msg = listener.accept() => {
                println!("Received buffered IPC connection");
                match msg {
                    Ok(client_stream) => {
                        let future = handle_connection(
                            client_stream,
                            inbound_send.clone(),
                            outbound.clone(),
                            cancel_token.clone(),
                        );
                        tokio::spawn(future.map_err(|e| {
                            error!(error = %e, "Error handling buffered connection")
                        }));
                    },
                    Err(e) => {
                        error!(error = %e, "Error accepting buffered connection");
                        break;
                    },
                }
            }
        }
    }
}

async fn handle_connection(
    client_stream: impl AsyncRead + AsyncWrite + Unpin,
    inbound_send: mpsc::Sender<String>,
    outbound: Outbound,
    cancel_token: CancellationToken,
) -> Result<(), Box<dyn Error>> {
    let mut framed = crate::ipc::internal_ipc_codec(client_stream);

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => break,

            result = framed.next() => {
                match result {
                    None => break, // Client disconnected.
                    Some(Err(e)) => {
                        error!(error = %e, "Error reading from Safari client");
                        break;
                    },
                    Some(Ok(bytes)) => {
                        let response = handle_request(&bytes, &inbound_send, &outbound).await;
                        framed.send(response.into()).await?;
                    },
                }
            }
        }
    }

    Ok(())
}

async fn handle_request(
    bytes: &[u8],
    inbound_send: &mpsc::Sender<String>,
    outbound: &Outbound,
) -> Vec<u8> {
    match serde_json::from_slice::<Request>(bytes) {
        Ok(Request::Send { payload }) => {
            // Best-effort forward to the desktop. Failure means the consumer is gone.
            let ok = inbound_send.send(payload).await.is_ok();
            serde_json::to_vec(&SendResponse { ok }).unwrap_or_default()
        }
        Ok(Request::Receive) => {
            let messages = {
                let mut queue = outbound.lock().expect("outbound mutex poisoned");
                queue.drain(Instant::now())
            };
            serde_json::to_vec(&ReceiveResponse { messages }).unwrap_or_default()
        }
        Err(e) => {
            error!(error = %e, "Invalid Safari IPC request");
            serde_json::to_vec(&SendResponse { ok: false }).unwrap_or_default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn queue() -> OutboundQueue {
        OutboundQueue::new(3, Duration::from_secs(60))
    }

    #[test]
    fn drain_returns_messages_in_fifo_order_and_empties_the_queue() {
        let mut q = queue();
        let now = Instant::now();
        q.push("a".into(), now);
        q.push("b".into(), now);

        assert_eq!(q.drain(now), vec!["a".to_string(), "b".to_string()]);
        // Draining empties the queue.
        assert!(q.drain(now).is_empty());
    }

    #[test]
    fn push_beyond_capacity_drops_the_oldest_message() {
        let mut q = queue();
        let now = Instant::now();
        q.push("a".into(), now);
        q.push("b".into(), now);
        q.push("c".into(), now);
        q.push("d".into(), now); // Capacity is 3, so "a" is dropped.

        assert_eq!(
            q.drain(now),
            vec!["b".to_string(), "c".to_string(), "d".to_string()]
        );
    }

    #[test]
    fn drain_evicts_messages_older_than_the_ttl() {
        let mut q = OutboundQueue::new(10, Duration::from_secs(60));
        let start = Instant::now();
        q.push("stale".into(), start);

        let later = start + Duration::from_secs(61);
        q.push("fresh".into(), later);

        // "stale" is evicted on access; only "fresh" remains.
        assert_eq!(q.drain(later), vec!["fresh".to_string()]);
    }

    #[test]
    fn push_evicts_expired_before_enforcing_capacity() {
        let mut q = OutboundQueue::new(2, Duration::from_secs(60));
        let start = Instant::now();
        q.push("old".into(), start);

        let later = start + Duration::from_secs(61);
        q.push("a".into(), later);
        q.push("b".into(), later);

        // "old" expired and was evicted, so "a" and "b" both fit without dropping.
        assert_eq!(q.drain(later), vec!["a".to_string(), "b".to_string()]);
    }
}
