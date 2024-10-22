use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use ssh_key::{Algorithm, HashAlg, LineEnding};

use super::importer::SshKey;

pub async fn generate_keypair(key_algorithm: String) -> Result<SshKey, anyhow::Error> {
    // sourced from cryptographically secure entropy source, with sources for all targets: https://docs.rs/getrandom
    // if it cannot be securely sourced, this will panic instead of leading to a weak key
    let mut rng: ChaCha8Rng = ChaCha8Rng::from_entropy();

    let key = match key_algorithm.as_str() {
        "ed25519" => ssh_key::PrivateKey::random(&mut rng, Algorithm::Ed25519),
        "rsa2048" | "rsa3072" | "rsa4096" => {
            let bits = match key_algorithm.as_str() {
                "rsa2048" => 2048,
                "rsa3072" => 3072,
                "rsa4096" => 4096,
                _ => return Err(anyhow::anyhow!("Unsupported RSA key size")),
            };
            let rsa_keypair = ssh_key::private::RsaKeypair::random(&mut rng, bits)
                .or_else(|e| Err(anyhow::anyhow!(e.to_string())))?;

            let private_key = ssh_key::PrivateKey::new(
                ssh_key::private::KeypairData::from(rsa_keypair),
                "".to_string(),
            )
            .or_else(|e| Err(anyhow::anyhow!(e.to_string())))?;
            Ok(private_key)
        }
        _ => {
            return Err(anyhow::anyhow!("Unsupported key algorithm"));
        }
    }
    .or_else(|e| Err(anyhow::anyhow!(e.to_string())))?;

    let private_key_openssh = key
        .to_openssh(LineEnding::LF)
        .or_else(|e| Err(anyhow::anyhow!(e.to_string())))?;
    Ok(SshKey {
        private_key: private_key_openssh.to_string(),
        public_key: key.public_key().to_string(),
        key_fingerprint: key.fingerprint(HashAlg::Sha256).to_string(),
    })
}
