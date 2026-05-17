//! Peer process information for SSH agent connections

use sysinfo::{Pid, System};

/// Information about the connecting peer process
#[derive(Debug, Clone)]
pub(crate) struct PeerInfo {
    pid: u32,
    process_name: String,
}

impl PeerInfo {
    /// Looks up the process name for `pid` and constructs a [`PeerInfo`].
    /// Returns `None` if the process cannot be found or its name cannot be
    /// resolved on the host platform.
    ///
    /// On macOS we first try `libproc::proc_pid::pidpath`, which wraps the BSD
    /// `proc_pidpath(2)` syscall. It does not require the `task_for_pid`
    /// entitlement (which the desktop app does not ship with) and therefore
    /// works under hardened runtime and the App Store sandbox, whereas
    /// `sysinfo::Process::name()` typically returns empty in those builds.
    /// We fall back to the cross-platform sysinfo path on any failure.
    pub(crate) fn from_pid(pid: u32) -> Option<Self> {
        #[cfg(target_os = "macos")]
        if let Some(process_name) = macos_process_name(pid) {
            return Some(Self { pid, process_name });
        }

        let mut system = System::new();
        system.refresh_processes(
            sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
            true,
        );

        let process_name = system
            .process(Pid::from_u32(pid))
            .and_then(|p| p.name().to_str().map(str::to_string))?;

        Some(Self { pid, process_name })
    }

    pub(crate) fn pid(&self) -> u32 {
        self.pid
    }

    pub(crate) fn process_name(&self) -> &str {
        &self.process_name
    }
}

/// Resolve the executable basename of `pid` on macOS via `proc_pidpath(2)`.
/// Returns `None` on any failure so the caller can fall back to the
/// cross-platform sysinfo path without surfacing the error.
#[cfg(target_os = "macos")]
fn macos_process_name(pid: u32) -> Option<String> {
    let path = libproc::proc_pid::pidpath(pid as i32).ok()?;
    std::path::Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .or(Some(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_pid_current_process() {
        let pid = std::process::id();
        let peer_info = PeerInfo::from_pid(pid).unwrap();

        assert_eq!(peer_info.pid(), pid);
        assert!(!peer_info.process_name().is_empty());
    }

    #[test]
    fn test_from_pid_nonexistent_returns_none() {
        // u32::MAX = 4294967295 far exceeds the maximum PID on any supported platform
        assert!(PeerInfo::from_pid(u32::MAX).is_none());
    }

    /// On macOS the libproc fast path must resolve the current process to a
    /// non-empty basename without any extra entitlement. This is the
    /// regression guard for the "Unknown application" prompt on macOS.
    #[cfg(target_os = "macos")]
    #[test]
    fn test_macos_process_name_returns_basename() {
        let name = macos_process_name(std::process::id())
            .expect("libproc should resolve self pid on macOS");
        assert!(!name.is_empty());
        assert!(!name.contains('/'), "expected basename, got: {name}");
    }
}
