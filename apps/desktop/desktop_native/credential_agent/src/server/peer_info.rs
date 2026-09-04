//! Resolves the process on the other end of a credential agent connection.

use sysinfo::{Pid, System};
use tracing::warn;

use crate::provider::PeerContext;

/// Best-effort lookup of the process name for `pid`.
///
/// Returns a [`PeerContext`] that always carries the pid, and carries the process name
/// only when it could be resolved — an unnamed peer is still worth prompting about.
pub(crate) fn context_from_pid(pid: u32) -> PeerContext {
    PeerContext {
        pid: Some(pid),
        process_name: process_name(pid),
    }
}

fn process_name(pid: u32) -> Option<String> {
    let mut system = System::new();
    system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
        true,
    );

    let Some(process) = system.process(Pid::from_u32(pid)) else {
        warn!(pid, "could not resolve the peer process");
        return None;
    };

    process.name().to_str().map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_for_current_process_has_a_name() {
        let context = context_from_pid(std::process::id());

        assert_eq!(context.pid, Some(std::process::id()));
        assert!(context.process_name.is_some_and(|name| !name.is_empty()));
    }

    #[test]
    fn test_context_for_dead_process_keeps_pid() {
        // u32::MAX far exceeds the maximum pid on any supported platform.
        let context = context_from_pid(u32::MAX);

        assert_eq!(context.pid, Some(u32::MAX));
        assert!(context.process_name.is_none());
    }
}
