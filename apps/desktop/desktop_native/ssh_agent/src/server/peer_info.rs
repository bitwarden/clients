//! Peer process information for SSH agent connections

use sysinfo::{Pid, System};
use tracing::{debug, warn};

/// Information about the connecting peer process
#[derive(Debug, Clone)]
pub(crate) struct PeerInfo {
    pid: u32,
    process_name: String,
}

impl PeerInfo {
    /// Looks up the process name for `pid`, trying the macOS fast path
    /// first and falling back to the cross-platform `sysinfo` path.
    /// Intermediate failures are logged; returns `None` only when both
    /// paths fail.
    pub(crate) fn from_pid(pid: u32) -> Option<Self> {
        #[cfg(target_os = "macos")]
        match peer_info_from_libproc(pid) {
            Ok(info) => return Some(info),
            Err(e) => debug!(
                "libproc peer-info resolution failed for pid {pid}: {e}; falling back to sysinfo"
            ),
        }

        match peer_info_from_sysinfo(pid) {
            Ok(info) => Some(info),
            Err(e) => {
                warn!("failed to resolve peer process for pid {pid}: {e}");
                None
            }
        }
    }

    pub(crate) fn pid(&self) -> u32 {
        self.pid
    }

    pub(crate) fn process_name(&self) -> &str {
        &self.process_name
    }
}

/// macOS-specific peer-info resolution via `libproc::proc_pid::pidpath`
/// (the BSD `proc_pidpath(2)` syscall). This avoids the `task_for_pid`
/// entitlement that `sysinfo::Process::name()` ends up needing on macOS,
/// so it can still resolve the caller when `sysinfo` cannot (notably
/// inside the Mac App Store sandbox).
#[cfg(target_os = "macos")]
fn peer_info_from_libproc(pid: u32) -> Result<PeerInfo, String> {
    let pid_i32 =
        i32::try_from(pid).map_err(|_| format!("peer pid {pid} exceeds i32 range"))?;
    let path = libproc::proc_pid::pidpath(pid_i32)
        .map_err(|e| format!("proc_pidpath({pid_i32}) failed: {e}"))?;
    let process_name = basename_or_path(&path);
    if process_name.is_empty() {
        return Err("Process name is empty".to_string());
    }
    Ok(PeerInfo { pid, process_name })
}

fn peer_info_from_sysinfo(pid: u32) -> Result<PeerInfo, String> {
    let mut system = System::new();
    system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
        true,
    );
    let process = system
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("sysinfo: process {pid} not found"))?;
    let process_name = process
        .name()
        .to_str()
        .ok_or_else(|| format!("sysinfo: process {pid} name is not valid UTF-8"))?
        .to_string();
    Ok(PeerInfo { pid, process_name })
}

/// Extract the basename from a path string, falling back to the original
/// input when no separator is present or when `Path::file_name()` returns
/// `None` (e.g. `"/"`, `"."`, or `"foo/.."`). Any trailing or embedded NUL
/// bytes are trimmed defensively before basename extraction so we never
/// propagate a C-string terminator into the UI.
#[cfg(target_os = "macos")]
fn basename_or_path(path: &str) -> String {
    let trimmed = path.split('\0').next().unwrap_or("");
    std::path::Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| trimmed.to_string())
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

    #[cfg(target_os = "macos")]
    #[test]
    fn test_peer_info_from_libproc_returns_basename() {
        let info = peer_info_from_libproc(std::process::id())
            .expect("libproc should resolve self pid on macOS");
        let name = info.process_name();
        assert!(!name.is_empty());
        assert!(!name.contains('/'), "expected basename, got: {name}");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_peer_info_from_libproc_propagates_error_for_dead_pid() {
        // u32::MAX far exceeds the macOS PID range, so libproc returns an
        // error. We must surface that error rather than collapse it.
        let err = peer_info_from_libproc(u32::MAX)
            .expect_err("dead pid should yield an Err with context");
        assert!(
            err.contains("exceeds i32 range") || err.contains("proc_pidpath"),
            "error should describe the failure mode: {err}"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_normal_extracts_basename() {
        assert_eq!(
            basename_or_path("/Applications/Foo.app/Contents/MacOS/Foo"),
            "Foo"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_no_separator_returns_input() {
        assert_eq!(basename_or_path("foo"), "foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_root_falls_back_to_input() {
        // Path::new("/").file_name() returns None
        assert_eq!(basename_or_path("/"), "/");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_trailing_slash_returns_last_component() {
        assert_eq!(basename_or_path("/foo/"), "foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_empty_returns_empty() {
        assert_eq!(basename_or_path(""), "");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_single_dot_falls_back_to_input() {
        // Path::new(".").file_name() returns None
        assert_eq!(basename_or_path("."), ".");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_double_dot_returns_double_dot() {
        // Path::new("..").file_name() returns Some("..")
        assert_eq!(basename_or_path(".."), "..");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_strips_nul_bytes() {
        // Defensive: a C-string-style terminator from any libproc bug must
        // not propagate to the UI. We trim everything from the first NUL.
        assert_eq!(basename_or_path("foo\0"), "foo");
        assert_eq!(
            basename_or_path("/Applications/Foo.app/Contents/MacOS/Foo\0"),
            "Foo"
        );
    }
}
