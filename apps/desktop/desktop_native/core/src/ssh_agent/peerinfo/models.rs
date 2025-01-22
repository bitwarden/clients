/**
* Peerinfo represents the information of a peer process connecting over a socket.
* This can be later extended to include more information (icon, app name) for the corresponding application.
*/
#[derive(Debug)]
pub struct PeerInfo {
    uid: u32,
    pid: u32,
    process_name: String,
}

impl PeerInfo {
    pub fn new(uid: u32, pid: u32, process_name: String) -> Self {
        Self {
            uid,
            pid,
            process_name,
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
}
