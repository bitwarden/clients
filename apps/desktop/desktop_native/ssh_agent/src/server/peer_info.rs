//! Peer process information for SSH agent connections

use sysinfo::{Pid, System};

/// Information about the connecting peer process
#[derive(Debug, Clone)]
pub(crate) struct PeerInfo {
    pid: u32,
    process_name: String,
}

impl PeerInfo {
    /// Looks up the process name for `pid` via sysinfo and constructs a [`PeerInfo`].
    /// Returns `None` if the process cannot be found or its name is not valid UTF-8.
    pub(crate) fn from_pid(pid: u32) -> Option<Self> {
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
}
