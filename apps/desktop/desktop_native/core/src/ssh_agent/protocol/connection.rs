use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use crate::ssh_agent::peerinfo::models::PeerInfo;

// The connection id is global and increasing throughout the lifetime of the desktop app
static CONNECTION_COUNTER: AtomicU32 = AtomicU32::new(0);

#[derive(Debug)]
pub struct ConnectionInfo {
    id: u32,
    peer_info: PeerInfo,
    is_forwarding: AtomicBool,
}

impl ConnectionInfo {
    pub fn new(peer_info: PeerInfo) -> Self {
        let id = CONNECTION_COUNTER.fetch_add(1, Ordering::SeqCst);
        Self {
            id,
            peer_info,
            is_forwarding: AtomicBool::new(false),
        }
    }

    pub fn id(&self) -> u32 {
        self.id
    }

    pub fn peer_info(&self) -> &PeerInfo {
        &self.peer_info
    }

    pub fn is_forwarding(&self) -> bool {
        self.is_forwarding.load(Ordering::Relaxed)
    }

    pub fn set_forwarding(&self) {
        self.is_forwarding.store(true, Ordering::Relaxed);
    }
}
