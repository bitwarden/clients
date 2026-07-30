use anyhow::{anyhow, Result};
use std::path::Path;
use tracing::{debug, info};
use verifysign::CodeSignVerifier;

pub const EXPECTED_SIGNATURE_SHA256_THUMBPRINT: &str =
    "9f6680c4720dbf66d1cb8ed6e328f58e42523badc60d138c7a04e63af14ea40d";

pub fn verify_signature(path: &Path) -> Result<bool> {
    info!("verifying signature of: {}", path.display());

    let verifier = CodeSignVerifier::for_file(path)
        .map_err(|e| anyhow!("verifysign init failed for {}: {:?}", path.display(), e))?;

    let signature = verifier
        .verify()
        .map_err(|e| anyhow!("verifysign verify failed for {}: {:?}", path.display(), e))?;

    // Dump signature fields for debugging/inspection
    debug!("Signature fields:");
    debug!("  Subject Name: {:?}", signature.subject_name());
    debug!("  Issuer Name: {:?}", signature.issuer_name());
    debug!("  SHA1 Thumbprint: {:?}", signature.sha1_thumbprint());
    debug!("  SHA256 Thumbprint: {:?}", signature.sha256_thumbprint());
    debug!("  Serial Number: {:?}", signature.serial());

    Ok(signature.sha256_thumbprint() == EXPECTED_SIGNATURE_SHA256_THUMBPRINT)
}
