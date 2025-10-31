use std::fmt::Debug;
use std::fmt::Display;
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

use crate::protocol::requests::read_bytes;

#[derive(Clone)]
pub struct PublicKeyWithName {
    pub key: PublicKey,
    pub name: String,
}

impl PublicKeyWithName {
    pub fn new(key: PublicKey, name: String) -> Self {
        Self { key, name }
    }
}

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
        let public_key_parsed = ssh_key::PublicKey::from_openssh(&public_key.to_string())
            .map_err(|e| anyhow::anyhow!("Failed to parse public key: {e}"))?;

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
                Ok(true)
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
                Ok(true)
            }
            Algorithm::Ecdsa { curve } => {
                let sec1_bytes = public_key_parsed
                    .key_data()
                    .ecdsa()
                    .ok_or(anyhow::anyhow!("Ecdsa key failed to parse"))?
                    .as_sec1_bytes();
                match curve {
                    EcdsaCurve::NistP256 => {
                        use p256::ecdsa::signature::Verifier;
                        let mut buf = self.0.as_bytes();
                        let r = read_bytes(&mut buf)?;
                        let s = read_bytes(&mut buf)?;
                        let r = if r.len() == 33 { &r[1..] } else { &r };
                        p256::ecdsa::VerifyingKey::from_sec1_bytes(sec1_bytes)?
                            .verify(
                                data,
                                &p256::ecdsa::Signature::from_scalars(
                                    p256::FieldBytes::clone_from_slice(r),
                                    p256::FieldBytes::clone_from_slice(&s),
                                )?,
                            )
                            .map_err(|e| {
                                anyhow::anyhow!("ECDSA P-256 signature verification failed: {e}")
                            })?;
                        Ok(true)
                    }
                    EcdsaCurve::NistP384 => {
                        use p384::ecdsa::signature::Verifier;
                        let mut buf = self.0.as_bytes();
                        let r = read_bytes(&mut buf)?;
                        let s = read_bytes(&mut buf)?;
                        let r = if r.len() == 49 { &r[1..] } else { &r };
                        p384::ecdsa::VerifyingKey::from_sec1_bytes(sec1_bytes)?
                            .verify(
                                data,
                                &p384::ecdsa::Signature::from_scalars(
                                    p384::FieldBytes::clone_from_slice(r),
                                    p384::FieldBytes::clone_from_slice(&s),
                                )?,
                            )
                            .map_err(|e| {
                                anyhow::anyhow!("ECDSA P-384 signature verification failed: {e}")
                            })?;
                        Ok(true)
                    }
                    EcdsaCurve::NistP521 => {
                        use p521::ecdsa::signature::Verifier;
                        let mut buf = self.0.as_bytes();
                        let r = read_bytes(&mut buf)?;
                        let s = read_bytes(&mut buf)?;
                        let r = if r.len() == 67 { &r[1..] } else { &r };
                        p521::ecdsa::VerifyingKey::from_sec1_bytes(sec1_bytes)?
                            .verify(
                                data,
                                &p521::ecdsa::Signature::from_scalars(
                                    p521::FieldBytes::clone_from_slice(r),
                                    p521::FieldBytes::clone_from_slice(&s),
                                )?,
                            )
                            .map_err(|e| {
                                anyhow::anyhow!("ECDSA P-521 signature verification failed: {e}")
                            })?;
                        Ok(true)
                    }
                }
            }
            _ => Ok(false),
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
        let alg =
            Algorithm::new(String::from_utf8_lossy(read_bytes(&mut buffer)?.as_slice()).as_ref())?;
        let sig = read_bytes(&mut buffer)?;
        Ok(Signature(ssh_key::Signature::new(alg, sig)?))
    }
}

#[derive(Clone)]
pub struct SessionId(Vec<u8>);

impl From<SessionId> for Vec<u8> {
    fn from(sid: SessionId) -> Self {
        sid.0
    }
}

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
            PrivateKey::Ed25519(key) => ssh_key::private::PrivateKey::from(key.to_owned()),
            PrivateKey::Rsa(key) => ssh_key::private::PrivateKey::from(key.to_owned()),
            PrivateKey::Ecdsa(key) => ssh_key::private::PrivateKey::from(key.to_owned()),
        };

        let pubkey_bytes = private_key
            .public_key()
            .to_bytes()
            .expect("Converting to public key bytes should always be possible");
        let alg_str = private_key.algorithm();

        PublicKey::try_from(format!(
            "{} {}",
            alg_str.as_str(),
            BASE64_STANDARD.encode(&pubkey_bytes)
        ))
        .expect("Parsing public key should always be possible")
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
            ssh_key::Algorithm::Ed25519 => Ok(Self::Ed25519(
                key.key_data()
                    .ed25519()
                    .ok_or(anyhow::anyhow!("Failed to parse ed25519 key"))?
                    .to_owned(),
            )),
            ssh_key::Algorithm::Rsa { hash: _ } => Ok(Self::Rsa(
                key.key_data()
                    .rsa()
                    .ok_or(anyhow::anyhow!("Failed to parse RSA key"))?
                    .to_owned(),
            )),
            ssh_key::Algorithm::Ecdsa { curve: _ } => Ok(Self::Ecdsa(
                key.key_data()
                    .ecdsa()
                    .ok_or(anyhow::anyhow!("Failed to parse ECDSA key"))?
                    .to_owned(),
            )),
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
        self.blob().encode(writer)?;
        Ok(())
    }
    fn try_read_from(mut bytes: &[u8]) -> Result<Self, anyhow::Error> {
        let alg = String::from_utf8_lossy(read_bytes(&mut bytes)?.as_slice()).to_string();
        let blob = read_bytes(&mut bytes)?;
        Ok(PublicKey { alg, blob })
    }

    pub fn try_from_blob(blob: Vec<u8>) -> Result<Self, anyhow::Error> {
        // Parse the blob to extract the algorithm
        let mut bytes = &blob[..];
        let alg = String::from_utf8_lossy(
            read_bytes(&mut bytes)
                .map_err(|e| anyhow::anyhow!("Failed to read algorithm from blob: {e}"))?
                .as_slice(),
        )
        .to_string();
        Ok(PublicKey { alg, blob })
    }
}

impl Display for PublicKey {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}", self.alg(), BASE64_STANDARD.encode(self.blob()))
    }
}

impl TryFrom<Vec<u8>> for PublicKey {
    type Error = anyhow::Error;
    fn try_from(bytes: Vec<u8>) -> Result<Self, Self::Error> {
        PublicKey::try_read_from(&bytes)
    }
}

impl TryFrom<String> for PublicKey {
    type Error = anyhow::Error;
    fn try_from(s: String) -> Result<Self, Self::Error> {
        // split by space
        let parts: Vec<&str> = s.split_whitespace().collect();
        if parts.len() < 2 {
            return Err(anyhow::anyhow!("Invalid public key format"));
        }

        let alg = parts[0].to_string();

        let blob_b64 = parts[1];
        let blob = BASE64_STANDARD
            .decode(blob_b64)
            .map_err(|e| anyhow::anyhow!("Failed to decode base64: {e}"))?;
        Ok(PublicKey { alg, blob })
    }
}

impl Debug for PublicKey {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "SshPublicKey(\"{self}\")")
    }
}

impl PublicKey {
    fn alg(&self) -> &str {
        &self.alg
    }

    fn blob(&self) -> &[u8] {
        &self.blob
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
    use super::*;

    #[test]
    fn test_public_key_try_from_string() {
        let pubkey_str = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC3F6YkV6vV8Y5Q9Y5Z5b5Z5b5Z5b5Z5b5Z5b5Z5b5Z5 user@host";
        let public_key = PublicKey::try_from(pubkey_str.to_string()).unwrap();
        assert_eq!(public_key.alg(), "ssh-ed25519");
    }

    // Test vectors are collected from authentications to GitHub's ssh service
    #[test]
    fn test_verify_sig_ed25519() {
        const PUBLIC_KEY: &str =
            "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl";
        const DATA: &str = "31OCVyEvqX0D4XBdgzOKe9MA8n/JZUEv2wWiMM0G+7I=";
        const SIGNATURE: &str = "n1PA02OSA/qsDk3XmGP7OSjizN7kTjtJ9gIvmJRBaJa0Nz2X62q0xsNKKnRXuPwsqiXKQU25jS3ytO6y2S0hAA==";

        let public_key = PublicKey::try_from(PUBLIC_KEY.to_string()).unwrap();
        let data = BASE64_STANDARD.decode(DATA).unwrap();
        let signature = BASE64_STANDARD.decode(SIGNATURE).unwrap();
        let sig = Signature(ssh_key::Signature::new(Algorithm::Ed25519, signature).unwrap());
        assert!(sig.verify(&public_key, &data).unwrap());
    }

    #[test]
    fn test_verify_sig_ecdsa() {
        let sig = "AAAAIQDz7QDHe33YhnAKbyUlwkDbe5o8qs172ycTUP4WC2GdKgAAACADT8fMBEmPuNd/cfe+Tobv70HDUmkjPqNqO0Yjsb37PQ==";
        let pubkey = "ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=";
        let data = "NEJYKAPuiPrBuEQrn/9NPiAuJ0YH6ZVq/4d01j1VrPw=";

        let public_key = PublicKey::try_from(pubkey.to_string()).unwrap();
        let data = BASE64_STANDARD.decode(data).unwrap();
        let signature = BASE64_STANDARD.decode(sig).unwrap();
        let sig = Signature(
            ssh_key::Signature::new(
                Algorithm::Ecdsa {
                    curve: EcdsaCurve::NistP256,
                },
                signature,
            )
            .unwrap(),
        );
        assert!(sig.verify(&public_key, &data).unwrap());
    }

    #[test]
    fn test_verify_sig_rsa() {
        let sig = "GWRiAWPY/L6t531C8ehA4nn/3yTVtKNjs909kY2mbvhNAeXklPJuwKBBsbrXoABBmDa8b+iwUQfZhBXdC0AB3ulN1amb35yN+4HzWoc7gY+DR22hjcqLmDbu2pq7QlTGcO0WUt2xQagZokx8tojjRydqeO8ZU7zo4uuEt+ndYubwYWFUPEgaMdMOtW4JcwqJh7VQSZUlRGfj09V1aj9I52V+BD15sth6N/yGzd91D9d2H10XcYyPtQFlwXpp7mDr7vvjEWQqqQ694Ls2q6nSwjbmychI0svS//GGQM1X6gePNyoaNqm6fD+uvZGJ2Ytl7dI7Qg37AvaUS79+VlA/n+Tq/FMQYpETpC0ZsW8nBCn/rIkzZRcwhTYoAguRIXzoVQ/owklFAU591f/PZ5PBWIrJGjnEoxgOq/88lHPfE+grREklSfucyYtLN3rCc9q0rYnbCvfBe6yuSsRW07WiOP+t24mwag3qOWvkJ/lSLNQGu92iRib0w2hX0vdT/WG7";
        let pubkey = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCj7ndNxQowgcQnjshcLrqPEiiphnt+VTTvDP6mHBL9j1aNUkY4Ue1gvwnGLVlOhGeYrnZaMgRK6+PKCUXaDbC7qtbW8gIkhL7aGCsOr/C56SJMy/BCZfxd1nWzAOxSDPgVsmerOBYfNqltV9/hWCqBywINIR+5dIg6JTJ72pcEpEjcYgXkE2YEFXV1JHnsKgbLWNlhScqb2UmyRkQyytRLtL+38TGxkxCflmO+5Z8CSSNY7GidjMIZ7Q4zMjA2n1nGrlTDkzwDCsw+wqFPGQA179cnfGWOWRVruj16z6XyvxvjJwbz0wQZ75XK5tKSb7FNyeIEs4TT4jk+S4dhPeAUC5y+bDYirYgM4GC7uEnztnZyaVWQ7B381AK4Qdrwt51ZqExKbQpTUNn+EjqoTwvqNj4kqx5QUCI0ThS/YkOxJCXmPUWZbhjpCg56i+2aB6CmK2JGhn57K5mj0MNdBXA4/WnwH6XoPWJzK5Nyu2zB3nAZp+S5hpQs+p1vN1/wsjk=";
        let data = "79oy/lj+/eUTDc07ImyQPmPvazMN1CJJfDTkAZzaqow=";

        let public_key = PublicKey::try_from(pubkey.to_string()).unwrap();
        let data = BASE64_STANDARD.decode(data).unwrap();
        let signature = BASE64_STANDARD.decode(sig).unwrap();
        let sig = Signature(
            ssh_key::Signature::new(
                Algorithm::Rsa {
                    hash: Some(HashAlg::Sha512),
                },
                signature,
            )
            .unwrap(),
        );
        assert!(sig.verify(&public_key, &data).unwrap());
    }
}
