use std::sync::{atomic::AtomicBool, Arc, Mutex};

/**
 * Peerinfo represents the information of a peer process connecting over a socket.
 * This can be later extended to include more information (icon, app name) for the corresponding
 * application.
 */
#[derive(Debug, Clone)]
pub struct PeerInfo {
    uid: u32,
    pid: u32,
    process_name: String,
    exe_hash: Option<String>,
    is_forwarding: Arc<AtomicBool>,
    host_key: Arc<Mutex<Vec<u8>>>,
}

impl PeerInfo {
    pub fn new(uid: u32, pid: u32, process_name: String, exe_hash: Option<String>) -> Self {
        Self {
            uid,
            pid,
            process_name,
            exe_hash,
            is_forwarding: Arc::new(AtomicBool::new(false)),
            host_key: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn unknown() -> Self {
        Self {
            uid: 0,
            pid: 0,
            process_name: "Unknown application".to_string(),
            exe_hash: None,
            is_forwarding: Arc::new(AtomicBool::new(false)),
            host_key: Arc::new(Mutex::new(Vec::new())),
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

    pub fn exe_hash(&self) -> Option<&str> {
        self.exe_hash.as_deref()
    }

    pub fn is_forwarding(&self) -> bool {
        self.is_forwarding
            .load(std::sync::atomic::Ordering::Relaxed)
    }

    pub fn set_forwarding(&self, value: bool) {
        self.is_forwarding
            .store(value, std::sync::atomic::Ordering::Relaxed);
    }

    pub fn set_host_key(&self, host_key: Vec<u8>) {
        let mut host_key_lock = self.host_key.lock().expect("Mutex is not poisoned");
        *host_key_lock = host_key;
    }

    pub fn host_key(&self) -> Vec<u8> {
        self.host_key.lock().expect("Mutex is not poisoned").clone()
    }
}
