//! `session-bind@openssh.com` extension — wire verification.

use rsa::{BigUint, Pkcs1v15Sign};
use sha2::Digest as _;
use signature::Verifier as _;
use ssh_key::{public::KeyData, Algorithm, HashAlg, Signature};
use tracing::{info, warn};

use super::protocol::{read_ssh_string, RSA_SHA2_256, RSA_SHA2_512};

/// Session-Bind state for one connection.
#[derive(Debug, Default)]
pub(super) struct SessionBindState {
    pub is_forwarding: bool,
    pub host_fingerprint: String,
}

impl SessionBindState {
    /// Parses and verifies a `session-bind@openssh.com` extension payload
    ///
    /// Returns `true` on success, `false` on any parse or verification failure — on failure
    /// the state is left unchanged.
    pub(super) fn parse_and_verify(&mut self, payload: &[u8]) -> bool {
        self.try_update(payload).is_some()
    }

    fn try_update(&mut self, payload: &[u8]) -> Option<()> {
        let (hostkey_bytes, rest) = read_ssh_string(payload)?;
        let (session_id, rest) = read_ssh_string(rest)?;
        let (sig_outer, rest) = read_ssh_string(rest)?;
        let is_forwarding = rest.first().map(|&b| b == 1).unwrap_or(false);

        // sig_outer = [string alg_name][string raw_sig_bytes]
        let (alg_bytes, sig_inner) = read_ssh_string(sig_outer)?;
        let (raw_sig, _) = read_ssh_string(sig_inner)?;
        let alg = std::str::from_utf8(alg_bytes).ok()?;

        let pub_key = ssh_key::PublicKey::from_bytes(hostkey_bytes).ok()?;
        let verified = match pub_key.key_data() {
            KeyData::Ed25519(key) => {
                let sig = Signature::new(Algorithm::Ed25519, raw_sig.to_vec()).ok()?;
                key.verify(session_id, &sig).is_ok()
            }
            KeyData::Rsa(key) => verify_rsa(key, alg, session_id, raw_sig),
            KeyData::Ecdsa(_) => {
                warn!("session-bind ECDSA host key not yet supported");
                false
            }
            _ => {
                warn!("session-bind received unknown host key type");
                false
            }
        };

        if !verified {
            warn!("session-bind failed verification");
            return None;
        }

        info!(
            fingerprint = %pub_key.fingerprint(HashAlg::Sha256),
            is_forwarding,
            "verified"
        );

        // subsequent session bind extensions can't unset is_forwarding
        if is_forwarding {
            self.is_forwarding = true;
        }
        self.host_fingerprint = pub_key.fingerprint(HashAlg::Sha256).to_string();
        Some(())
    }
}

fn verify_rsa(
    key: &ssh_key::public::RsaPublicKey,
    alg: &str,
    session_id: &[u8],
    sig: &[u8],
) -> bool {
    let Some(n) = key.n.as_positive_bytes().map(BigUint::from_bytes_be) else {
        return false;
    };
    let Some(e) = key.e.as_positive_bytes().map(BigUint::from_bytes_be) else {
        return false;
    };
    let Ok(verifying_key) = rsa::RsaPublicKey::new(n, e) else {
        return false;
    };

    match alg {
        RSA_SHA2_256 => {
            let digest = sha2::Sha256::digest(session_id);
            verifying_key
                .verify(Pkcs1v15Sign::new::<sha2::Sha256>(), digest.as_slice(), sig)
                .is_ok()
        }
        RSA_SHA2_512 => {
            let digest = sha2::Sha512::digest(session_id);
            verifying_key
                .verify(Pkcs1v15Sign::new::<sha2::Sha512>(), digest.as_slice(), sig)
                .is_ok()
        }
        _ => {
            warn!(alg, "session-bind RSA received unsupported algorithm");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use signature::Signer as _;
    use ssh_key::{
        private::{Ed25519Keypair, KeypairData, RsaKeypair},
        rand_core::OsRng,
    };

    use super::SessionBindState;
    use crate::server::test_common::{
        make_session_bind_payload_ed25519, make_session_bind_payload_rsa, write_ssh_string,
    };

    fn apply(payload: &[u8]) -> Option<SessionBindState> {
        let mut state = SessionBindState::default();
        if state.parse_and_verify(payload) {
            Some(state)
        } else {
            None
        }
    }

    #[test]
    fn valid_ed25519_not_forwarding_returns_true() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
    }

    #[test]
    fn valid_ed25519_forwarding_returns_true_and_sets_flag() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], true);
        let state = apply(&payload).unwrap();
        assert!(state.is_forwarding);
    }

    #[test]
    fn valid_rsa_sha256_returns_true() {
        let keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let payload = make_session_bind_payload_rsa(&keypair, "rsa-sha2-256", &[0x42u8; 32], false);
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
    }

    #[test]
    fn valid_rsa_sha512_returns_true() {
        let keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let payload = make_session_bind_payload_rsa(&keypair, "rsa-sha2-512", &[0x42u8; 32], false);
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
    }

    #[test]
    fn tampered_signature_bytes_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        let n = payload.len();
        payload[n - 2] ^= 0xFF;
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn wrong_key_in_hostkey_returns_false() {
        let keypair_a = Ed25519Keypair::random(&mut OsRng);
        let keypair_b = Ed25519Keypair::random(&mut OsRng);

        let session_id = [0x42u8; 32];
        let private_a =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair_a.clone()), "").unwrap();
        let hostkey_bytes = private_a.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = keypair_b.sign(&session_id);

        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, sig.algorithm().to_string().as_bytes());
        write_ssh_string(&mut sig_outer, sig.as_bytes());

        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &session_id);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(0u8);

        assert!(apply(&payload).is_none());
    }

    #[test]
    fn rsa_sha1_algorithm_returns_false() {
        let keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let payload = make_session_bind_payload_rsa(&keypair, "ssh-rsa", &[0x42u8; 32], false);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn rsa_unsupported_algorithm_returns_false() {
        let keypair = RsaKeypair::random(&mut OsRng, 2048).unwrap();
        let payload = make_session_bind_payload_rsa(&keypair, "rsa-sha2-999", &[0x42u8; 32], false);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn empty_payload_returns_false() {
        assert!(apply(&[]).is_none());
    }

    #[test]
    fn truncated_after_hostkey_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn truncated_after_session_id_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &[0x42u8; 32]);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn truncated_sig_outer_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &[0x42u8; 32]);
        payload.extend_from_slice(&100u32.to_be_bytes());
        payload.extend_from_slice(&[0u8; 5]);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn invalid_utf8_alg_name_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, &[0xFFu8, 0xFE]);
        write_ssh_string(&mut sig_outer, &[0u8; 64]);
        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &[0x42u8; 32]);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(0u8);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn non_one_byte_treated_as_not_forwarding() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        *payload.last_mut().unwrap() = 2u8;
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
    }

    #[test]
    fn missing_forwarding_byte_defaults_to_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        payload.pop();
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
    }

    #[test]
    fn host_fingerprint_populated_on_successful_verification() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        let state = apply(&payload).unwrap();
        assert!(
            state.host_fingerprint.starts_with("SHA256:"),
            "fingerprint should have SHA256: prefix, got: {}",
            state.host_fingerprint
        );
    }

    #[test]
    fn failed_verification_leaves_host_fingerprint_unchanged() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        let n = payload.len();
        payload[n - 2] ^= 0xFF; // tamper signature
        let mut state = SessionBindState::default();
        assert!(!state.parse_and_verify(&payload));
        assert!(
            state.host_fingerprint.is_empty(),
            "failed verification must not modify host_fingerprint"
        );
    }

    #[test]
    fn host_fingerprint_updates_on_rebind_with_different_key() {
        let keypair_a = Ed25519Keypair::random(&mut OsRng);
        let keypair_b = Ed25519Keypair::random(&mut OsRng);
        let mut state = SessionBindState::default();

        let payload_a = make_session_bind_payload_ed25519(&keypair_a, &[0x01u8; 32], false);
        assert!(state.parse_and_verify(&payload_a));
        let fingerprint_a = state.host_fingerprint.clone();
        assert!(!fingerprint_a.is_empty());

        let payload_b = make_session_bind_payload_ed25519(&keypair_b, &[0x02u8; 32], false);
        assert!(state.parse_and_verify(&payload_b));

        assert_ne!(
            fingerprint_a, state.host_fingerprint,
            "rebind with a different host key must update host_fingerprint"
        );
    }

    #[test]
    fn is_forwarding_latched_on_rebind() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut state = SessionBindState::default();

        let payload1 = make_session_bind_payload_ed25519(&keypair, &[0x01u8; 32], true);
        assert!(state.parse_and_verify(&payload1));
        assert!(state.is_forwarding);

        let payload2 = make_session_bind_payload_ed25519(&keypair, &[0x02u8; 32], false);
        assert!(state.parse_and_verify(&payload2));
        assert!(
            state.is_forwarding,
            "latch: is_forwarding must not be cleared by a non-forwarding rebind"
        );
    }
}
