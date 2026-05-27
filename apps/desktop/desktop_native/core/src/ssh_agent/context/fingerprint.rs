//! SHA256 host-key fingerprint formatting.

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use sha2::{Digest, Sha256};

/// Format raw SSH host-public-key bytes as the canonical
/// `SHA256:<base64nopad>` fingerprint. Returns `None` when `bytes` is empty.
pub fn sha256(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }
    let digest = Sha256::digest(bytes);
    let encoded = STANDARD_NO_PAD.encode(digest);
    Some(format!("SHA256:{encoded}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_bytes_returns_none() {
        assert!(sha256(&[]).is_none());
    }

    #[test]
    fn known_input_produces_canonical_format() {
        // SHA256("hello") = LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ
        let out = sha256(b"hello").unwrap();
        assert_eq!(out, "SHA256:LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ");
    }

    #[test]
    fn no_trailing_padding() {
        let out = sha256(b"hello").unwrap();
        assert!(!out.ends_with('='));
    }
}
