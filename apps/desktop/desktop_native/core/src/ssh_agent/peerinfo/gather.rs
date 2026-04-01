use std::{fs::File, io::Read, path::Path};

use sha2::{Digest, Sha256};
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

        let exe_hash = process.exe().and_then(hash_file_if_exists);

        return Ok(PeerInfo::new(
            peer_pid,
            process.pid().as_u32(),
            peer_process_name,
            exe_hash,
        ));
    }

    Err("Failed to get process".to_string())
}

fn hash_file_if_exists(path: &Path) -> Option<String> {
    if path.as_os_str().is_empty() || !path.exists() {
        return None;
    }
    let mut f = File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = match f.read(&mut buf) {
            Ok(n) => n,
            Err(_) => return None,
        };
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Some(format!("{:x}", hasher.finalize()))
}
