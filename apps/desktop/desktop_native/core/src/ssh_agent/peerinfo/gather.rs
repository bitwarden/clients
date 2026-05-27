use sysinfo::{Pid, System};

use super::models::PeerInfo;
use crate::ssh_agent::context::ProcessFrame;

pub fn get_peer_info(peer_pid: u32) -> Result<PeerInfo, String> {
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

const MAX_PROCESS_TREE_DEPTH: usize = 8;

/// Walk the process tree from `pid` upward (toward init/pid 0). Returns
/// frames ordered **root → leaf**. Stops at depth `MAX_PROCESS_TREE_DEPTH`
/// or when no parent is found.
pub fn gather_process_tree(pid: u32) -> Vec<ProcessFrame> {
    let mut system = sysinfo::System::new();
    system.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let mut frames: Vec<ProcessFrame> = Vec::new();
    let mut cur = Some(sysinfo::Pid::from_u32(pid));
    let mut depth = 0usize;
    while let Some(p) = cur {
        if depth >= MAX_PROCESS_TREE_DEPTH {
            break;
        }
        let Some(proc) = system.process(p) else { break };
        frames.push(ProcessFrame {
            pid: p.as_u32(),
            name: proc.name().to_string_lossy().to_string(),
            executable_path: proc.exe().map(|p| p.to_string_lossy().to_string()),
        });
        cur = proc.parent();
        depth += 1;
    }
    frames.reverse(); // root → leaf
    frames
}

/// Read the argv of `pid`. Sanitizes: caps total args at 32 and per-arg
/// length at 512 bytes. Returns `None` if no argv could be read.
pub fn gather_argv(pid: u32) -> Option<Vec<String>> {
    let mut system = sysinfo::System::new();
    system.refresh_processes_specifics(
        sysinfo::ProcessesToUpdate::Some(&[sysinfo::Pid::from_u32(pid)]),
        true,
        sysinfo::ProcessRefreshKind::nothing().with_cmd(sysinfo::UpdateKind::Always),
    );
    let proc = system.process(sysinfo::Pid::from_u32(pid))?;
    let raw = proc.cmd();
    if raw.is_empty() {
        return None;
    }
    let truncated: Vec<String> = raw
        .iter()
        .take(32)
        .map(|s| {
            let mut s = s.to_string_lossy().into_owned();
            if s.len() > 512 {
                s.truncate(512);
            }
            s
        })
        .collect();
    Some(truncated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn process_tree_for_self_is_ordered_root_to_leaf() {
        let my_pid = std::process::id();
        let frames = gather_process_tree(my_pid);
        assert!(!frames.is_empty(), "should find at least our own process");
        let last = frames.last().unwrap();
        assert_eq!(last.pid, my_pid, "leaf is the requested pid");
    }

    #[test]
    fn process_tree_respects_depth_cap() {
        let frames = gather_process_tree(std::process::id());
        assert!(frames.len() <= MAX_PROCESS_TREE_DEPTH);
    }

    #[test]
    fn process_tree_for_invalid_pid_is_empty() {
        // Use a pid we are very unlikely to ever see in the test environment.
        let frames = gather_process_tree(u32::MAX);
        assert!(frames.is_empty());
    }

    #[test]
    fn gather_argv_for_self_includes_test_binary() {
        let my_pid = std::process::id();
        let argv = gather_argv(my_pid).expect("self argv should be readable");
        assert!(!argv.is_empty());
    }

    #[test]
    fn gather_argv_for_invalid_pid_is_none() {
        assert!(gather_argv(u32::MAX).is_none());
    }
}
