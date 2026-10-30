//! Reports the main process and its direct child processes as a channel of events.
//!
//! Chromium starts the renderer, GPU and network processes lazily and restarts them after
//! crashes, and the app may open further renderer processes for dialogs separate from the
//! main renderer, so the hardening has to learn about each new child as it appears.
//! Callers only see `Added` and `Removed` PIDs, starting with `Added` for main itself, so
//! they can treat every process the same way. Only direct children are reported: Chromium
//! starts all its helper processes (renderer, GPU, utility, crashpad) from main itself.
//! Where children are found is hidden here: a job object that Windows notifies on every new
//! process or, if the job can't be set up or fails, a poll of the process snapshot every
//! `POLL_INTERVAL`.
//!
//! ```text
//! watch ─┬─ main, first
//!        ├─ job:     job messages, plus one snapshot of children that predate the job
//!        └─ polling: snapshot every POLL_INTERVAL (if the job is unavailable)
//!               │
//!         Emitter: one map of emitted processes, deduplicates
//!               │
//!         std mpsc channel -> Receiver<ProcessEvent>
//! ```
//!
//! Both sources report through one `Emitter`, which deduplicates across them: every
//! process is emitted once as `Added` and once as `Removed`, and a PID reused by a new
//! process is `Removed` before it is `Added` again.

mod emitter;
mod job;
mod polling;

use std::{sync::mpsc, time::Duration};

use tracing::warn;

use self::emitter::Emitter;
use super::process::{Pid, Process};

/// How often the polling source takes a process snapshot.
const POLL_INTERVAL: Duration = Duration::from_secs(1);

/// Something that happened to the main process or one of its child processes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum ProcessEvent {
    /// The process with this PID started, or existed when watching began. The first event
    /// is always main itself.
    Added(Pid),
    /// The child process with this PID exited.
    Removed(Pid),
}

/// Where a source sends its events.
type Sender = mpsc::Sender<ProcessEvent>;

/// Starts watching main's child processes on a background thread and returns their events,
/// preceded by `Added` for main.
///
/// Uses the job object if it can be set up, polling otherwise. Call once per process: every
/// call starts another watcher. The watcher stops once the receiver is dropped.
pub(super) fn watch() -> mpsc::Receiver<ProcessEvent> {
    let (sender, receiver) = mpsc::channel();
    let main = Process::current();
    let mut emitter = Emitter::new(sender, main.pid());

    // Emitted before any source starts, so it is always first. The receiver is still held
    // here, so this can't fail.
    let _ = emitter.added_process(&main);

    if let Err((e, emitter)) = job::start(emitter) {
        warn!("Failed to watch child processes via job object, polling instead: {e}");
        polling::start(emitter);
    }

    receiver
}
