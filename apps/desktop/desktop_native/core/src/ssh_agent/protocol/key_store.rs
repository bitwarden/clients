use crate::ssh_agent::protocol::types::{KeyPair, PrivateKey, PublicKey};

pub(crate) trait Agent: Send + Sync {
    async fn list_keys(&self) -> Result<Vec<KeyPair>, anyhow::Error>;
    async fn find_private_key(
        &self,
        public_key: &PublicKey,
    ) -> Result<Option<PrivateKey>, anyhow::Error> {
        let keys = self.list_keys().await?;
        for key in keys {
            if *key.public_key() == *public_key {
                return Ok(Some(key.private_key().to_owned()));
            }
        }
        Ok(None)
    }
}

#[cfg(test)]
const PRIVATE_ED25519_KEY: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACBDUDO7ChZIednIJxGA95T/ZTyREftahrFEJM/eeC8mmAAAAKByJoOYciaD
mAAAAAtzc2gtZWQyNTUxOQAAACBDUDO7ChZIednIJxGA95T/ZTyREftahrFEJM/eeC8mmA
AAAEBQK5JpycFzP/4rchfpZhbdwxjTwHNuGx2/kvG4i6xfp0NQM7sKFkh52cgnEYD3lP9l
PJER+1qGsUQkz954LyaYAAAAHHF1ZXh0ZW5ATWFjQm9vay1Qcm8tMTYubG9jYWwB
-----END OPENSSH PRIVATE KEY-----";

#[cfg(test)]
pub struct TestAgent {
    keys: Vec<KeyPair>,
}

#[cfg(test)]
impl TestAgent {
    pub fn new() -> Self {
        let private_key = PrivateKey::try_from(PRIVATE_ED25519_KEY.to_string())
            .expect("Test key is always valid");
        let keys = vec![KeyPair::new(private_key, "test-key".into())];
        Self { keys }
    }
}

#[cfg(test)]
impl Agent for TestAgent {
    async fn list_keys(&self) -> Result<Vec<KeyPair>, anyhow::Error> {
        Ok(self.keys.clone())
    }
}
