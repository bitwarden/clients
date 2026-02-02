use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, AtomicU32},
        Arc, RwLock,
    },
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use bitwarden_russh::{
    session_bind::SessionBindResult,
    ssh_agent::{self, SshKey},
};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "unix.rs")]
#[cfg_attr(target_os = "linux", path = "unix.rs")]
mod platform_ssh_agent;

#[cfg(any(target_os = "linux", target_os = "macos"))]
mod peercred_unix_listener_stream;

pub mod peerinfo;
mod request_parser;

#[derive(Clone)]
pub struct BitwardenDesktopAgent {
    keystore: ssh_agent::KeyStore<BitwardenSshKey>,
    cancellation_token: CancellationToken,
    show_ui_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
    get_ui_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    request_id: Arc<AtomicU32>,
    /// before first unlock, or after account switching, listing keys should require an unlock to
    /// get a list of public keys
    needs_unlock: Arc<AtomicBool>,
    is_running: Arc<AtomicBool>,
}

pub struct SshAgentUIRequest {
    pub request_id: u32,
    pub cipher_id: Option<String>,
    pub process_name: String,
    pub is_list: bool,
    pub namespace: Option<String>,
    pub is_forwarding: bool,
}

#[derive(Clone)]
pub struct BitwardenSshKey {
    pub private_key: Option<ssh_key::private::PrivateKey>,
    pub name: String,
    pub cipher_uuid: String,
}

impl SshKey for BitwardenSshKey {
    fn name(&self) -> &str {
        &self.name
    }

    fn public_key_bytes(&self) -> Vec<u8> {
        if let Some(ref private_key) = self.private_key {
            private_key
                .public_key()
                .to_bytes()
                .expect("Cipher private key is always correctly parsed")
        } else {
            Vec::new()
        }
    }

    fn private_key(&self) -> Option<Box<dyn ssh_key::SigningKey>> {
        if let Some(ref private_key) = self.private_key {
            Some(Box::new(private_key.clone()))
        } else {
            None
        }
    }
}

impl ssh_agent::Agent<peerinfo::models::PeerInfo, BitwardenSshKey> for BitwardenDesktopAgent {
    async fn confirm(
        &self,
        ssh_key: BitwardenSshKey,
        data: &[u8],
        info: &peerinfo::models::PeerInfo,
    ) -> bool {
        if !self.is_running() {
            error!("Agent is not running, but tried to call confirm");
            return false;
        }

        let request_id = self.get_request_id();
        let request_data = match request_parser::parse_request(data) {
            Ok(data) => data,
            Err(e) => {
                error!(error = %e, "Error while parsing request");
                return false;
            }
        };
        let namespace = match request_data {
            request_parser::SshAgentSignRequest::SshSigRequest(ref req) => {
                Some(req.namespace.clone())
            }
            _ => None,
        };

        info!(
            is_forwarding = %info.is_forwarding(),
            namespace = ?namespace.as_ref(),
            host_key = %STANDARD.encode(info.host_key()),
            "Confirming request from application: {}",
            info.process_name(),
        );

        let mut rx_channel = self.get_ui_response_rx.lock().await.resubscribe();
        self.show_ui_request_tx
            .send(SshAgentUIRequest {
                request_id,
                cipher_id: Some(ssh_key.cipher_uuid.clone()),
                process_name: info.process_name().to_string(),
                is_list: false,
                namespace,
                is_forwarding: info.is_forwarding(),
            })
            .await
            .expect("Should send request to ui");
        while let Ok((id, response)) = rx_channel.recv().await {
            if id == request_id {
                return response;
            }
        }
        false
    }

    async fn can_list(&self, info: &peerinfo::models::PeerInfo) -> bool {
        if !self.needs_unlock.load(std::sync::atomic::Ordering::Relaxed) {
            return true;
        }

        let request_id = self.get_request_id();

        let mut rx_channel = self.get_ui_response_rx.lock().await.resubscribe();
        let message = SshAgentUIRequest {
            request_id,
            cipher_id: None,
            process_name: info.process_name().to_string(),
            is_list: true,
            namespace: None,
            is_forwarding: info.is_forwarding(),
        };
        self.show_ui_request_tx
            .send(message)
            .await
            .expect("Should send request to ui");
        while let Ok((id, response)) = rx_channel.recv().await {
            if id == request_id {
                return response;
            }
        }
        false
    }

    async fn set_sessionbind_info(
        &self,
        session_bind_info_result: &SessionBindResult,
        connection_info: &peerinfo::models::PeerInfo,
    ) {
        match session_bind_info_result {
            SessionBindResult::Success(session_bind_info) => {
                connection_info.set_forwarding(session_bind_info.is_forwarding);
                connection_info.set_host_key(session_bind_info.host_key.clone());
            }
            SessionBindResult::SignatureFailure => {
                error!("Session bind failure: Signature failure");
            }
        }
    }
}

impl BitwardenDesktopAgent {
    /// Create a new `BitwardenDesktopAgent` from the provided auth channel handles.
    pub fn new(
        auth_request_tx: tokio::sync::mpsc::Sender<SshAgentUIRequest>,
        auth_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Self {
        Self {
            keystore: ssh_agent::KeyStore(Arc::new(RwLock::new(HashMap::new()))),
            cancellation_token: CancellationToken::new(),
            show_ui_request_tx: auth_request_tx,
            get_ui_response_rx: auth_response_rx,
            request_id: Arc::new(AtomicU32::new(0)),
            needs_unlock: Arc::new(AtomicBool::new(true)),
            is_running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn stop(&self) {
        if !self.is_running() {
            error!("Tried to stop agent while it is not running");
            return;
        }

        self.is_running
            .store(false, std::sync::atomic::Ordering::Relaxed);
        self.keystore
            .0
            .write()
            .expect("RwLock is not poisoned")
            .clear();
    }

    pub fn set_keys(
        &mut self,
        new_keys: Vec<(String, String, String)>,
    ) -> Result<(), anyhow::Error> {
        if !self.is_running() {
            return Err(anyhow::anyhow!(
                "[BitwardenDesktopAgent] Tried to set keys while agent is not running"
            ));
        }

        let keystore = &mut self.keystore;
        keystore.0.write().expect("RwLock is not poisoned").clear();

        self.needs_unlock
            .store(true, std::sync::atomic::Ordering::Relaxed);

        for (key, name, cipher_id) in new_keys.iter() {
            match parse_key_safe(key) {
                Ok(private_key) => {
                    let public_key_bytes = private_key
                        .public_key()
                        .to_bytes()
                        .expect("Cipher private key is always correctly parsed");
                    keystore.0.write().expect("RwLock is not poisoned").insert(
                        public_key_bytes,
                        BitwardenSshKey {
                            private_key: Some(private_key),
                            name: name.clone(),
                            cipher_uuid: cipher_id.clone(),
                        },
                    );
                }
                Err(e) => {
                    error!(error=%e, "Error while parsing key");
                }
            }
        }

        Ok(())
    }

    pub fn lock(&mut self) -> Result<(), anyhow::Error> {
        if !self.is_running() {
            return Err(anyhow::anyhow!(
                "[BitwardenDesktopAgent] Tried to lock agent, but it is not running"
            ));
        }

        let keystore = &mut self.keystore;
        keystore
            .0
            .write()
            .expect("RwLock is not poisoned")
            .iter_mut()
            .for_each(|(_public_key, key)| {
                key.private_key = None;
            });
        Ok(())
    }

    pub fn clear_keys(&mut self) -> Result<(), anyhow::Error> {
        let keystore = &mut self.keystore;
        keystore.0.write().expect("RwLock is not poisoned").clear();
        self.needs_unlock
            .store(true, std::sync::atomic::Ordering::Relaxed);

        Ok(())
    }

    fn get_request_id(&self) -> u32 {
        if !self.is_running() {
            error!("Agent is not running, but tried to get request id");
            return 0;
        }

        self.request_id
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    pub fn is_running(&self) -> bool {
        self.is_running.load(std::sync::atomic::Ordering::Relaxed)
    }
}

fn parse_key_safe(pem: &str) -> Result<ssh_key::private::PrivateKey, anyhow::Error> {
    match ssh_key::private::PrivateKey::from_openssh(pem) {
        Ok(key) => match key.public_key().to_bytes() {
            Ok(_) => Ok(key),
            Err(e) => Err(anyhow::Error::msg(format!(
                "Failed to parse public key: {e}"
            ))),
        },
        Err(e) => Err(anyhow::Error::msg(format!("Failed to parse key: {e}"))),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::Ordering;

    use ssh_key::Signature;

    use super::*;

    // Test Ed25519 key (unencrypted OpenSSH format)
    const TEST_ED25519_KEY: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACAOYor3+kyAsXYs2sGikmUuhpxmVf2hAGd2TK7KwN4N9gAAAJj79ujB+/bo
wQAAAAtzc2gtZWQyNTUxOQAAACAOYor3+kyAsXYs2sGikmUuhpxmVf2hAGd2TK7KwN4N9g
AAAEAgAQkLDKjON00XO+Y09BoIBuQsAXAx6HUhQoTEodVzig5iivf6TICxdizawaKSZS6G
nGZV/aEAZ3ZMrsrA3g32AAAAEHRlc3RAZXhhbXBsZS5jb20BAgMEBQ==
-----END OPENSSH PRIVATE KEY-----";

    // Test RSA 2048-bit key (unencrypted OpenSSH format)
    const TEST_RSA_KEY: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEAy0YUFvgBLMZXIKjsBfcdO6N2Kk2VmjSpxa2aFD1TrAcVyyIZ9v8o
slQITyFL4GCK5VCJX9bqXBwc9ml8G/zt21ue6nadeZLhp2iXeQ+VUxmola9HhaFvxSNqi0
MOJaWIfmisH4jt7Msdv4jwlDE5AkHAFig8wiwDgvSV3kmfhyPs38aq8Pa+wT3zBneGXT17
34OhH4nicuq+L0GcR9BJQ5+jXNQIgGdqd7sKa8JchPXLXAbTug2SfwRmKgiCM0L6JQ5NSQ
FdRHW/iz4ARacSkHP3w0pH6ZtAd8+glzvZn1KcXwrN/CYl3fqFwiwcQXIF0KDoOI/UyiKZ
uDE+DW5M1wAAA8g2Sf0XNkn9FwAAAAdzc2gtcnNhAAABAQDLRhQW+AEsxlcgqOwF9x07o3
YqTZWaNKnFrZoUPVOsBxXLIhn2/yiyVAhPIUvgYIrlUIlf1upcHBz2aXwb/O3bW57qdp15
kuGnaJd5D5VTGaiVr0eFoW/FI2qLQw4lpYh+aKwfiO3syx2/iPCUMTkCQcAWKDzCLAOC9J
XeSZ+HI+zfxqrw9r7BPfMGd4ZdPXvfg6EfieJy6r4vQZxH0ElDn6Nc1AiAZ2p3uwprwlyE
9ctcBtO6DZJ/BGYqCIIzQvolDk1JAV1Edb+LPgBFpxKQc/fDSkfpm0B3z6CXO9mfUpxfCs
38JiXd+oXCLBxBcgXQoOg4j9TKIpm4MT4NbkzXAAAAAwEAAQAAAQB9HWssIAYJGyNxlMeB
fHJfzOLkctCME7ITXCEkKAMiNVIyr5CvuKnB6XsbyXC8cG/NaV7EwLGLdDpXaOHdEDcO9z
u/MLcIp2GA+x2QhAjzFy3uw+4P0CfNfVkM0n8YqOR0edTHrC5Vu0daJt19OTbPrsyeVrHf
Cdw3dHfyU/p+4IMP9NRA5ZSmYuOacC7ZoZU7xeVBpeZ4KEzrO98iIWtscncaQv4AcaAehL
VpvZWG1QmRhdbooU2ce5KH3aFKiyszcMGPMzn4aTZS14ycLFzmrMSa+nYf+nHXmyR5KmBd
A5P6ZLtcpT1xw6CC/ItRsdD7E67bugG38lgQpzloHAsRAAAAgBVKGMFi+lP+HKYdSzPAQN
n3HxVuuZ5VIjM6Rq2SxfdyGKj5PH4+ofNGBrF5j1du1oqfPypMM/B75bkBNOlzn6TQcgyX
YlsVOF31aE1hRg8eN1BH2bc1DC43MyTHgunAFzIYfs1hbX8i+cMybzXSTDsIc/xvQHkJ2w
TrPuz7+MATAAAAgQDk6e4ywxrINaOcuDKmRQxTs7rlkJk/tX59OkkqD/gYLMBRMfeKeuFD
Y8M1f5vlDkGFD/Jy0RtTfEJh02VjKTrszaaGCDFHe9tt6DAHY457tzr856zsq5hKDFEU0+
jd+yE8QaloegGrcpujrxHnrpZx/7mA2qjQxLveHyCGWH3Q2wAAAIEA41N7DKxeb0doXai7
Sl8+RpZBoyCyNkexWKHAeATKb4abd+k5/EEoLAb6aKaGMzMPm+s82l0lozVreKvHdAdZsY
fq1lhaVvnRWZhN/DXf7Akgicrg/TLqHH9w6db0Vg5A+zHmbkUzZ4A30CYIgn4vzVv5YIq3
CmfliIQWtUylhrUAAAAQdGVzdEBleGFtcGxlLmNvbQECAw==
-----END OPENSSH PRIVATE KEY-----";

    fn create_test_agent() -> (
        BitwardenDesktopAgent,
        tokio::sync::mpsc::Receiver<SshAgentUIRequest>,
        tokio::sync::broadcast::Sender<(u32, bool)>,
    ) {
        let (request_tx, request_rx) = tokio::sync::mpsc::channel::<SshAgentUIRequest>(16);
        let (response_tx, response_rx) = tokio::sync::broadcast::channel::<(u32, bool)>(16);
        let response_rx = Arc::new(Mutex::new(response_rx));

        let agent = BitwardenDesktopAgent::new(request_tx, response_rx);
        (agent, request_rx, response_tx)
    }

    #[tokio::test]
    async fn test_agent_sign_with_ed25519_key() {
        let (mut agent, _request_rx, _response_tx) = create_test_agent();
        agent.is_running.store(true, Ordering::Relaxed);

        let keys = vec![(
            TEST_ED25519_KEY.to_string(),
            "ed25519-key".to_string(),
            "ed25519-uuid".to_string(),
        )];
        agent.set_keys(keys).expect("set_keys should succeed");

        let keystore = agent.keystore.0.read().expect("RwLock is not poisoned");
        assert_eq!(keystore.len(), 1);
        let (_pub_bytes, ssh_key) = keystore.iter().next().expect("should have one key");

        // Verify the key metadata
        assert_eq!(ssh_key.name, "ed25519-key");
        assert_eq!(ssh_key.cipher_uuid, "ed25519-uuid");

        // Verify the key can sign data
        let signing_key = ssh_key.private_key().expect("should have signing key");
        let message = b"test message for ed25519";
        let signature: Signature = signing_key.try_sign(message).expect("signing should work");

        // Verify signature is non-empty and has expected algorithm
        assert!(!signature.as_bytes().is_empty());
        assert_eq!(signature.algorithm(), ssh_key::Algorithm::Ed25519);
    }

    #[tokio::test]
    async fn test_agent_sign_with_rsa_key() {
        let (mut agent, _request_rx, _response_tx) = create_test_agent();
        agent.is_running.store(true, Ordering::Relaxed);

        let keys = vec![(
            TEST_RSA_KEY.to_string(),
            "rsa-key".to_string(),
            "rsa-uuid".to_string(),
        )];
        agent.set_keys(keys).expect("set_keys should succeed");

        let keystore = agent.keystore.0.read().expect("RwLock is not poisoned");
        assert_eq!(keystore.len(), 1);
        let (_pub_bytes, ssh_key) = keystore.iter().next().expect("should have one key");

        // Verify the key metadata
        assert_eq!(ssh_key.name, "rsa-key");
        assert_eq!(ssh_key.cipher_uuid, "rsa-uuid");

        // Verify the key can sign data
        let signing_key = ssh_key.private_key().expect("should have signing key");
        let message = b"test message for rsa";
        let signature: Signature = signing_key.try_sign(message).expect("signing should work");

        // Verify signature is non-empty and has expected algorithm
        assert!(!signature.as_bytes().is_empty());
        assert_eq!(
            signature.algorithm(),
            ssh_key::Algorithm::Rsa {
                hash: Some(ssh_key::HashAlg::Sha512)
            }
        );
    }
}
