use std::fmt::Debug;

use sysinfo::{Pid, System};

/// Peerinfo represents the information of a peer process connecting over a socket.
/// This can be later extended to include more information (icon, app name) for the corresponding application.
#[derive(Clone)]
pub struct PeerInfo {
    pub process_info: ProcessInfo,
    pub peer_type: PeerType,
}

#[derive(Clone, Debug)]
pub enum ProcessInfo {
    Known { pid: u32, process_name: String },
    Unknown,
}

#[derive(Clone, Copy, Debug)]
pub enum PeerType {
    #[cfg(windows)]
    NamedPipe,
    UnixSocket,
}

impl PeerInfo {
    pub fn new(pid: u32, peer_type: PeerType) -> Self {
        Self::from_pid(pid, peer_type)
    }

    pub fn unknown(peer_type: PeerType) -> Self {
        Self {
            process_info: ProcessInfo::Unknown,
            peer_type,
        }
    }

    fn from_pid(peer_pid: u32, peer_type: PeerType) -> Self {
        let mut system = System::new();
        system.refresh_processes(
            sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(peer_pid)]),
            true,
        );
        let process_info = if let Some(process) = system.process(Pid::from_u32(peer_pid)) {
            ProcessInfo::Known {
                pid: peer_pid,
                process_name: process.name().to_os_string().to_string_lossy().into_owned(),
            }
        } else {
            ProcessInfo::Unknown
        };

        Self {
            process_info,
            peer_type,
        }
    }
}

impl Debug for PeerInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PeerInfo")
            .field("process_info", &self.process_info)
            .field("peer_type", &self.peer_type)
            .finish()
    }
}
