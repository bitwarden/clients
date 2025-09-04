use std::{fmt::Formatter, ops::Deref};

use rsa::signature::SignerMut;
use ssh_encoding::Encode;
use ssh_key::{
    private::{Ed25519Keypair, RsaKeypair},
    PublicKey, Signature, SshSig,
};
use std::fmt::Debug;

pub(crate) trait Agent: Send + Sync {
    async fn list_keys(&self) -> Result<Vec<SshKeyPair>, anyhow::Error>;
    async fn get_private_key(
        &self,
        public_key: SshPublicKey,
    ) -> Result<Option<SshPrivateKey>, anyhow::Error> {
        let keys = self.list_keys().await?;
        for key in keys {
            if key.public_key == public_key {
                return Ok(Some(key.private_key));
            }
        }
        Ok(None)
    }
}

#[derive(Debug, Clone)]
pub struct SshKeyPair {
    pub public_key: SshPublicKey,
    pub name: String,
    // OpenSSH PEM
    pub private_key: SshPrivateKey,
}

impl SshKeyPair {
    pub fn new(private_key: SshPrivateKey, name: String) -> Self {
        SshKeyPair {
            public_key: private_key.public_key(),
            name,
            private_key,
        }
    }
}

pub struct SshSignature(Signature);
impl SshSignature {
    pub(crate) fn encode(&self) -> Result<Vec<u8>, ssh_encoding::Error> {
        let mut buffer = Vec::new();
        self.0.algorithm().as_str().encode(&mut buffer)?;
        self.0.as_bytes().encode(&mut buffer)?;
        Ok(buffer)
    }
}

impl Deref for SshPublicKey {
    type Target = Vec<u8>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[allow(unused)]
pub enum RsaSigningScheme {
    Pkcs1v15Sha512,
    Pkcs1v15Sha256,
    Pkcs1v15Sha1,
}

#[derive(Clone)]
pub enum SshPrivateKey {
    Ed25519(Ed25519Keypair),
    Rsa(RsaKeypair),
}

impl Debug for SshPrivateKey {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            SshPrivateKey::Ed25519(_key) => write!(f, "Ed25519()"),
            SshPrivateKey::Rsa(_key) => write!(f, "Rsa()"),
        }
    }
}

impl SshPrivateKey {
    fn public_key(&self) -> SshPublicKey {
        let private_key = match self {
            SshPrivateKey::Ed25519(key) => ssh_key::private::PrivateKey::from(key.clone()),
            SshPrivateKey::Rsa(key) => ssh_key::private::PrivateKey::from(key.clone()),
        };

        private_key
            .public_key()
            .to_bytes()
            .map(SshPublicKey)
            .expect("Key is always valid")
    }

    pub(crate) fn sign(
        &self,
        data: &[u8],
        _scheme: RsaSigningScheme,
    ) -> Result<SshSignature, anyhow::Error> {
        Ok(match self {
            SshPrivateKey::Ed25519(key) => key.clone().try_sign(data)?,
            SshPrivateKey::Rsa(key) => {
                // Note: This signs with sha512. This is not supported on all servers and needs
                // an update once ssh-key 0.7.0 releases which adds support for other signing types.
                key.clone().try_sign(data)?
            }
        })
        .map(SshSignature)
    }
}

impl TryFrom<String> for SshPrivateKey {
    type Error = anyhow::Error;

    fn try_from(pem: String) -> Result<Self, Self::Error> {
        let parsed_key = parse_key_safe(&pem)?;
        Self::try_from(parsed_key)
    }
}

impl TryFrom<ssh_key::private::PrivateKey> for SshPrivateKey {
    type Error = anyhow::Error;

    fn try_from(key: ssh_key::private::PrivateKey) -> Result<Self, Self::Error> {
        match key.algorithm() {
            ssh_key::Algorithm::Ed25519 => {
                Ok(Self::Ed25519(key.key_data().ed25519().unwrap().to_owned()))
            }
            ssh_key::Algorithm::Rsa { hash: _ } => {
                Ok(Self::Rsa(key.key_data().rsa().unwrap().to_owned()))
            }
            _ => Err(anyhow::anyhow!("Unsupported key type")),
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SshPublicKey(Vec<u8>);

impl From<Vec<u8>> for SshPublicKey {
    fn from(bytes: Vec<u8>) -> Self {
        SshPublicKey(bytes)
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
    keys: Vec<SshKeyPair>,
}

#[cfg(test)]
impl TestAgent {
    pub fn new() -> Self {
        let private_key = SshPrivateKey::try_from(PRIVATE_ED25519_KEY.to_string())
            .expect("Test key is always valid");
        let keys = vec![SshKeyPair {
            public_key: private_key.public_key(),
            name: "test-key".into(),
            private_key: private_key,
        }];
        Self { keys }
    }
}

#[cfg(test)]
impl Agent for TestAgent {
    async fn list_keys(&self) -> Result<Vec<SshKeyPair>, anyhow::Error> {
        Ok(self.keys.clone())
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
