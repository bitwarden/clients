use sysinfo::{Pid, System};
use tracing::error;

use super::models::PeerInfo;

///
/// # Errors
///
/// This function returns an error string if there is no matching process
/// for the provided `peer_pid`.
pub(crate) fn get_peer_info(peer_pid: u32) -> Result<PeerInfo, String> {
    let s = System::new_all();
    if let Some(process) = s.process(Pid::from_u32(peer_pid)) {
        let peer_process_name = process.name().to_string_lossy().to_string();

        return Ok(PeerInfo::new(
            peer_pid,
            process.pid().as_u32(),
            peer_process_name,
        ));
    }

    error!(peer_pid, "No process matching peer PID.");
    Err("No process matching PID".to_string())
}
