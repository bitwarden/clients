use sysinfo::{Pid, System};

use super::models::PeerInfo;

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
