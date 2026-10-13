use std::path::Path;

use anyhow::{anyhow, Result};
use tracing::{debug, info};
use verifysign::CodeSignVerifier;

use crate::config::ENABLE_SIGNATURE_VALIDATION;

pub const EXPECTED_SIGNATURE_SHA256_THUMBPRINT: &str =
    "e8496f9940c5ee64c60ff1a87235af3760dedae6b067e027c61e2862a73f61b2";

pub fn verify_signature(path: &Path) -> Result<bool> {
    if !ENABLE_SIGNATURE_VALIDATION {
        info!(
            "Signature validation is disabled. Skipping verification for: {}",
            path.display()
        );
        return Ok(true);
    }

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
