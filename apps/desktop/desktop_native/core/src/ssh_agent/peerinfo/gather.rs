use sysinfo::{Pid, System};

use super::models::PeerInfo;

pub fn get_peer_info(peer_pid: u32) -> Result<PeerInfo, String> {
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

#[cfg(target_os = "macos")]
fn macos_process_name(peer_pid: u32) -> Option<String> {
    let path = libproc::proc_pid::pidpath(peer_pid as i32).ok()?;
    std::path::Path::new(&path)
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .or(Some(path))
}
