//! Fallback event source: polls main's direct children every `POLL_INTERVAL`.
//!
//! Used when the job object can't be set up or stops delivering messages. Each poll reports
//! every child as added and every emitted process that no longer runs as removed; the
//! emitter drops what it already sent, so only changes reach the stream.

use std::thread;

use tracing::{info, warn};

use super::{
    super::process::Process,
    emitter::{Closed, Emitter},
    POLL_INTERVAL,
};

/// Polls on a new background thread.
pub(super) fn start(emitter: Emitter) {
    thread::spawn(move || run(emitter));
}

/// Polls on the current thread until the receiver is dropped.
pub(super) fn run(mut emitter: Emitter) {
    let main = Process::current();
    let mut snapshotting_state = SnapshottingState::Healthy;

    loop {
        if poll(&main, &mut emitter, &mut snapshotting_state).is_err() {
            return;
        }

        thread::sleep(POLL_INTERVAL);
    }
}

fn poll(
    main: &Process,
    emitter: &mut Emitter,
    snapshotting_state: &mut SnapshottingState,
) -> Result<(), Closed> {
    match main.child_pids() {
        Ok(pids) => {
            snapshotting_state.report_success();
            for pid in pids {
                emitter.added(pid)?;
            }
        }
        Err(e) => snapshotting_state.report_failing(&e),
    }

    emitter.removed_exited()
}

/// Health of the process snapshot. Logs only on transitions, not every poll.
#[derive(Clone, Copy, PartialEq, Eq)]
enum SnapshottingState {
    Healthy,
    Failing,
}

impl SnapshottingState {
    fn report_failing(&mut self, error: &anyhow::Error) {
        if *self == Self::Healthy {
            warn!("Failed to list child processes: {error}");
        }
        *self = Self::Failing;
    }

    fn report_success(&mut self) {
        if *self == Self::Failing {
            info!("Listing child processes works again.");
        }
        *self = Self::Healthy;
    }
}
