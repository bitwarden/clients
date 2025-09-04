use std::sync::atomic::{AtomicU32, Ordering};

use crate::ssh_agent::peerinfo::models::PeerInfo;

static CONNECTION_COUNTER: AtomicU32 = AtomicU32::new(0);

#[derive(Debug)]
pub struct ConnectionInfo {
    id: u32,
    peer_info: PeerInfo,
}

impl ConnectionInfo {
    pub fn new(peer_info: PeerInfo) -> Self {
        let id = CONNECTION_COUNTER.fetch_add(1, Ordering::SeqCst);
        Self { id, peer_info }
    }

    pub fn id(&self) -> u32 {
        self.id
    }

    pub fn peer_info(&self) -> &PeerInfo {
        &self.peer_info
    }
}
