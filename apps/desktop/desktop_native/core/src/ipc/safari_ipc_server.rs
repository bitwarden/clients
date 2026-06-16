//! Buffered IPC server for the Safari web extension.
//!
//! Safari's native component (`SafariWebExtensionHandler`) is a stateless, per-request handler with
//! no long-lived process, so the desktop app cannot push messages to it. Instead, this server
//! buffers messages destined for the extension and lets the extension drain them by polling.
//!
//! The transport is an app-group XPC Mach service (vended by [`desktop_objc::SafariXpcListener`]).
//! It only works when the desktop app is sandboxed (the Mac App Store build), which is the only
//! build that ships the Safari extension. Each request is a JSON [`Request`] carried in the XPC
//! message's `req` field, and the JSON response is returned in the reply's `res` field:
//! - `{"op":"send","payload":"..."}` forwards an extension -> desktop payload to the consumer
//!   channel and replies `{"ok":true}`.
//! - `{"op":"receive"}` drains the outbound (desktop -> extension) queue and replies
//!   `{"messages":[...]}`.

use std::{
    collections::VecDeque,
    error::Error,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use desktop_objc::SafariXpcListener;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tracing::error;

/// The application group identifier shared between the desktop app, the `desktop_proxy`, and the
/// Safari web extension. Used as the prefix for the app-group XPC Mach service that a sandboxed
/// Safari extension can reach.
pub const APP_GROUP_ID: &str = "LTZ2PFU5D6.com.bitwarden.desktop";

/// Name of the app-group XPC Mach service the Safari extension connects to. Must be prefixed with
/// [`APP_GROUP_ID`] and match the Safari extension's `XpcClient.serviceName`.
const SERVICE_NAME: &str = "LTZ2PFU5D6.com.bitwarden.desktop.safari";

/// The maximum number of outbound (desktop → extension) messages buffered while the extension is
/// not polling (e.g. its service worker has been terminated). Past this, the oldest messages are
/// dropped. The SDK IPC layer provides its own retry/timeout semantics, so occasional loss of a
/// stale message is tolerable.
const OUTBOUND_QUEUE_CAPACITY: usize = 128;

/// How long an outbound message stays in the buffer before it is considered stale and evicted.
const OUTBOUND_TTL: Duration = Duration::from_secs(60);

/// A request issued by the Safari extension over the XPC connection.
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
        self.messages
            .drain(..)
            .map(|(_, payload)| payload)
            .collect()
    }
}

type Outbound = Arc<Mutex<OutboundQueue>>;

/// Buffered IPC server that the Safari web extension polls over app-group XPC.
pub struct SafariIpcServer {
    outbound: Outbound,
    /// The XPC listener. Dropping it cancels the Mach service; held in an `Option` so [`stop`] can
    /// release it eagerly (otherwise a subsequent `start` could not re-register the same Mach
    /// service name).
    listener: Mutex<Option<SafariXpcListener>>,
}

impl SafariIpcServer {
    /// Create and start the buffered XPC server without blocking.
    ///
    /// The listener registers an app-group Mach service so the sandboxed Safari web extension can
    /// reach it.
    pub fn start(inbound_send: mpsc::UnboundedSender<String>) -> Result<Self, Box<dyn Error>> {
        let outbound: Outbound = Arc::new(Mutex::new(OutboundQueue::new(
            OUTBOUND_QUEUE_CAPACITY,
            OUTBOUND_TTL,
        )));

        let outbound_cb = outbound.clone();
        let listener = SafariXpcListener::start(
            SERVICE_NAME,
            Box::new(move |bytes: &[u8]| handle_request(bytes, &inbound_send, &outbound_cb)),
        )?;

        Ok(SafariIpcServer {
            outbound,
            listener: Mutex::new(Some(listener)),
        })
    }

    /// Buffer a desktop → extension message to be delivered on the next `receive` poll.
    pub fn enqueue(&self, message: String) {
        let mut queue = self.outbound.lock().expect("outbound mutex poisoned");
        queue.push(message, Instant::now());
    }

    /// Stop the buffered XPC server, cancelling the Mach service.
    pub fn stop(&self) {
        // Dropping the listener cancels the Mach service.
        *self.listener.lock().expect("listener mutex poisoned") = None;
    }
}

/// Handle a single Safari request. Runs synchronously on the XPC listener's dispatch queue.
fn handle_request(
    bytes: &[u8],
    inbound_send: &mpsc::UnboundedSender<String>,
    outbound: &Outbound,
) -> Vec<u8> {
    match serde_json::from_slice::<Request>(bytes) {
        Ok(Request::Send { payload }) => {
            // Best-effort forward to the desktop. Failure means the consumer is gone.
            let ok = inbound_send.send(payload).is_ok();
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

    #[test]
    fn handle_request_send_forwards_payload_and_acks() {
        let (tx, mut rx) = mpsc::unbounded_channel::<String>();
        let outbound: Outbound = Arc::new(Mutex::new(OutboundQueue::new(8, OUTBOUND_TTL)));

        let response = handle_request(br#"{"op":"send","payload":"hello"}"#, &tx, &outbound);

        assert_eq!(response, br#"{"ok":true}"#);
        assert_eq!(rx.try_recv().unwrap(), "hello".to_string());
    }

    #[test]
    fn handle_request_receive_drains_buffered_messages() {
        let (tx, _rx) = mpsc::unbounded_channel::<String>();
        let outbound: Outbound = Arc::new(Mutex::new(OutboundQueue::new(8, OUTBOUND_TTL)));
        {
            let mut q = outbound.lock().unwrap();
            q.push("one".into(), Instant::now());
            q.push("two".into(), Instant::now());
        }

        let response = handle_request(br#"{"op":"receive"}"#, &tx, &outbound);

        assert_eq!(response, br#"{"messages":["one","two"]}"#);
        // The queue is emptied by the drain.
        assert!(outbound.lock().unwrap().drain(Instant::now()).is_empty());
    }

    #[test]
    fn handle_request_rejects_malformed_input() {
        let (tx, _rx) = mpsc::unbounded_channel::<String>();
        let outbound: Outbound = Arc::new(Mutex::new(OutboundQueue::new(8, OUTBOUND_TTL)));

        // Both invalid JSON and an empty body (NULL request data) reply with ok=false.
        assert_eq!(
            handle_request(b"not json", &tx, &outbound),
            br#"{"ok":false}"#
        );
        assert_eq!(handle_request(b"", &tx, &outbound), br#"{"ok":false}"#);
    }
}
