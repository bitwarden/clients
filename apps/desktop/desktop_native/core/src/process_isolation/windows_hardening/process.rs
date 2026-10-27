//! A process handle and the queries the hardening needs, plus listing a process's children.
//!
//! `process_watcher` and `dacl` use these to find Bitwarden's children and tell them apart
//! from other processes:
//!
//! - `Process::child_pids`: snapshot of all processes, filtered by parent PID.
//! - `Process::creation_time`: PIDs are reused, so (PID, creation time) identifies a process.
//! - `Process::image_path`: executable path, to skip third-party programs main launched.

use std::fmt;

use anyhow::Result;
use windows::{
    core::{Owned, PWSTR},
    Win32::{
        Foundation::{FILETIME, HANDLE},
        System::{
            Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
                TH32CS_SNAPPROCESS,
            },
            Threading::{
                GetCurrentProcess, GetProcessTimes, OpenProcess, QueryFullProcessImageNameW,
                PROCESS_ACCESS_RIGHTS, PROCESS_NAME_WIN32,
            },
        },
    },
};

/// Longest Windows path, in UTF-16 units, including the terminator.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation>
const MAX_LONG_PATH: u32 = 32_768;

/// A process ID. Only valid until the process exits; then Windows may reuse it.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/procthread/process-handles-and-identifiers>
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(super) struct Pid(u32);

impl From<u32> for Pid {
    fn from(raw: u32) -> Self {
        Self(raw)
    }
}

impl fmt::Display for Pid {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// When a process started. Together with its `Pid` it identifies one process instance,
/// since PIDs are reused.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub(super) struct CreationTime(u64);

#[cfg(test)]
impl From<u64> for CreationTime {
    fn from(raw: u64) -> Self {
        Self(raw)
    }
}

/// A process, held open through a handle.
pub(super) struct Process {
    pid: Pid,
    handle: ProcessHandle,
}

/// How a `Process` holds its handle.
enum ProcessHandle {
    /// Opened with `OpenProcess` and the access asked for; closed on drop.
    Opened(Owned<HANDLE>),
    /// This process's pseudo handle: full access, must not be closed.
    Current,
}

impl Process {
    /// This process.
    pub(super) fn current() -> Self {
        Self {
            pid: Pid(std::process::id()),
            handle: ProcessHandle::Current,
        }
    }

    /// Opens the process with `pid`, asking for `access`.
    pub(super) fn open(pid: Pid, access: PROCESS_ACCESS_RIGHTS) -> windows::core::Result<Self> {
        // SAFETY: Plain FFI call with by-value arguments.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocess
        let raw = unsafe { OpenProcess(access, false, pid.0)? };
        // SAFETY: `raw` is a fresh, valid handle owned by nobody else.
        // The handle must be closed with CloseHandle; dropping `Owned` does that when the
        // `Process` is dropped.
        let handle = unsafe { Owned::new(raw) };

        Ok(Self {
            pid,
            handle: ProcessHandle::Opened(handle),
        })
    }

    pub(super) fn pid(&self) -> Pid {
        self.pid
    }

    /// Raw handle for Win32 calls, valid while `self` lives. Has exactly the access
    /// `Process::open` was given (full access for `Process::current`).
    pub(super) fn handle(&self) -> HANDLE {
        match &self.handle {
            ProcessHandle::Opened(handle) => **handle,
            // SAFETY: GetCurrentProcess has no preconditions; the pseudo handle carries
            // full access and does not need closing.
            // Ref: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getcurrentprocess
            ProcessHandle::Current => unsafe { GetCurrentProcess() },
        }
    }

    /// When the process started. Needs `PROCESS_QUERY_LIMITED_INFORMATION`.
    pub(super) fn creation_time(&self) -> Result<CreationTime> {
        let mut created = FILETIME::default();
        let mut unused = [FILETIME::default(); 3];
        let [exited, kernel, user] = &mut unused;
        // SAFETY: All four out pointers are valid, distinct FILETIMEs. Missing
        // PROCESS_QUERY_LIMITED_INFORMATION only makes the call fail.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes
        unsafe { GetProcessTimes(self.handle(), &mut created, exited, kernel, user)? };
        // FILETIME is a 64-bit count split into two 32-bit halves.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/minwinbase/ns-minwinbase-filetime
        let ticks = (u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime);
        Ok(CreationTime(ticks))
    }

    /// The process's executable. Needs `PROCESS_QUERY_LIMITED_INFORMATION`.
    pub(super) fn image_path(&self) -> Option<ImagePath> {
        let mut buf = vec![0u16; MAX_LONG_PATH as usize];
        let mut len = MAX_LONG_PATH;
        // SAFETY: `buf` is writable for `len` UTF-16 units. Missing
        // PROCESS_QUERY_LIMITED_INFORMATION only makes the call fail.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-queryfullprocessimagenamew
        unsafe {
            QueryFullProcessImageNameW(
                self.handle(),
                PROCESS_NAME_WIN32,
                PWSTR(buf.as_mut_ptr()),
                &mut len,
            )
        }
        .ok()?;

        Some(ImagePath::from_utf16(&buf[..len as usize]))
    }

    /// PIDs of this process's direct children. May include stale entries after PID reuse;
    /// callers verify identity on an open handle.
    ///
    /// A PID is only valid until its process exits, then it can be reused.
    /// Ref: <https://learn.microsoft.com/en-us/windows/win32/procthread/process-handles-and-identifiers>
    pub(super) fn child_pids(&self) -> Result<Vec<Pid>> {
        // SAFETY: Plain FFI call with by-value arguments.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/nf-tlhelp32-createtoolhelp32snapshot
        let raw = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)? };
        // SAFETY: `raw` is a fresh, valid snapshot handle owned by nobody else.
        // The snapshot must be destroyed with CloseHandle; dropping `Owned` does that on
        // every return path.
        let snapshot = unsafe { Owned::new(raw) };

        let mut entry = PROCESSENTRY32W {
            dwSize: size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };

        let mut pids = Vec::new();
        // SAFETY: `snapshot` is a valid process snapshot and `entry.dwSize` is set.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/tlhelp32/nf-tlhelp32-process32firstw (dwSize must be set)
        let mut next = unsafe { Process32FirstW(*snapshot, &mut entry) };
        while next.is_ok() {
            if entry.th32ParentProcessID == self.pid.0 {
                pids.push(Pid(entry.th32ProcessID));
            }
            // SAFETY: Same snapshot and entry as Process32FirstW above.
            next = unsafe { Process32NextW(*snapshot, &mut entry) };
        }

        Ok(pids)
    }
}

/// An executable path. Compares case-insensitively, like Windows paths.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file>
#[derive(Debug, PartialEq, Eq)]
pub(super) struct ImagePath(String);

impl ImagePath {
    fn from_utf16(units: &[u16]) -> Self {
        Self(String::from_utf16_lossy(units).to_lowercase())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(path: &str) -> ImagePath {
        ImagePath::from_utf16(&path.encode_utf16().collect::<Vec<_>>())
    }

    #[test]
    fn image_path_ignores_case() {
        assert_eq!(
            image(r"C:\Program Files\Bitwarden\Bitwarden.exe"),
            image(r"c:\program files\bitwarden\BITWARDEN.EXE")
        );
    }

    #[test]
    fn current_process_has_creation_time_and_image() {
        let current = Process::current();

        assert!(current.creation_time().is_ok());
        assert!(current.image_path().is_some());
    }
}
