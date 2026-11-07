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

        // The forwarding flag is a required SSH `boolean` (RFC 4251 §5): zero is false, and any
        // nonzero value MUST be interpreted as true, although clients should only ever send zero
        // or one. It must be the final byte of the payload.
        let (&forwarding_byte, trailing) = rest.split_first()?;
        if !trailing.is_empty() {
            warn!("session-bind payload has trailing data");
            return None;
        }
        let is_forwarding = forwarding_byte != 0;

        // sig_outer = [string alg_name][string raw_sig_bytes]
        let (alg_bytes, sig_inner) = read_ssh_string(sig_outer)?;
        let (raw_sig, sig_trailing) = read_ssh_string(sig_inner)?;
        if !sig_trailing.is_empty() {
            warn!("session-bind signature has trailing data");
            return None;
        }
        let alg = std::str::from_utf8(alg_bytes).ok()?;

        let pub_key = ssh_key::PublicKey::from_bytes(hostkey_bytes).ok()?;
        let verified = match pub_key.key_data() {
            KeyData::Ed25519(key) => verify_ed25519(key, alg, session_id, raw_sig),
            KeyData::Rsa(key) => verify_rsa(key, alg, session_id, raw_sig),
            KeyData::Ecdsa(key) => verify_ecdsa(key, alg, session_id, raw_sig),
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

fn verify_ed25519(
    key: &ssh_key::public::Ed25519PublicKey,
    alg: &str,
    session_id: &[u8],
    sig: &[u8],
) -> bool {
    if alg != Algorithm::Ed25519.as_str() {
        warn!(alg, "session-bind Ed25519 received mismatched algorithm");
        return false;
    }
    let Ok(signature) = Signature::new(Algorithm::Ed25519, sig.to_vec()) else {
        return false;
    };
    key.verify(session_id, &signature).is_ok()
}

fn verify_ecdsa(
    key: &ssh_key::public::EcdsaPublicKey,
    alg: &str,
    session_id: &[u8],
    sig: &[u8],
) -> bool {
    // The signature algorithm must match the host key's curve.
    let key_alg = key.algorithm();
    if alg != key_alg.as_str() {
        warn!(alg, "session-bind ECDSA received mismatched algorithm");
        return false;
    }
    let Ok(signature) = Signature::new(key_alg, sig.to_vec()) else {
        return false;
    };
    key.verify(session_id, &signature).is_ok()
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
        private::{EcdsaKeypair, Ed25519Keypair, KeypairData, RsaKeypair},
        rand_core::OsRng,
        EcdsaCurve,
    };

    use super::SessionBindState;
    use crate::server::test_common::{
        make_session_bind_payload_ecdsa, make_session_bind_payload_ed25519,
        make_session_bind_payload_host_certificate, make_session_bind_payload_rsa,
        make_session_bind_payload_unsupported_host_key, write_ssh_string,
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
    fn nonzero_forwarding_byte_sets_forwarding() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        for byte in [2u8, 0x7F, 0xFF] {
            let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
            *payload.last_mut().unwrap() = byte;
            let state = apply(&payload).unwrap();
            assert!(
                state.is_forwarding,
                "nonzero boolean {byte:#x} must be treated as true"
            );
        }
    }

    #[test]
    fn zero_forwarding_byte_not_forwarding() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        assert_eq!(payload.last(), Some(&0u8));
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
    }

    #[test]
    fn missing_forwarding_byte_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], false);
        payload.pop();
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn trailing_bytes_after_forwarding_byte_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let mut payload = make_session_bind_payload_ed25519(&keypair, &[0x42u8; 32], true);
        payload.push(0u8);
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn trailing_bytes_in_signature_wrapper_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let session_id = [0x42u8; 32];
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = keypair.sign(&session_id);

        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, sig.algorithm().to_string().as_bytes());
        write_ssh_string(&mut sig_outer, sig.as_bytes());
        sig_outer.push(0u8);

        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &session_id);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(0u8);

        assert!(apply(&payload).is_none());
    }

    #[test]
    fn ed25519_wrong_length_signature_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let session_id = [0x42u8; 32];
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = keypair.sign(&session_id);

        // A valid signature truncated to 63 bytes, with the correct algorithm name.
        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, b"ssh-ed25519");
        write_ssh_string(&mut sig_outer, &sig.as_bytes()[..63]);

        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &session_id);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(1u8);

        assert!(apply(&payload).is_none());
    }

    #[test]
    fn ed25519_alg_mismatch_returns_false() {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let session_id = [0x42u8; 32];
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = keypair.sign(&session_id);

        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, b"rsa-sha2-256");
        write_ssh_string(&mut sig_outer, sig.as_bytes());

        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &session_id);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(0u8);

        assert!(apply(&payload).is_none());
    }

    #[test]
    fn valid_ecdsa_forwarding_sets_flag_and_fingerprint_all_curves() {
        for curve in [
            EcdsaCurve::NistP256,
            EcdsaCurve::NistP384,
            EcdsaCurve::NistP521,
        ] {
            let keypair = EcdsaKeypair::random(&mut OsRng, curve).unwrap();
            let payload = make_session_bind_payload_ecdsa(&keypair, &[0x42u8; 32], true);
            let state =
                apply(&payload).unwrap_or_else(|| panic!("{curve:?} session-bind should verify"));
            assert!(state.is_forwarding, "{curve:?} should set is_forwarding");

            let expected = ssh_key::PublicKey::from(ssh_key::public::KeyData::Ecdsa(
                ssh_key::public::EcdsaPublicKey::from(&keypair),
            ))
            .fingerprint(ssh_key::HashAlg::Sha256)
            .to_string();
            assert_eq!(state.host_fingerprint, expected, "{curve:?} fingerprint");
        }
    }

    #[test]
    fn valid_ecdsa_not_forwarding_returns_true() {
        let keypair = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let payload = make_session_bind_payload_ecdsa(&keypair, &[0x42u8; 32], false);
        let state = apply(&payload).unwrap();
        assert!(!state.is_forwarding);
        assert!(state.host_fingerprint.starts_with("SHA256:"));
    }

    #[test]
    fn ecdsa_tampered_signature_returns_false() {
        for curve in [
            EcdsaCurve::NistP256,
            EcdsaCurve::NistP384,
            EcdsaCurve::NistP521,
        ] {
            let keypair = EcdsaKeypair::random(&mut OsRng, curve).unwrap();
            let mut payload = make_session_bind_payload_ecdsa(&keypair, &[0x42u8; 32], false);
            let n = payload.len();
            payload[n - 2] ^= 0x01; // last byte of the `s` mpint
            assert!(
                apply(&payload).is_none(),
                "{curve:?} tampered signature must fail"
            );
        }
    }

    #[test]
    fn ecdsa_malformed_signature_encoding_returns_false() {
        // The algorithm name matches the P-256 host key, but the signature blob is not a valid
        // `mpint r || mpint s` encoding: an empty blob, `r` wider than the curve's field, and a
        // well-formed pair followed by trailing bytes.
        let keypair = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let session_id = [0x42u8; 32];
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ecdsa(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let valid_sig: ssh_key::Signature = keypair.sign(&session_id);

        let mut oversized_r = Vec::new();
        write_ssh_string(&mut oversized_r, &[0x01u8; 40]);
        write_ssh_string(&mut oversized_r, &[0x01u8; 32]);

        let mut trailing = valid_sig.as_bytes().to_vec();
        trailing.push(0u8);

        for raw_sig in [Vec::new(), oversized_r, trailing] {
            let mut sig_outer = Vec::new();
            write_ssh_string(&mut sig_outer, b"ecdsa-sha2-nistp256");
            write_ssh_string(&mut sig_outer, &raw_sig);

            let mut payload = Vec::new();
            write_ssh_string(&mut payload, &hostkey_bytes);
            write_ssh_string(&mut payload, &session_id);
            write_ssh_string(&mut payload, &sig_outer);
            payload.push(1u8);

            assert!(apply(&payload).is_none());
        }
    }

    #[test]
    fn ecdsa_wrong_session_id_returns_false() {
        let keypair = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let mut payload = make_session_bind_payload_ecdsa(&keypair, &[0x42u8; 32], false);
        // session_id follows the host key string; flip its first byte.
        let hostkey_len = u32::from_be_bytes(payload[0..4].try_into().unwrap()) as usize;
        payload[4 + hostkey_len + 4] ^= 0xFF;
        assert!(apply(&payload).is_none());
    }

    #[test]
    fn ecdsa_wrong_key_returns_false() {
        let keypair_a = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let keypair_b = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let session_id = [0x42u8; 32];

        let private_a =
            ssh_key::PrivateKey::new(KeypairData::Ecdsa(keypair_a.clone()), "").unwrap();
        let hostkey_bytes = private_a.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = keypair_b.sign(&session_id);

        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, sig.algorithm().as_str().as_bytes());
        write_ssh_string(&mut sig_outer, sig.as_bytes());

        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &session_id);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(0u8);

        assert!(apply(&payload).is_none());
    }

    // The signature's algorithm name must match the host key's curve. A valid P-256 signature
    // is used so that only the name check can reject it: `ecdsa_curve_mismatch_returns_false`
    // uses a real P-384 signature, which is too wide for P-256 and fails to parse with or without
    // the check.
    #[test]
    fn ecdsa_mislabelled_algorithm_returns_false() {
        let keypair = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let session_id = [0x42u8; 32];
        let private_key =
            ssh_key::PrivateKey::new(KeypairData::Ecdsa(keypair.clone()), "").unwrap();
        let hostkey_bytes = private_key.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = keypair.sign(&session_id);

        let payload_with_label = |label: &str| {
            let mut sig_outer = Vec::new();
            write_ssh_string(&mut sig_outer, label.as_bytes());
            write_ssh_string(&mut sig_outer, sig.as_bytes());

            let mut payload = Vec::new();
            write_ssh_string(&mut payload, &hostkey_bytes);
            write_ssh_string(&mut payload, &session_id);
            write_ssh_string(&mut payload, &sig_outer);
            payload.push(0u8);
            payload
        };

        // Control: with the correct name the same signature verifies, so the rejections below can
        // only come from the name check.
        assert!(apply(&payload_with_label("ecdsa-sha2-nistp256")).is_some());

        for label in ["ecdsa-sha2-nistp384", "ecdsa-sha2-nistp521", "ssh-ed25519"] {
            assert!(
                apply(&payload_with_label(label)).is_none(),
                "a P-256 signature labelled {label} must be rejected"
            );
        }
    }

    #[test]
    fn ecdsa_curve_mismatch_returns_false() {
        // Host key is P-256 but the signature claims (and is) P-384.
        let host = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP256).unwrap();
        let signer = EcdsaKeypair::random(&mut OsRng, EcdsaCurve::NistP384).unwrap();
        let session_id = [0x42u8; 32];

        let private_host = ssh_key::PrivateKey::new(KeypairData::Ecdsa(host.clone()), "").unwrap();
        let hostkey_bytes = private_host.public_key().to_bytes().unwrap();
        let sig: ssh_key::Signature = signer.sign(&session_id);

        let mut sig_outer = Vec::new();
        write_ssh_string(&mut sig_outer, sig.algorithm().as_str().as_bytes());
        write_ssh_string(&mut sig_outer, sig.as_bytes());

        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &hostkey_bytes);
        write_ssh_string(&mut payload, &session_id);
        write_ssh_string(&mut payload, &sig_outer);
        payload.push(0u8);

        assert!(apply(&payload).is_none());
    }

    /// An ECDSA host-key signature made by OpenSSH rather than `ssh-key`. All fields are base64.
    ///
    /// Generated with `ssh-keygen -Y sign -O hashalg=sha256 -n file`, which signs with
    /// `sshkey_sign`, the same routine `sshd` uses for host-key signatures. `signed` is the exact
    /// byte string OpenSSH signed (an SSHSIG preamble). It stands in for the session ID, which the
    /// agent treats as opaque bytes.
    struct OpensshVector {
        curve: &'static str,
        /// Host key blob: the base64 field of the `.pub` file.
        host_key: &'static str,
        /// The bytes OpenSSH signed.
        signed: &'static str,
        /// OpenSSH signature blob: `string alg || string (mpint r || mpint s)`.
        signature: &'static str,
        /// `ssh-keygen -l -E sha256` output for the host key.
        fingerprint: &'static str,
    }

    // Every other ECDSA test signs and verifies with `ssh-key`, so a bug shared by both sides
    // (wrong hash, wrong mpint handling) would still pass them. These vectors come from OpenSSH
    // and catch that, e.g. after an `ssh-key` upgrade. Each signature was picked so that one of
    // `r`/`s` needs a leading zero byte and the other is shorter than the field, so the verifier
    // must zero-pad it.
    const OPENSSH_ECDSA_VECTORS: [OpensshVector; 3] = [
        OpensshVector {
            curve: "nistp256",
            host_key: concat!(
                "AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBP8Eyp5KWYvR07vyKN+sb/tn",
                "yR9LZUXqqqJ9PLF3S3CHf6C413im/Q/Q5NqFjGA1RpQ9irEVveyeSoTzrH/Rz2s=",
            ),
            signed: concat!(
                "U1NIU0lHAAAABGZpbGUAAAAAAAAABnNoYTI1NgAAACBDwXy/MyFhCwMTW4tUuV2DnI4FwgTZ1FJU",
                "oqnPCpTFDg==",
            ),
            signature: concat!(
                "AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAABIAAAAIQDQWju/RXNT1o5ID2f4VJFzA2Kd8ooQxKjv",
                "E95E0EOg9wAAAB9J7P721zPoHcQrgFJzIxRnV2W/XEQ4nVCPkXlvSveO",
            ),
            fingerprint: "SHA256:spqfXZMusv/KBn7dnzIVHpVGEM/v+2edlzzEALuET3g",
            // r has a leading zero byte (33 bytes); s is shorter than the field (31 of 32 bytes)
        },
        OpensshVector {
            curve: "nistp384",
            host_key: concat!(
                "AAAAE2VjZHNhLXNoYTItbmlzdHAzODQAAAAIbmlzdHAzODQAAABhBCAblSnVII4EWr3qf9ntcSZH",
                "SD0tMI9X6FnvQxB4Tr+sf+W5BoLCo3H33qM3pQvV7sT6Oc40g+45CX35trXBt9yHMUaQmrphNYRo",
                "iNCwziTfaGtpcTJ/eWTq+ovsAp0F1Q==",
            ),
            signed: concat!(
                "U1NIU0lHAAAABGZpbGUAAAAAAAAABnNoYTI1NgAAACBtlPOstuPL8kRlEWL51guiw7YyeHm7U+4r",
                "ct1ktERdnQ==",
            ),
            signature: concat!(
                "AAAAE2VjZHNhLXNoYTItbmlzdHAzODQAAABoAAAAL2liVyWBPQS0Plo0I7JPi1bg9MItYDnyZRYC",
                "yOpo60TwICVI4+oy72X6avm8Ad59AAAAMQC5/b6FoT0NFGcUsYQQ0m/RGsLsWeVXY2t4WtLoHuo3",
                "gy9Zx/fEZNAXQa2G3lSMIwM=",
            ),
            fingerprint: "SHA256:TVq38491fRWNnR3fSzQWw8k5vHnBwQ1VoVo77OwrAns",
            // s has a leading zero byte (49 bytes); r is shorter than the field (47 of 48 bytes)
        },
        OpensshVector {
            curve: "nistp521",
            host_key: concat!(
                "AAAAE2VjZHNhLXNoYTItbmlzdHA1MjEAAAAIbmlzdHA1MjEAAACFBAFYKp/enDftp+MC+u+tuVMr",
                "4fDIIGioPN7PwQIxWpIZnORvNl00ky+24xODUg8YjUJqgQ2IgOjSQ7Ww70hkXdHKeAEG98FVjzDB",
                "gnyqzeAWfRbcOQll9s8bHoAl+sqwQ+fByimKhcbmX60KDlnc+R+2Cv3In2vJROj3fyUGg4FaUlgC",
                "wA==",
            ),
            signed: concat!(
                "U1NIU0lHAAAABGZpbGUAAAAAAAAABnNoYTI1NgAAACBdazObU1QZY7/xhh9BrAYrpbNmUfVnoKRi",
                "Lo9QSTWUzg==",
            ),
            signature: concat!(
                "AAAAE2VjZHNhLXNoYTItbmlzdHA1MjEAAACLAAAAQgCmoRCd0v+YOxNswsR7/oT3GAbQUV7zepN2",
                "v4oVQS9c3KD/hhaHgZsIivOn85g0NxJGauDigs5YuWIWDAYrzZUSuQAAAEF6T8PswGwBWsJOGHyo",
                "hvEkYv20ImZqr+vADnCTykb7wb1iMnSQzwFaiT4BhJJi9+Rh6uo1yYE7+yXEo49px4DYgg==",
            ),
            fingerprint: "SHA256:mZhKFZM4NoIUy2bpYsUrhZNvbIPTEvsQcqJY/HRy1Eg",
            // r has a leading zero byte (66 bytes); s is shorter than the field (65 of 66 bytes)
        },
    ];

    fn decode_base64(text: &str) -> Vec<u8> {
        use base64::{prelude::BASE64_STANDARD, Engine as _};
        BASE64_STANDARD.decode(text).unwrap()
    }

    // Builds a non-forwarding session-bind payload from a vector and the given signature blob.
    fn openssh_vector_payload(vector: &OpensshVector, signature: &[u8]) -> Vec<u8> {
        let mut payload = Vec::new();
        write_ssh_string(&mut payload, &decode_base64(vector.host_key));
        write_ssh_string(&mut payload, &decode_base64(vector.signed));
        write_ssh_string(&mut payload, signature);
        payload.push(0u8);
        payload
    }

    #[test]
    fn ecdsa_openssh_signatures_verify() {
        for vector in &OPENSSH_ECDSA_VECTORS {
            let payload = openssh_vector_payload(vector, &decode_base64(vector.signature));
            let state = apply(&payload)
                .unwrap_or_else(|| panic!("{} OpenSSH signature must verify", vector.curve));
            assert_eq!(
                state.host_fingerprint, vector.fingerprint,
                "{} fingerprint must match ssh-keygen",
                vector.curve
            );
            assert!(!state.is_forwarding);
        }
    }

    #[test]
    fn ecdsa_openssh_signatures_tampered_fail() {
        for vector in &OPENSSH_ECDSA_VECTORS {
            let mut signature = decode_base64(vector.signature);
            *signature.last_mut().unwrap() ^= 0x01; // last byte of `s`
            let payload = openssh_vector_payload(vector, &signature);
            assert!(
                apply(&payload).is_none(),
                "{} tampered signature must fail",
                vector.curve
            );
        }
    }

    // Host certificates are a known, documented limitation: they are rejected (and the
    // connection closed by the caller) rather than treated as an unbound, local connection.
    #[test]
    fn host_certificate_host_key_returns_false() {
        let payload = make_session_bind_payload_host_certificate(true);

        // Guard that the fixture really carries a certificate host key.
        let hostkey_len = u32::from_be_bytes(payload[0..4].try_into().unwrap()) as usize;
        let cert = ssh_key::Certificate::from_bytes(&payload[4..4 + hostkey_len]).unwrap();
        assert_eq!(
            cert.algorithm().to_certificate_type(),
            "ssh-ed25519-cert-v01@openssh.com"
        );

        let mut state = SessionBindState::default();
        assert!(!state.parse_and_verify(&payload));
        assert!(!state.is_forwarding);
        assert!(state.host_fingerprint.is_empty());
    }

    #[test]
    fn unsupported_host_key_type_returns_false() {
        let payload = make_session_bind_payload_unsupported_host_key(true);

        // Guard that the fixture exercises the unsupported-key-type path, not a parse failure.
        let hostkey_len = u32::from_be_bytes(payload[0..4].try_into().unwrap()) as usize;
        let host_key = ssh_key::PublicKey::from_bytes(&payload[4..4 + hostkey_len]).unwrap();
        assert!(matches!(
            host_key.key_data(),
            ssh_key::public::KeyData::SkEd25519(_)
        ));

        assert!(apply(&payload).is_none());
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
