use sysinfo::{Pid, System};

use super::models::PeerInfo;

pub fn get_peer_info(peer_pid: u32) -> Result<PeerInfo, String> {
    // On macOS, sysinfo's `process.name()` often fails or returns empty under
    // hardened runtime / sandbox because the underlying APIs require the
    // `task_for_pid` entitlement which the desktop app does not ship with.
    // `libproc::proc_pid::pidpath` wraps the BSD `proc_pidpath(2)` syscall
    // which does not require that entitlement and works for arbitrary peer
    // PIDs in both sandboxed and non-sandboxed builds. We try it first on
    // macOS and fall back to the cross-platform sysinfo path on any failure.
    #[cfg(target_os = "macos")]
    if let Some(name) = macos_process_name(peer_pid) {
        return Ok(PeerInfo::new(peer_pid, peer_pid, name));
    }

    let mut system = System::new();
    system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(peer_pid)]),
        true,
    );
    if let Some(process) = system.process(Pid::from_u32(peer_pid)) {
        let peer_process_name = match process.name().to_str() {
            Some(name) => name.to_string(),
            None => {
                return Err("Failed to get process name".to_string());
            }
        };

        return Ok(PeerInfo::new(
            peer_pid,
            process.pid().as_u32(),
            peer_process_name,
        ));
    }

    Err("Failed to get process".to_string())
}

/// Resolve the executable basename of a peer process on macOS via
/// `proc_pidpath(2)`. Returns `None` on any failure so the caller can fall
/// back to the generic sysinfo path without surfacing the error.
#[cfg(target_os = "macos")]
fn macos_process_name(peer_pid: u32) -> Option<String> {
    let path = libproc::proc_pid::pidpath(peer_pid as i32).ok()?;
    std::path::Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .or(Some(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `get_peer_info` must resolve the *current* process to a non-empty name.
    /// Otherwise the SSH agent UI would render "Unknown application" even for
    /// the most easily-resolvable PID — exactly the regression this change
    /// guards against on macOS.
    #[test]
    fn get_peer_info_resolves_self_to_non_empty_name() {
        let info = get_peer_info(std::process::id())
            .expect("self pid should resolve to a PeerInfo");
        assert!(
            !info.process_name().is_empty(),
            "process_name must not be empty for current process"
        );
    }

    /// On macOS the libproc fast path should return a non-empty basename for
    /// the current process without requiring any extra entitlement.
    #[cfg(target_os = "macos")]
    #[test]
    fn macos_process_name_returns_basename_for_self() {
        let name = macos_process_name(std::process::id())
            .expect("libproc should resolve self pid on macOS");
        assert!(!name.is_empty());
        assert!(
            !name.contains('/'),
            "expected basename, got full path: {name}"
        );
    }
}
