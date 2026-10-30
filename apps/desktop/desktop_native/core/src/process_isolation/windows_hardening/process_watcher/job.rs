//! Event source: a job object that reports when main's direct children start and end.
//!
//! Main joins the job; every process it creates joins it too, as do their children, and
//! Windows posts a message to the job's I/O completion port for each start and exit.
//! Chromium's sandboxed processes sit in their own jobs nested inside this one, which
//! still reports them. Only main's direct children are passed on: Chromium starts all its
//! helper processes from main, so deeper descendants aren't Chromium's. Messages arrive in
//! order, so an exit is always reported before a new process that reuses its PID.
//!
//! Delivery of these messages is not guaranteed by Windows: a lost message means a child
//! is not reported.
//! Ref: <https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port>

use std::thread;

use anyhow::Result;
use tracing::warn;
use windows::{
    core::{Owned, PCWSTR},
    Win32::{
        Foundation::{HANDLE, INVALID_HANDLE_VALUE},
        System::{
            JobObjects::{
                AssignProcessToJobObject, CreateJobObjectW,
                JobObjectAssociateCompletionPortInformation, JobObjectExtendedLimitInformation,
                SetInformationJobObject, JOBOBJECTINFOCLASS, JOBOBJECT_ASSOCIATE_COMPLETION_PORT,
                JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JOB_OBJECT_LIMIT_BREAKAWAY_OK,
            },
            SystemServices::{
                JOB_OBJECT_MSG_ABNORMAL_EXIT_PROCESS, JOB_OBJECT_MSG_EXIT_PROCESS,
                JOB_OBJECT_MSG_NEW_PROCESS,
            },
            Threading::{INFINITE, PROCESS_QUERY_LIMITED_INFORMATION},
            IO::{CreateIoCompletionPort, GetQueuedCompletionStatus, OVERLAPPED},
        },
    },
};

use super::{
    super::process::{Pid, Process},
    emitter::Emitter,
    polling,
};

/// The job main belongs to and the port its messages arrive on.
struct JobWatch {
    /// Kept open so the job, and with it the port association, lives as long as the watch.
    _job: Owned<HANDLE>,
    port: Owned<HANDLE>,
}

// SAFETY: A kernel handle is valid on every thread of the process, and `JobWatch` only
// passes its handles to thread-safe Win32 calls. It is moved to the watch thread, never
// shared.
// Ref: https://learn.microsoft.com/en-us/windows/win32/sysinfo/kernel-objects
unsafe impl Send for JobWatch {}

/// One message from the job.
enum Message {
    NewProcess(Pid),
    ExitProcess(Pid),
    Other,
    /// The completion port failed; no further messages will arrive.
    Failed(windows::core::Error),
}

/// Puts main in a new job and reports its children on a background thread. Returns the
/// emitter on failure, so the caller can fall back to polling.
pub(super) fn start(emitter: Emitter) -> Result<(), (anyhow::Error, Emitter)> {
    let watch = match JobWatch::create() {
        Ok(watch) => watch,
        Err(e) => return Err((e, emitter)),
    };

    thread::spawn(move || watch.run(emitter));
    Ok(())
}

impl JobWatch {
    /// Creates the job and its completion port, then puts main in it.
    fn create() -> Result<Self> {
        // SAFETY: Plain FFI call; no security attributes and no name.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-createjobobjectw
        let raw = unsafe { CreateJobObjectW(None, PCWSTR::null())? };
        // SAFETY: `raw` is a fresh, valid job handle owned by nobody else.
        // The job must be closed with CloseHandle; dropping `Owned` does that.
        let job = unsafe { Owned::new(raw) };

        // SAFETY: Plain FFI call; INVALID_HANDLE_VALUE creates a port without a file.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-createiocompletionport
        let raw = unsafe { CreateIoCompletionPort(INVALID_HANDLE_VALUE, None, 0, 1)? };
        // SAFETY: `raw` is a fresh, valid port handle owned by nobody else.
        // The port must be closed with CloseHandle; dropping `Owned` does that.
        let port = unsafe { Owned::new(raw) };

        // A job without limits makes CreateProcess fail for callers that ask to break away
        // (CREATE_BREAKAWAY_FROM_JOB). Allow it, so programs main launches behave as before.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information
        let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_BREAKAWAY_OK;
        set_information(&job, JobObjectExtendedLimitInformation, &limits)?;

        // Associate the port while the job is still empty: messages for processes that
        // change state during association can be lost.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port
        let association = JOBOBJECT_ASSOCIATE_COMPLETION_PORT {
            CompletionKey: std::ptr::null_mut(),
            CompletionPort: *port,
        };
        set_information(
            &job,
            JobObjectAssociateCompletionPortInformation,
            &association,
        )?;

        // SAFETY: Both handles are valid; the pseudo handle carries full access.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-assignprocesstojobobject
        unsafe { AssignProcessToJobObject(*job, Process::current().handle())? };

        Ok(Self { _job: job, port })
    }

    /// Reports children until the receiver is dropped. Falls back to polling if the port
    /// fails.
    fn run(self, mut emitter: Emitter) {
        let main = Process::current();

        // Children started before main joined the job are never reported by it.
        match main.child_pids() {
            Ok(pids) => {
                for pid in pids {
                    if emitter.added(pid).is_err() {
                        return;
                    }
                }
            }
            Err(e) => warn!("Failed to list child processes that predate the job: {e}"),
        }

        loop {
            let emitted = match self.next() {
                // Also drops main itself, which the job reports when it joins.
                Message::NewProcess(pid) if !is_child(&main, pid) => Ok(()),
                Message::NewProcess(pid) => emitter.added(pid),
                Message::ExitProcess(pid) => emitter.removed(pid),
                Message::Other => Ok(()),
                Message::Failed(e) => {
                    warn!("Job messages failed, polling for child processes instead: {e}");
                    return polling::run(emitter);
                }
            };

            if emitted.is_err() {
                return;
            }
        }
    }

    /// Blocks until the next message.
    fn next(&self) -> Message {
        let mut message = 0u32;
        let mut key = 0usize;
        let mut overlapped: *mut OVERLAPPED = std::ptr::null_mut();

        // SAFETY: All three out pointers are valid locals.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-getqueuedcompletionstatus
        let result = unsafe {
            GetQueuedCompletionStatus(
                *self.port,
                &mut message,
                &mut key,
                &mut overlapped,
                INFINITE,
            )
        };
        if let Err(e) = result {
            return Message::Failed(e);
        }

        // For process messages, `lpOverlapped` carries the PID, not a pointer.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_associate_completion_port
        let pid = Pid::from(overlapped as usize as u32);
        match message {
            JOB_OBJECT_MSG_NEW_PROCESS => Message::NewProcess(pid),
            JOB_OBJECT_MSG_EXIT_PROCESS | JOB_OBJECT_MSG_ABNORMAL_EXIT_PROCESS => {
                Message::ExitProcess(pid)
            }
            _ => Message::Other,
        }
    }
}

/// Whether `pid` is a direct child of `main`. The message carries only the PID, so this
/// asks the process for its parent.
fn is_child(main: &Process, pid: Pid) -> bool {
    // Exited already if it can't be opened; the emitter would skip it anyway.
    let Ok(process) = Process::open(pid, PROCESS_QUERY_LIMITED_INFORMATION) else {
        return false;
    };

    match process.parent_pid() {
        Ok(parent) => parent == main.pid(),
        Err(e) => {
            warn!(%pid, "Failed to read the parent of a new process: {e}");
            false
        }
    }
}

fn set_information<T>(job: &Owned<HANDLE>, class: JOBOBJECTINFOCLASS, info: &T) -> Result<()> {
    // SAFETY: `info` points to a valid `T` of the size passed, matching `class` at
    // every call site.
    // Ref: https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-setinformationjobobject
    unsafe {
        SetInformationJobObject(
            **job,
            class,
            std::ptr::from_ref(info).cast(),
            size_of::<T>() as u32,
        )?
    };
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::{
        process::Command,
        sync::mpsc,
        time::{Duration, Instant},
    };

    use super::{super::ProcessEvent, *};

    /// Waits up to a few seconds for `expected` on `receiver`, skipping other events.
    fn wait_for(receiver: &mpsc::Receiver<ProcessEvent>, expected: ProcessEvent) -> bool {
        let deadline = Instant::now() + Duration::from_secs(10);
        while let Some(remaining) = deadline.checked_duration_since(Instant::now()) {
            match receiver.recv_timeout(remaining) {
                Ok(event) if event == expected => return true,
                Ok(_) => {}
                Err(_) => return false,
            }
        }
        false
    }

    #[test]
    fn job_reports_child_start_and_exit() {
        let (sender, receiver) = mpsc::channel();
        let main = Pid::from(std::process::id());
        if let Err((e, _)) = start(Emitter::new(sender, main)) {
            panic!("start: {e}");
        }

        let mut child = Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .spawn()
            .expect("spawn ping");
        let pid = Pid::from(child.id());
        let added = wait_for(&receiver, ProcessEvent::Added(pid));

        let _ = child.kill();
        let _ = child.wait();
        let removed = wait_for(&receiver, ProcessEvent::Removed(pid));

        assert!(added, "the job must report the new child");
        assert!(removed, "the job must report the child's exit");
    }
}
