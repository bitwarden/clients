use std::sync::{atomic::AtomicBool, Arc};

/**
* Peerinfo represents the information of a peer process connecting over a socket.
* This can be later extended to include more information (icon, app name) for the corresponding application.
*/
#[derive(Debug)]
pub struct PeerInfo {
    uid: u32,
    pid: u32,
    process_name: String,
    is_forwarding: Arc<AtomicBool>,
}

impl PeerInfo {
    pub fn new(uid: u32, pid: u32, process_name: String) -> Self {
        Self {
            uid,
            pid,
            process_name,
            is_forwarding: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn unknown() -> Self {
        Self {
            uid: 0,
            pid: 0,
            process_name: "Unknown application".to_string(),
            is_forwarding: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn uid(&self) -> u32 {
        self.uid
    }

    pub fn pid(&self) -> u32 {
        self.pid
    }

    pub fn process_name(&self) -> &str {
        &self.process_name
    }

    pub fn is_forwarding(&self) -> bool {
        self.is_forwarding
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn set_forwarding(&self, value: bool) {
        self.is_forwarding
            .store(value, std::sync::atomic::Ordering::Relaxed);
    }
}
