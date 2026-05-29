use sysinfo::{Pid, System};

use super::models::PeerInfo;

/// Resolve a [`PeerInfo`] for `peer_pid` by trying the platform-specific
/// fast path first and falling back to the cross-platform `sysinfo` path.
/// Returns an error only when neither path can resolve the peer process.
pub fn get_peer_info(peer_pid: u32) -> Result<PeerInfo, String> {
    try_peer_info_for_platform(peer_pid)
        .or_else(|| try_peer_info_sysinfo(peer_pid))
        .ok_or_else(|| "Failed to resolve peer process".to_string())
}

/// macOS-specific peer-info resolution via `libproc::proc_pid::pidpath`
/// (the BSD `proc_pidpath(2)` syscall). This avoids the `task_for_pid`
/// entitlement that `sysinfo::Process::name()` ends up needing on macOS,
/// so it can still resolve the caller when `sysinfo` cannot (notably
/// inside the Mac App Store sandbox). Returns `None` on any failure or
/// when the resolved basename is empty, so the caller can fall through
/// to the `sysinfo` path.
#[cfg(target_os = "macos")]
fn try_peer_info_for_platform(peer_pid: u32) -> Option<PeerInfo> {
    let pid_i32 = i32::try_from(peer_pid).ok()?;
    let path = libproc::proc_pid::pidpath(pid_i32).ok()?;
    let process_name = basename_or_path(&path);
    if process_name.is_empty() {
        return None;
    }
    Some(PeerInfo::new(peer_pid, peer_pid, process_name))
}

/// Non-macOS platforms have no fast path; they fall through to sysinfo.
#[cfg(not(target_os = "macos"))]
fn try_peer_info_for_platform(_peer_pid: u32) -> Option<PeerInfo> {
    None
}

/// Cross-platform peer-info resolution via the `sysinfo` crate.
fn try_peer_info_sysinfo(peer_pid: u32) -> Option<PeerInfo> {
    let mut system = System::new();
    system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(peer_pid)]),
        true,
    );
    let process = system.process(Pid::from_u32(peer_pid))?;
    let name = process.name().to_str()?.to_string();
    Some(PeerInfo::new(peer_pid, process.pid().as_u32(), name))
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
    fn macos_fast_path_returns_basename_for_self() {
        let info = try_peer_info_for_platform(std::process::id())
            .expect("libproc should resolve self pid on macOS");
        let name = info.process_name();
        assert!(!name.is_empty());
        assert!(!name.contains('/'), "expected basename, got: {name}");
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
        // Path::new("..").file_name() returns Some(""..")
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
