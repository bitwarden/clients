//! Deduplicates what the sources observe, so each process is emitted exactly once as
//! `Added` and once as `Removed`.
//!
//! The sources overlap: the job's initial snapshot can report a child its messages also
//! report, the job reports main itself when it joins, and polling, after a job failure,
//! sees children the job already reported. The emitter keeps one map of every process it
//! emitted, keyed by PID with its creation time, and records each change in the map before
//! sending the event.

use std::collections::HashMap;

use tracing::warn;
use windows::Win32::System::Threading::PROCESS_QUERY_LIMITED_INFORMATION;

use super::{
    super::process::{CreationTime, Pid, Process},
    ProcessEvent, Sender,
};

/// The receiver was dropped; the source should stop.
pub(super) struct Closed;

/// Sends each process's `Added` and `Removed` once, whichever source reports it.
pub(super) struct Emitter {
    sender: Sender,
    /// Every process emitted as `Added` and not yet as `Removed`.
    emitted: HashMap<Pid, CreationTime>,
    /// Never reported as `Removed`: it outlives every watcher.
    main: Pid,
}

impl Emitter {
    pub(super) fn new(sender: Sender, main: Pid) -> Self {
        Self {
            sender,
            emitted: HashMap::new(),
            main,
        }
    }

    /// Reports `pid` as running, unless it was already emitted. A process that can't be
    /// opened has exited already and is not reported.
    pub(super) fn added(&mut self, pid: Pid) -> Result<(), Closed> {
        let Ok(process) = Process::open(pid, PROCESS_QUERY_LIMITED_INFORMATION) else {
            return Ok(());
        };

        self.added_process(&process)
    }

    /// Like `added`, for a process that is already open, e.g. main.
    pub(super) fn added_process(&mut self, process: &Process) -> Result<(), Closed> {
        match process.creation_time() {
            Ok(start) => self.added_at(process.pid(), start),
            Err(e) => {
                warn!(pid = %process.pid(), "Failed to read process creation time: {e}");
                Ok(())
            }
        }
    }

    /// Reports `pid` as exited, unless it wasn't emitted or was already removed.
    pub(super) fn removed(&mut self, pid: Pid) -> Result<(), Closed> {
        if self.emitted.remove(&pid).is_none() {
            return Ok(());
        }

        self.send(ProcessEvent::Removed(pid))
    }

    /// Reports every emitted process, except main, that no longer runs. A PID counts as
    /// running only if its process still has the creation time that was emitted.
    pub(super) fn removed_exited(&mut self) -> Result<(), Closed> {
        let exited: Vec<Pid> = self
            .emitted
            .iter()
            .filter(|&(&pid, &start)| pid != self.main && !is_running(pid, start))
            .map(|(&pid, _)| pid)
            .collect();

        for pid in exited {
            self.removed(pid)?;
        }

        Ok(())
    }

    fn added_at(&mut self, pid: Pid, start: CreationTime) -> Result<(), Closed> {
        match self.emitted.get(&pid) {
            Some(&emitted) if emitted == start => return Ok(()),
            // Same PID, new process: the old one's exit was missed. Remove it first.
            Some(_) => self.removed(pid)?,
            None => {}
        }

        self.emitted.insert(pid, start);
        self.send(ProcessEvent::Added(pid))
    }

    fn send(&self, event: ProcessEvent) -> Result<(), Closed> {
        self.sender.send(event).map_err(|_| Closed)
    }
}

fn is_running(pid: Pid, start: CreationTime) -> bool {
    Process::open(pid, PROCESS_QUERY_LIMITED_INFORMATION)
        .ok()
        .and_then(|process| process.creation_time().ok())
        == Some(start)
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;

    use super::*;

    fn emitter() -> (Emitter, mpsc::Receiver<ProcessEvent>) {
        let (sender, receiver) = mpsc::channel();
        (Emitter::new(sender, Pid::from(0)), receiver)
    }

    fn drain(receiver: &mpsc::Receiver<ProcessEvent>) -> Vec<ProcessEvent> {
        std::iter::from_fn(|| receiver.try_recv().ok()).collect()
    }

    #[test]
    fn same_process_is_added_once() {
        let (mut emitter, receiver) = emitter();
        let _ = emitter.added_at(Pid::from(1), CreationTime::from(10));
        let _ = emitter.added_at(Pid::from(1), CreationTime::from(10));

        assert_eq!(drain(&receiver), vec![ProcessEvent::Added(Pid::from(1))]);
    }

    #[test]
    fn process_is_removed_once_and_only_if_added() {
        let (mut emitter, receiver) = emitter();
        let _ = emitter.removed(Pid::from(2));
        let _ = emitter.added_at(Pid::from(1), CreationTime::from(10));
        let _ = emitter.removed(Pid::from(1));
        let _ = emitter.removed(Pid::from(1));

        assert_eq!(
            drain(&receiver),
            vec![
                ProcessEvent::Added(Pid::from(1)),
                ProcessEvent::Removed(Pid::from(1)),
            ]
        );
    }

    #[test]
    fn reused_pid_is_removed_before_added_again() {
        let (mut emitter, receiver) = emitter();
        let _ = emitter.added_at(Pid::from(1), CreationTime::from(10));
        let _ = emitter.added_at(Pid::from(1), CreationTime::from(99));

        assert_eq!(
            drain(&receiver),
            vec![
                ProcessEvent::Added(Pid::from(1)),
                ProcessEvent::Removed(Pid::from(1)),
                ProcessEvent::Added(Pid::from(1)),
            ]
        );
    }
}
