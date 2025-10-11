use std::fmt::Debug;
use std::fmt::Formatter;

use base64::prelude::BASE64_STANDARD;
use base64::Engine as _;
use rsa::Pkcs1v15Sign;
use ssh_key::private::KeypairData;
use ssh_key::{Algorithm, EcdsaCurve, HashAlg};

use rsa::sha2::{self, Digest};
use signature::Signer;
use ssh_encoding::Encode;
use ssh_key::private::{EcdsaKeypair, Ed25519Keypair, RsaKeypair};

use crate::ssh_agent::protocol::requests::read_bytes;

/// A named SSH key pair consisting of a public and private key, and a name (comment).
#[derive(Debug, Clone)]
pub struct KeyPair {
    private_key: PrivateKey,
    public_key: PublicKey,
    name: String,
}

impl KeyPair {
    pub fn new(private_key: PrivateKey, name: String) -> Self {
        KeyPair {
            public_key: private_key.public_key(),
            private_key,
            name,
        }
    }

    pub fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn private_key(&self) -> &PrivateKey {
        &self.private_key
    }
}

/// A detached SSH signature, containing the signature scheme and blob.
pub struct Signature(ssh_key::Signature);

impl Signature {
    pub(crate) fn encode(&self) -> Result<Vec<u8>, ssh_encoding::Error> {
        let mut buffer = Vec::new();
        self.0.algorithm().as_str().encode(&mut buffer)?;
        self.0.as_bytes().encode(&mut buffer)?;
        Ok(buffer)
    }

    pub(crate) fn verify(
        &self,
        public_key: &PublicKey,
        data: &[u8],
    ) -> Result<bool, anyhow::Error> {
        let public_key_parsed =
            ssh_key::PublicKey::from_bytes(public_key.blob()).map_err(|e| anyhow::anyhow!(e))?;

        match self.0.algorithm() {
            Algorithm::Ed25519 => {
                let verifying_key = public_key_parsed
                    .key_data()
                    .ed25519()
                    .ok_or(anyhow::anyhow!("Public key is not Ed25519"))?;
                let signature = &ed25519_dalek::Signature::from_slice(self.0.as_bytes())?;
                ed25519_dalek::VerifyingKey::from_bytes(&verifying_key.0)
                    .map_err(|e| anyhow::anyhow!("Failed to parse Ed25519 key: {e}"))?
                    .verify_strict(data, signature)?;
                return Ok(true);
            }
            Algorithm::Rsa { hash: Some(alg) } => {
                let verifying_key: Result<rsa::RsaPublicKey, _> = public_key_parsed
                    .key_data()
                    .rsa()
                    .ok_or(anyhow::anyhow!("Public key is not RSA"))?
                    .try_into();
                let verifying_key =
                    verifying_key.map_err(|e| anyhow::anyhow!("Failed to parse RSA key: {e}"))?;

                match alg {
                    HashAlg::Sha256 => verifying_key.verify(
                        Pkcs1v15Sign::new::<sha2::Sha256>(),
                        sha2::Sha256::digest(data).as_slice(),
                        self.0.as_bytes(),
                    ),
                    HashAlg::Sha512 => verifying_key.verify(
                        Pkcs1v15Sign::new::<sha2::Sha512>(),
                        sha2::Sha512::digest(data).as_slice(),
                        self.0.as_bytes(),
                    ),
                    _ => return Ok(false),
                }
                .map_err(|e| anyhow::anyhow!("RSA signature verification failed: {e}"))?;
                return Ok(true);
            }
            Algorithm::Ecdsa { curve } => {
                let sec1_bytes = public_key_parsed
                    .key_data()
                    .ecdsa()
                    .unwrap()
                    .as_sec1_bytes();
                match curve {
                    EcdsaCurve::NistP256 => {
                        use p256::ecdsa::signature::Verifier;
                        p256::ecdsa::VerifyingKey::from_sec1_bytes(sec1_bytes)?
                            .verify(
                                data,
                                &p256::ecdsa::Signature::from_slice(self.0.as_bytes())?,
                            )
                            .map_err(|e| {
                                anyhow::anyhow!("ECDSA P-256 signature verification failed: {e}")
                            })?;
                        return Ok(true);
                    }
                    EcdsaCurve::NistP384 => {
                        use p384::ecdsa::signature::Verifier;
                        p384::ecdsa::VerifyingKey::from_sec1_bytes(sec1_bytes)?
                            .verify(
                                data,
                                &p384::ecdsa::Signature::from_slice(self.0.as_bytes())?,
                            )
                            .map_err(|e| {
                                anyhow::anyhow!("ECDSA P-384 signature verification failed: {e}")
                            })?;
                        return Ok(true);
                    }
                    EcdsaCurve::NistP521 => {
                        use p521::ecdsa::signature::Verifier;
                        p521::ecdsa::VerifyingKey::from_sec1_bytes(sec1_bytes)?
                            .verify(
                                data,
                                &p521::ecdsa::Signature::from_slice(self.0.as_bytes())?,
                            )
                            .map_err(|e| {
                                anyhow::anyhow!("ECDSA P-521 signature verification failed: {e}")
                            })?;
                        return Ok(true);
                    }
                    _ => return Ok(false),
                }
            }
            _ => return Ok(false),
        }
    }
}

impl Debug for Signature {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "SshSignature(\"{} {}\")",
            self.0.algorithm().as_str(),
            BASE64_STANDARD.encode(self.0.as_bytes())
        )
    }
}

impl TryFrom<&[u8]> for Signature {
    type Error = anyhow::Error;
    fn try_from(bytes: &[u8]) -> Result<Self, Self::Error> {
        let mut buffer = bytes;
        let alg = Algorithm::new(
            &String::from_utf8_lossy(read_bytes(&mut buffer).unwrap().as_slice()).to_string(),
        )?;
        let sig = read_bytes(&mut buffer).unwrap();
        Ok(Signature(ssh_key::Signature::new(alg, sig)?))
    }
}

pub(super) struct SessionId(Vec<u8>);

impl From<Vec<u8>> for SessionId {
    fn from(v: Vec<u8>) -> Self {
        SessionId(v)
    }
}

impl Debug for SessionId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "SessionId(\"{}\")", BASE64_STANDARD.encode(&self.0))
    }
}

#[allow(unused)]
pub enum RsaSigningScheme {
    Pkcs1v15Sha512,
    Pkcs1v15Sha256,
    // Sha1 is not supported because it is deprecated
}

impl RsaSigningScheme {
    fn to_hash_alg(&self) -> HashAlg {
        match self {
            RsaSigningScheme::Pkcs1v15Sha512 => HashAlg::Sha512,
            RsaSigningScheme::Pkcs1v15Sha256 => HashAlg::Sha256,
        }
    }
}

#[derive(Clone)]
pub enum PrivateKey {
    Ed25519(Ed25519Keypair),
    Rsa(RsaKeypair),
    Ecdsa(EcdsaKeypair),
}

impl Debug for PrivateKey {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            PrivateKey::Ed25519(_key) => write!(f, "Ed25519()"),
            PrivateKey::Rsa(_key) => write!(f, "Rsa()"),
            PrivateKey::Ecdsa(_key) => write!(f, "Ecdsa()"),
        }
    }
}

impl PrivateKey {
    fn public_key(&self) -> PublicKey {
        let private_key = match self {
            PrivateKey::Ed25519(key) => ssh_key::private::PrivateKey::from(key.clone()),
            PrivateKey::Rsa(key) => ssh_key::private::PrivateKey::from(key.clone()),
            PrivateKey::Ecdsa(key) => ssh_key::private::PrivateKey::from(key.clone()),
        };

        private_key
            .public_key()
            .to_bytes()
            .map(PublicKey::try_from)
            .expect("Key is always valid")
            .expect("Key is always valid")
    }

    pub(crate) fn sign(
        &self,
        data: &[u8],
        scheme: Option<RsaSigningScheme>,
    ) -> Result<Signature, anyhow::Error> {
        let private_key = match self {
            PrivateKey::Ed25519(key) => ssh_key::private::PrivateKey::from(key.clone()),
            PrivateKey::Rsa(key) => ssh_key::private::PrivateKey::from(key.clone()),
            PrivateKey::Ecdsa(key) => ssh_key::private::PrivateKey::from(key.clone()),
        };
        let result: Result<ssh_key::Signature, _> =
            if let KeypairData::Rsa(keypair) = private_key.key_data() {
                (keypair, scheme.map(|s| s.to_hash_alg())).try_sign(data)
            } else {
                private_key.try_sign(data)
            };
        result.map(Signature).map_err(|e| anyhow::anyhow!(e))
    }
}

impl TryFrom<String> for PrivateKey {
    type Error = anyhow::Error;

    fn try_from(pem: String) -> Result<Self, Self::Error> {
        let parsed_key = parse_key_safe(&pem)?;
        Self::try_from(parsed_key)
    }
}

impl TryFrom<ssh_key::private::PrivateKey> for PrivateKey {
    type Error = anyhow::Error;

    fn try_from(key: ssh_key::private::PrivateKey) -> Result<Self, Self::Error> {
        match key.algorithm() {
            ssh_key::Algorithm::Ed25519 => {
                Ok(Self::Ed25519(key.key_data().ed25519().unwrap().to_owned()))
            }
            ssh_key::Algorithm::Rsa { hash: _ } => {
                Ok(Self::Rsa(key.key_data().rsa().unwrap().to_owned()))
            }
            ssh_key::Algorithm::Ecdsa { curve: _ } => {
                Ok(Self::Ecdsa(key.key_data().ecdsa().unwrap().to_owned()))
            }
            _ => Err(anyhow::anyhow!("Unsupported key type")),
        }
    }
}

#[derive(Clone, PartialEq)]
pub struct PublicKey {
    alg: String,
    blob: Vec<u8>,
}

impl PublicKey {
    pub(super) fn encode(
        &self,
        writer: &mut impl ssh_encoding::Writer,
    ) -> Result<(), ssh_encoding::Error> {
        self.alg().as_bytes().encode(writer)?;
        self.blob().encode(writer)
    }
    fn try_read_from(mut bytes: &[u8]) -> Result<Self, anyhow::Error> {
        let alg = String::from_utf8_lossy(read_bytes(&mut bytes)?.as_slice()).to_string();
        let blob = read_bytes(&mut bytes)?;
        Ok(PublicKey { alg, blob })
    }
}

impl TryFrom<PublicKey> for ssh_key::PublicKey {
    type Error = anyhow::Error;
    fn try_from(key: PublicKey) -> Result<Self, Self::Error> {
        ssh_key::PublicKey::from_bytes(&key.blob).map_err(|e| anyhow::anyhow!(e))
    }
}

impl TryFrom<Vec<u8>> for PublicKey {
    type Error = anyhow::Error;
    fn try_from(bytes: Vec<u8>) -> Result<Self, Self::Error> {
        PublicKey::try_read_from(&bytes)
    }
}

impl Debug for PublicKey {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "SshPublicKey(\"{} {}\")", self.alg(), self.blob_b64())
    }
}

impl PublicKey {
    fn alg(&self) -> &str {
        &self.alg
    }

    fn blob(&self) -> &[u8] {
        &self.blob
    }

    fn blob_b64(&self) -> String {
        BASE64_STANDARD.encode(self.blob())
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
