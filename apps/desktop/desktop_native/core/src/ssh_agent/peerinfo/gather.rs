use sysinfo::{Pid, System};
use tracing::{debug, warn};

use super::models::PeerInfo;

/// Resolve a [`PeerInfo`] for `peer_pid`, trying the macOS fast path
/// first and falling back to the cross-platform `sysinfo` path.
/// Intermediate failures are logged; only the final-failure error is
/// returned.
pub fn get_peer_info(peer_pid: u32) -> Result<PeerInfo, String> {
    #[cfg(target_os = "macos")]
    match peer_info_from_libproc(peer_pid) {
        Ok(info) => return Ok(info),
        Err(e) => debug!(
            "libproc peer-info resolution failed for pid {peer_pid}: {e}; falling back to sysinfo"
        ),
    }

    match peer_info_from_sysinfo(peer_pid) {
        Ok(info) => Ok(info),
        Err(e) => {
            warn!("failed to resolve peer process for pid {peer_pid}: {e}");
            Err(e)
        }
    }
}

/// macOS-specific peer-info resolution via `libproc::proc_pid::pidpath`
/// (the BSD `proc_pidpath(2)` syscall). This avoids the `task_for_pid`
/// entitlement that `sysinfo::Process::name()` ends up needing on macOS,
/// so it can still resolve the caller when `sysinfo` cannot (notably
/// inside the Mac App Store sandbox).
#[cfg(target_os = "macos")]
fn peer_info_from_libproc(peer_pid: u32) -> Result<PeerInfo, String> {
    let pid_i32 = i32::try_from(peer_pid)
        .map_err(|_| format!("peer pid {peer_pid} exceeds i32 range"))?;
    let path = libproc::proc_pid::pidpath(pid_i32)
        .map_err(|e| format!("proc_pidpath({pid_i32}) failed: {e}"))?;
    let process_name = basename_or_path(&path);
    if process_name.is_empty() {
        return Err("Process name is empty".to_string());
    }
    Ok(PeerInfo::new(peer_pid, peer_pid, process_name))
}

fn peer_info_from_sysinfo(peer_pid: u32) -> Result<PeerInfo, String> {
    let mut system = System::new();
    system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(peer_pid)]),
        true,
    );
    let process = system
        .process(Pid::from_u32(peer_pid))
        .ok_or_else(|| format!("sysinfo: process {peer_pid} not found"))?;
    let name = process
        .name()
        .to_str()
        .ok_or_else(|| format!("sysinfo: process {peer_pid} name is not valid UTF-8"))?
        .to_string();
    Ok(PeerInfo::new(peer_pid, process.pid().as_u32(), name))
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
    fn get_peer_info_resolves_self_to_non_empty_name() {
        let info = get_peer_info(std::process::id())
            .expect("self pid should resolve to a PeerInfo");
        assert!(!info.process_name().is_empty());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn peer_info_from_libproc_returns_basename_for_self() {
        let info = peer_info_from_libproc(std::process::id())
            .expect("libproc should resolve self pid on macOS");
        let name = info.process_name();
        assert!(!name.is_empty());
        assert!(!name.contains('/'), "expected basename, got: {name}");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn peer_info_from_libproc_propagates_error_for_dead_pid() {
        // u32::MAX far exceeds the macOS PID range, so libproc returns an
        // error. We must surface that error rather than swallow it.
        let err = peer_info_from_libproc(u32::MAX)
            .expect_err("dead pid should yield an Err with context");
        assert!(
            err.contains("exceeds i32 range") || err.contains("proc_pidpath"),
            "error should describe the failure mode: {err}"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_normal_extracts_basename() {
        assert_eq!(
            basename_or_path("/Applications/Foo.app/Contents/MacOS/Foo"),
            "Foo"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_no_separator_returns_input() {
        assert_eq!(basename_or_path("foo"), "foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_root_falls_back_to_input() {
        // Path::new("/").file_name() returns None
        assert_eq!(basename_or_path("/"), "/");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_trailing_slash_returns_last_component() {
        assert_eq!(basename_or_path("/foo/"), "foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_empty_returns_empty() {
        assert_eq!(basename_or_path(""), "");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_single_dot_falls_back_to_input() {
        // Path::new(".").file_name() returns None
        assert_eq!(basename_or_path("."), ".");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_double_dot_returns_double_dot() {
        // Path::new("..").file_name() returns Some("..")
        assert_eq!(basename_or_path(".."), "..");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_or_path_strips_nul_bytes() {
        // Defensive: a C-string-style terminator from any libproc bug must
        // not propagate to the UI. We trim everything from the first NUL.
        assert_eq!(basename_or_path("foo\0"), "foo");
        assert_eq!(
            basename_or_path("/Applications/Foo.app/Contents/MacOS/Foo\0"),
            "Foo"
        );
    }
}
