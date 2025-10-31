use std::sync::atomic::{AtomicU32, Ordering};

use crate::{
    knownhosts,
    protocol::types::{PublicKey, SessionId},
    transport::peer_info::PeerInfo,
};

// The connection id is global and increasing throughout the lifetime of the desktop app
static CONNECTION_COUNTER: AtomicU32 = AtomicU32::new(0);

#[derive(Clone, Debug)]
pub struct ConnectionInfo {
    id: u32,
    peer_info: PeerInfo,

    is_forwarding: bool,
    host_key: Option<PublicKey>,
    host_name: Option<String>,
    session_identifier: Option<SessionId>,
}

impl ConnectionInfo {
    pub fn new(peer_info: PeerInfo) -> Self {
        let id = CONNECTION_COUNTER.fetch_add(1, Ordering::SeqCst);
        Self {
            id,
            peer_info,
            is_forwarding: false,
            host_key: None,
            host_name: None,
            session_identifier: None,
        }
    }

    pub fn id(&self) -> u32 {
        self.id
    }

    pub fn peer_info(&self) -> &PeerInfo {
        &self.peer_info
    }

    pub fn is_forwarding(&self) -> bool {
        self.is_forwarding
    }

    pub fn set_forwarding(&mut self) {
        self.is_forwarding = true;
    }

    pub fn host_key(&self) -> Option<&PublicKey> {
        self.host_key.as_ref()
    }

    pub fn host_name(&self) -> Option<&String> {
        self.host_name.as_ref()
    }

    pub fn set_host_key(&mut self, host_key: &PublicKey) {
        self.host_key = Some(host_key.clone());
        // Some systems (flatpak, macos sandbox) may prevent access to the known hosts file.
        if let Ok(hosts) = knownhosts::KnownHostsReader::read_default() {
            self.host_name = hosts
                .find_host(&host_key)
                .map(|entry| entry.hostname.clone());
        }
    }

    pub fn session_identifier(&self) -> Option<&SessionId> {
        self.session_identifier.as_ref()
    }

    pub fn set_session_identifier(&mut self, session_id: SessionId) {
        self.session_identifier = Some(session_id);
    }
}
