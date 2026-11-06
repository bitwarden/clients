//! Hardens main and each of its child processes: the DACL, then the OWNER RIGHTS ACE.
//!
//! Windows decides who may open a process by its security descriptor. A DACL belongs to
//! one process object and children don't inherit it, so main and every child reported by
//! `process_watcher` are each hardened as they are added:
//!
//! ```text
//! Security descriptor of a process
//! ├─ Owner: S-1-5-21-…-1001 (the user)       <- implicit READ_CONTROL | WRITE_DAC
//! └─ DACL (discretionary access control list)
//!    ├─ ACE: Allow user          USER_RIGHTS  <- step 1 (`restricted`)
//!    ├─ ACE: Allow SYSTEM        ALL_ACCESS   <- step 1 (`restricted`)
//!    └─ ACE: Allow OWNER RIGHTS  USER_RIGHTS  <- step 2 (`ace`)
//! ```
//!
//! Step 1 removes the user's memory access; step 2 removes the owner's implicit right to
//! undo step 1. Both build on `acl`; `sid` provides who each ACE applies to.
//! Administrators with `SeDebugPrivilege` skip this check entirely, so elevated tools
//! (e.g. Task Manager on an admin account) can still dump the process.
//!
//! # How a child is recognised
//!
//! `process_watcher` reports only main's direct children. On top:
//! - Started after main, so a stale PID that was reused doesn't match.
//! - Runs main's executable, so a browser launched via `shell.openExternal` is left alone.
//!
//! The identity check and the DACL edit use one handle, so a reused PID can't slip in
//! between. `process_watcher` adds each process exactly once, so the hardener keeps no
//! state per child: a denied `WRITE_DAC` always means the child can't be hardened.

mod ace;
mod acl;
mod restricted;
mod sid;

use anyhow::{anyhow, Result};
use tracing::{info, warn};
use windows::Win32::{
    Foundation::ERROR_ACCESS_DENIED,
    System::Threading::{
        PROCESS_ACCESS_RIGHTS, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_READ_CONTROL,
        PROCESS_SYNCHRONIZE, PROCESS_TERMINATE, PROCESS_WRITE_DAC,
    },
};

use self::{ace::OwnerRightsAce, restricted::RestrictedDacl};
use super::{
    process::{CreationTime, ImagePath, Pid, Process},
    process_watcher::ProcessEvent,
};

/// Rights left to same-user processes: wait, terminate, basic query.
/// Excludes VM_READ/WRITE, DUP_HANDLE, CREATE_THREAD, READ_CONTROL, WRITE_DAC.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights>
const USER_RIGHTS: PROCESS_ACCESS_RIGHTS = PROCESS_ACCESS_RIGHTS(
    PROCESS_SYNCHRONIZE.0 | PROCESS_TERMINATE.0 | PROCESS_QUERY_LIMITED_INFORMATION.0,
);

/// Rights needed to check a child's identity and replace its DACL, on one handle.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights>
const EDIT_RIGHTS: PROCESS_ACCESS_RIGHTS = PROCESS_ACCESS_RIGHTS(
    PROCESS_QUERY_LIMITED_INFORMATION.0 | PROCESS_READ_CONTROL.0 | PROCESS_WRITE_DAC.0,
);

/// Acts on process events: hardens main and each child process as they are added.
///
/// Each child needs its own hardening: a new process gets a default DACL from its
/// creator's token, not a copy of its parent's DACL.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/procthread/process-security-and-access-rights>
pub(super) struct Hardener {
    restricted_dacl: RestrictedDacl,
    ace: OwnerRightsAce,
    /// What main is; used to recognise its children.
    main: MainProcess,
}

impl Hardener {
    pub(super) fn new() -> Result<Self> {
        Ok(Self {
            restricted_dacl: RestrictedDacl::new()?,
            ace: OwnerRightsAce::new()?,
            main: MainProcess::current()?,
        })
    }

    /// Acts on `events` on the current thread until they end.
    pub(super) fn run(self, events: impl IntoIterator<Item = ProcessEvent>) {
        for event in events {
            self.handle(event);
        }
    }

    fn handle(&self, event: ProcessEvent) {
        match event {
            ProcessEvent::Added(pid) => {
                if let Visit::Failed(error) = self.visit(pid) {
                    warn!(%pid, "Failed to isolate process: {error}");
                }
            }
            // An exited process needs nothing undone.
            ProcessEvent::Removed(_) => {}
        }
    }

    /// Opens `pid` once, decides what it is, and hardens it if needed.
    fn visit(&self, pid: Pid) -> Visit {
        if pid == self.main.pid {
            return self.visit_main();
        }

        // One handle for both the identity check and the DACL edit, so a reused PID
        // can't slip in between.
        let process = match Process::open(pid, EDIT_RIGHTS) {
            Ok(process) => process,
            Err(e) if e.code() == ERROR_ACCESS_DENIED.to_hresult() => {
                return self.visit_denied(pid)
            }
            // Exited since it was reported.
            Err(_) => return Visit::NotOurs,
        };

        if !self.main.is_child(&process) {
            return Visit::NotOurs;
        }

        info!(%pid, "Isolating child process with PID {} via DACL.", pid);
        match self.apply(&process) {
            Ok(()) => Visit::Hardened,
            Err(e) => Visit::Failed(e),
        }
    }

    /// Main needs no identity check, and its pseudo handle always carries full access.
    fn visit_main(&self) -> Visit {
        let pid = self.main.pid;
        info!(%pid, "Isolating main process with PID {} via DACL.", pid);
        match self.apply(&Process::current()) {
            Ok(()) => Visit::Hardened,
            Err(e) => Visit::Failed(e),
        }
    }

    /// `WRITE_DAC` was denied: a failure if it is a Bitwarden child (e.g. an elevated
    /// child, or one main doesn't own).
    fn visit_denied(&self, pid: Pid) -> Visit {
        let Ok(process) = Process::open(pid, PROCESS_QUERY_LIMITED_INFORMATION) else {
            return Visit::NotOurs;
        };

        if !self.main.is_child(&process) {
            return Visit::NotOurs;
        }

        Visit::Failed(anyhow!("access denied opening for DACL edit"))
    }

    /// DACL first, then the OWNER RIGHTS ACE.
    fn apply(&self, process: &Process) -> Result<()> {
        self.restricted_dacl.apply(process)?;
        self.ace.apply(process)
    }
}

/// Outcome of looking at one added PID.
enum Visit {
    /// Exited, or not a Bitwarden child (e.g. a browser main launched).
    NotOurs,
    /// Hardened during this visit.
    Hardened,
    /// Main or a Bitwarden child that could not be hardened.
    Failed(anyhow::Error),
}

/// Main's identity, used to recognise it and its children.
struct MainProcess {
    pid: Pid,
    start: CreationTime,
    image: ImagePath,
}

impl MainProcess {
    fn current() -> Result<Self> {
        let main = Process::current();

        Ok(Self {
            pid: main.pid(),
            start: main.creation_time()?,
            image: main
                .image_path()
                .ok_or_else(|| anyhow!("failed to read own executable path"))?,
        })
    }

    /// Whether `process` is a Bitwarden child: started after main and runs main's executable.
    ///
    /// Being reported as a child is not enough: main also launches third-party programs
    /// (e.g. the browser via `shell.openExternal`), which must not be hardened.
    fn is_child(&self, process: &Process) -> bool {
        let Ok(start) = process.creation_time() else {
            return false;
        };
        if start < self.start {
            return false;
        }

        process
            .image_path()
            .is_some_and(|image| image == self.image)
    }
}

#[cfg(test)]
mod tests {
    use std::process::Command;

    use windows::Win32::{
        Foundation::{LocalFree, ERROR_SUCCESS, HANDLE, HLOCAL},
        Security::{
            Authorization::{
                GetExplicitEntriesFromAclW, GetSecurityInfo, EXPLICIT_ACCESS_W, SE_KERNEL_OBJECT,
            },
            EqualSid, WinCreatorOwnerRightsSid, WinLocalSystemSid, ACL, DACL_SECURITY_INFORMATION,
            PSECURITY_DESCRIPTOR, PSID,
        },
        System::Threading::{PROCESS_ALL_ACCESS, PROCESS_VM_READ},
    };

    use super::{sid::Sid, *};

    /// Long-running child that does not run the test's own executable.
    fn spawn_foreign() -> std::process::Child {
        Command::new("ping")
            .args(["-n", "30", "127.0.0.1"])
            .spawn()
            .expect("spawn ping")
    }

    /// Access mask each of `sids` gets from the DACL of `handle`, plus the total number of
    /// ACEs. `handle` must be open with `READ_CONTROL`.
    fn granted(handle: HANDLE, sids: &[&Sid]) -> (Vec<Option<PROCESS_ACCESS_RIGHTS>>, usize) {
        let mut dacl: *mut ACL = std::ptr::null_mut();
        let mut sd = PSECURITY_DESCRIPTOR::default();
        // SAFETY: `dacl` and `sd` are valid out pointers; `dacl` points into `sd`, which is
        // freed below after its last use.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getsecurityinfo
        let err = unsafe {
            GetSecurityInfo(
                handle,
                SE_KERNEL_OBJECT,
                DACL_SECURITY_INFORMATION,
                None,
                None,
                Some(&mut dacl),
                None,
                Some(&mut sd),
            )
        };
        assert_eq!(err, ERROR_SUCCESS, "GetSecurityInfo");

        let mut count = 0u32;
        let mut list: *mut EXPLICIT_ACCESS_W = std::ptr::null_mut();
        // SAFETY: `dacl` is valid while `sd` lives; `count` and `list` are valid out pointers.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getexplicitentriesfromaclw
        let err = unsafe { GetExplicitEntriesFromAclW(dacl, &mut count, &mut list) };
        assert_eq!(err, ERROR_SUCCESS, "GetExplicitEntriesFromAclW");
        assert!(!list.is_null() || count == 0);

        let entries = if list.is_null() {
            &[][..]
        } else {
            // SAFETY: The call succeeded and returned `count` initialized entries at `list`.
            unsafe { std::slice::from_raw_parts(list, count as usize) }
        };

        let masks = sids
            .iter()
            .map(|sid| {
                entries
                    .iter()
                    .find(|entry| {
                        let trustee = PSID(entry.Trustee.ptstrName.0.cast());
                        let expected = PSID(sid.as_ptr().cast_mut().cast());
                        // SAFETY: Both point to valid SIDs: `trustee` into `list`, which is
                        // still alive, and `expected` into the borrowed `sid`.
                        unsafe { EqualSid(trustee, expected) }.is_ok()
                    })
                    .map(|entry| PROCESS_ACCESS_RIGHTS(entry.grfAccessPermissions))
            })
            .collect();

        // SAFETY: Both buffers were allocated with LocalAlloc by the calls above and are
        // no longer used; `entries` is not used past this point.
        unsafe {
            LocalFree(Some(HLOCAL(list.cast())));
            LocalFree(Some(HLOCAL(sd.0)));
        }

        (masks, count as usize)
    }

    #[test]
    fn apply_sets_restricted_dacl() {
        let mut child = spawn_foreign();

        let process = Process::open(Pid::from(child.id()), EDIT_RIGHTS).expect("open child");
        let hardener = Hardener::new().expect("hardener");
        hardener.apply(&process).expect("apply");

        // Inspects the DACL instead of trying to open the process: an elevated caller with
        // SeDebugPrivilege enabled skips the DACL, so an access check depends on who runs
        // the test. `process` was opened with READ_CONTROL before hardening and keeps it.
        let user = Sid::current_user().expect("user SID");
        let system = Sid::well_known(WinLocalSystemSid).expect("SYSTEM SID");
        let owner_rights = Sid::well_known(WinCreatorOwnerRightsSid).expect("OWNER RIGHTS SID");
        let (masks, count) = granted(process.handle(), &[&user, &system, &owner_rights]);

        let _ = child.kill();
        let _ = child.wait();

        assert_eq!(count, 3, "only the user, SYSTEM and OWNER RIGHTS ACEs");
        assert_eq!(masks[0], Some(USER_RIGHTS), "user ACE");
        assert_eq!(masks[1], Some(PROCESS_ALL_ACCESS), "SYSTEM ACE");
        assert_eq!(masks[2], Some(USER_RIGHTS), "OWNER RIGHTS ACE");
    }

    #[test]
    fn added_foreign_child_is_left_alone() {
        let mut child = spawn_foreign();

        let hardener = Hardener::new().expect("hardener");
        hardener.handle(ProcessEvent::Added(Pid::from(child.id())));

        let vm_read = Process::open(Pid::from(child.id()), PROCESS_VM_READ);
        let _ = child.kill();
        let _ = child.wait();

        assert!(
            vm_read.is_ok(),
            "a child running another executable must stay untouched"
        );
    }
}
