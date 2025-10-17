use std::fmt::Debug;

use sysinfo::{Pid, System};

/// Peerinfo represents the information of a peer process connecting over a socket.
/// This can be later extended to include more information (icon, app name) for the corresponding application.
#[derive(Clone)]
pub struct PeerInfo {
    pid: u32,
    process_name: String,
    peer_type: PeerType,
}

#[derive(Clone, Copy, Debug)]
pub enum PeerType {
    #[cfg(windows)]
    NamedPipe,
    UnixSocket,
}

impl PeerInfo {
    pub fn new(pid: u32, peer_type: PeerType) -> Self {
        Self::from_pid(pid, peer_type).unwrap_or_else(|_| PeerInfo::unknown())
    }

    fn from_pid(peer_pid: u32, peer_type: PeerType) -> Result<Self, ()> {
        let mut system = System::new();
        system.refresh_processes(
            sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(peer_pid)]),
            true,
        );
        if let Some(process) = system.process(Pid::from_u32(peer_pid)) {
            Ok(Self {
                pid: peer_pid,
                process_name: process.name().to_str().ok_or(())?.to_string(),
                peer_type,
            })
        } else {
            Err(())
        }
    }

    pub fn unknown() -> Self {
        Self {
            pid: 0,
            process_name: "Unknown application".to_string(),
            peer_type: PeerType::UnixSocket,
        }
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }

    pub fn process_name(&self) -> &str {
        &self.process_name
    }
}

impl Debug for PeerInfo {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PeerInfo")
            .field("pid", &self.pid)
            .field("process_name", &self.process_name)
            .field("peer_type", &self.peer_type)
            .finish()
    }
}
