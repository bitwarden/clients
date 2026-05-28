//! SSH agent wire protocol constants and message builders.
//!
//! Adheres to the protocol defined in:
//! <https://datatracker.ietf.org/doc/draft-ietf-sshm-ssh-agent/>

use ssh_key::Signature;
use tracing::warn;

use crate::crypto::PublicKey;

/// `SSH2_AGENTC_REQUEST_IDENTITIES`
pub(super) const REQUEST_IDENTITIES: u8 = 11;
/// `SSH2_AGENT_IDENTITIES_ANSWER`
pub(super) const IDENTITIES_ANSWER: u8 = 12;
/// `SSH2_AGENTC_SIGN_REQUEST`
pub(super) const SIGN_REQUEST: u8 = 13;
/// `SSH2_AGENT_SIGN_RESPONSE`
pub(super) const SIGN_RESPONSE: u8 = 14;
/// `SSH_AGENT_FAILURE`
pub(super) const FAILURE: u8 = 5;

/// Returns an SSH `SSH_AGENT_FAILURE` response message.
pub(super) fn failure() -> Vec<u8> {
    vec![FAILURE]
}

/// Represents the parsed SSHSIG namespace.
// <https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig>
#[derive(Debug, Clone, PartialEq)]
pub enum SIGNamespace {
    Git,
    File,
    Unsupported,
}

/// SSH agent signing flags from the `SIGN_REQUEST` `flags` field.
///
/// Only the two RSA hash-selection flags are represented; all other bits are
/// ignored.
// <https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-signature-flags>
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignFlags {
    /// `SSH_AGENT_RSA_SHA2_256`
    RsaSha256 = 2,
    /// `SSH_AGENT_RSA_SHA2_512`
    RsaSha512 = 4,
}

impl SignFlags {
    /// Returns the SSH hash algorithm requested by this flag.
    #[must_use]
    pub fn hash_alg(self) -> ssh_key::HashAlg {
        match self {
            Self::RsaSha256 => ssh_key::HashAlg::Sha256,
            Self::RsaSha512 => ssh_key::HashAlg::Sha512,
        }
    }

    fn from_raw(flags: u32) -> Option<Self> {
        if flags & (Self::RsaSha256 as u32) != 0 {
            Some(Self::RsaSha256)
        } else if flags & (Self::RsaSha512 as u32) != 0 {
            Some(Self::RsaSha512)
        } else {
            None
        }
    }
}

/// A parsed inbound SSH agent message.
pub(super) enum AgentMessage {
    RequestIdentities,
    SignRequest {
        public_key: PublicKey,
        data: Vec<u8>,
        flags: Option<SignFlags>,
    },
    Unknown(u8),
}

/// Parses a raw message frame into a typed [`AgentMessage`].
///
/// Returns `None` if the message is empty or the payload is malformed.
pub(super) fn parse_message(msg: &[u8]) -> Option<AgentMessage> {
    match *msg.first()? {
        REQUEST_IDENTITIES => Some(AgentMessage::RequestIdentities),
        SIGN_REQUEST => {
            let (public_key, data, flags) = parse_sign_request_payload(&msg[1..])?;
            Some(AgentMessage::SignRequest {
                public_key,
                data,
                flags,
            })
        }
        unknown => Some(AgentMessage::Unknown(unknown)),
    }
}

/// Wraps a message body in a 4-byte big-endian length prefix.
pub(super) fn frame(msg: Vec<u8>) -> Vec<u8> {
    let len = u32::try_from(msg.len()).expect("frame body length to fit in u32::MAX");
    let mut framed = Vec::with_capacity(4 + msg.len());

    framed.extend_from_slice(&len.to_be_bytes());
    framed.extend(msg);

    framed
}

/// Builds an SSH `AGENT_IDENTITIES_ANSWER` message from a list of public keys and names.
pub(super) fn build_identities_answer(keys: Vec<(PublicKey, String)>) -> Vec<u8> {
    let mut msg = Vec::new();
    msg.push(IDENTITIES_ANSWER);

    let count = u32::try_from(keys.len()).expect("key count to fit in u32::MAX");
    msg.extend_from_slice(&count.to_be_bytes());

    for (public_key, name) in keys {
        let blob = public_key.blob();
        let blob_len_bytes = u32::try_from(blob.len())
            .expect("key blob length to fit in u32::MAX")
            .to_be_bytes();
        let name_bytes = name.as_bytes();

        let name_len_bytes = u32::try_from(name_bytes.len())
            .expect("key name length to fit in u32::MAX")
            .to_be_bytes();
        msg.extend_from_slice(&blob_len_bytes);
        msg.extend_from_slice(blob);
        msg.extend_from_slice(&name_len_bytes);
        msg.extend_from_slice(name_bytes);
    }

    msg
}

/// Parses the payload of a `SIGN_REQUEST` message (the bytes after the message type byte).
///
/// Returns `(public_key, data_to_sign, flags)` or `None` if the payload is malformed.
fn parse_sign_request_payload(payload: &[u8]) -> Option<(PublicKey, Vec<u8>, Option<SignFlags>)> {
    // Parse key blob: [u32 len][blob bytes]
    if payload.len() < 4 {
        warn!("Sign request payload too short to read key blob length");
        return None;
    }
    let blob_len = u32::from_be_bytes(payload[0..4].try_into().ok()?) as usize;
    if payload.len() < 4 + blob_len {
        warn!("Sign request payload truncated: key blob extends past end");
        return None;
    }
    let blob = &payload[4..4 + blob_len];

    // Algorithm name is the first SSH string inside the blob
    if blob.len() < 4 {
        warn!("Key blob too short to read algorithm name length");
        return None;
    }
    let alg_len = u32::from_be_bytes(blob[0..4].try_into().ok()?) as usize;
    if blob.len() < 4 + alg_len {
        warn!("Key blob truncated: algorithm name extends past end");
        return None;
    }
    let alg = if let Ok(s) = std::str::from_utf8(&blob[4..4 + alg_len]) {
        s.to_string()
    } else {
        warn!("Algorithm name in key blob is not valid UTF-8");
        return None;
    };

    let public_key = PublicKey {
        alg,
        blob: blob.to_vec(),
    };

    // Parse data to sign: [u32 len][data bytes]
    let rest = &payload[4 + blob_len..];
    if rest.len() < 4 {
        warn!("Sign request payload too short to read data length");
        return None;
    }
    let data_len = u32::from_be_bytes(rest[0..4].try_into().ok()?) as usize;
    if rest.len() < 4 + data_len {
        warn!("Sign request payload truncated: data extends past end");
        return None;
    }
    let data = rest[4..4 + data_len].to_vec();

    // Parse flags: [u32] — optional trailing field; treat as 0 if absent.
    let raw_flags = if rest.len() >= 4 + data_len + 4 {
        u32::from_be_bytes(rest[4 + data_len..4 + data_len + 4].try_into().ok()?)
    } else {
        0
    };

    Some((public_key, data, SignFlags::from_raw(raw_flags)))
}

/// Builds an SSH `AGENT_SIGN_RESPONSE` message from a [`Signature`].
pub(super) fn build_sign_response(sig: &Signature) -> Vec<u8> {
    let alg = sig.algorithm().to_string();
    let sig_bytes = sig.as_bytes();

    let blob_len = 4 + alg.len() + 4 + sig_bytes.len();
    let blob_len_bytes = u32::try_from(blob_len)
        .expect("signature blob length to fit in u32::MAX")
        .to_be_bytes();
    let alg_len_bytes = u32::try_from(alg.len())
        .expect("algorithm name length to fit in u32::MAX")
        .to_be_bytes();
    let sig_len_bytes = u32::try_from(sig_bytes.len())
        .expect("signature bytes length to fit in u32::MAX")
        .to_be_bytes();

    let mut msg = Vec::new();

    msg.push(SIGN_RESPONSE);
    msg.extend_from_slice(&blob_len_bytes);
    msg.extend_from_slice(&alg_len_bytes);
    msg.extend_from_slice(alg.as_bytes());
    msg.extend_from_slice(&sig_len_bytes);
    msg.extend_from_slice(sig_bytes);

    msg
}

/// Detects the SIG namespace from the data being signed.
///
/// Returns `Some(namespace)` if the data is an SSHSIG blob, or `None` for
/// regular SSH authentication data.
pub(super) fn detect_namespace(data: &[u8]) -> Option<SIGNamespace> {
    // SSHSIG format: [6-byte magic "SSHSIG"][u32 version][string namespace]...
    // https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig
    const SSHSIG_MAGIC: &[u8] = b"SSHSIG";

    if !data.starts_with(SSHSIG_MAGIC) {
        return None;
    }

    // Skip magic (6 bytes) + version uint32 (4 bytes) = 10 bytes
    let offset = 10;
    if data.len() < offset + 4 {
        return Some(SIGNamespace::Unsupported);
    }

    let ns_len = u32::from_be_bytes(data[offset..offset + 4].try_into().ok()?) as usize;
    if data.len() < offset + 4 + ns_len {
        return Some(SIGNamespace::Unsupported);
    }

    let ns_str = std::str::from_utf8(&data[offset + 4..offset + 4 + ns_len]).ok()?;
    match ns_str {
        "git" => Some(SIGNamespace::Git),
        "file" => Some(SIGNamespace::File),
        _ => Some(SIGNamespace::Unsupported),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::PublicKey;

    const TEST_DATA: &[u8] = b"test data";

    fn make_sign_request_msg(blob: &[u8], data: &[u8], flags: u32) -> Vec<u8> {
        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(blob);
        msg.extend_from_slice(&(data.len() as u32).to_be_bytes());
        msg.extend_from_slice(data);
        msg.extend_from_slice(&flags.to_be_bytes());
        msg
    }

    fn make_minimal_ed25519_blob() -> Vec<u8> {
        let alg = b"ssh-ed25519";
        let key_bytes = [0u8; 32];
        let mut blob = Vec::new();
        blob.extend_from_slice(&(alg.len() as u32).to_be_bytes());
        blob.extend_from_slice(alg);
        blob.extend_from_slice(&(key_bytes.len() as u32).to_be_bytes());
        blob.extend_from_slice(&key_bytes);
        blob
    }

    fn make_sshsig_blob(namespace: &str) -> Vec<u8> {
        let mut v = Vec::new();
        v.extend_from_slice(b"SSHSIG");
        v.extend_from_slice(&1u32.to_be_bytes()); // version
        v.extend_from_slice(&(namespace.len() as u32).to_be_bytes());
        v.extend_from_slice(namespace.as_bytes());
        v
    }

    #[test]
    fn frame_prepends_four_byte_be_length() {
        let msg = vec![1u8, 2, 3];
        let framed = frame(msg.clone());

        let len = u32::from_be_bytes(framed[..4].try_into().unwrap());
        assert_eq!(len, 3);
        assert_eq!(&framed[4..], msg.as_slice());
    }

    #[test]
    fn frame_empty_message_produces_four_zero_bytes() {
        let framed = frame(vec![]);
        assert_eq!(framed, vec![0u8, 0, 0, 0]);
    }

    #[test]
    fn build_identities_answer_no_keys_produces_type_and_zero_count() {
        let msg = build_identities_answer(vec![]);

        assert_eq!(msg[0], IDENTITIES_ANSWER);
        assert_eq!(u32::from_be_bytes(msg[1..5].try_into().unwrap()), 0);
        assert_eq!(msg.len(), 5);
    }

    #[test]
    fn build_identities_answer_one_key_encodes_blob_and_name() {
        let blob = vec![0u8, 1, 2, 3];
        let name = "Test Key";
        let key = PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: blob.clone(),
        };

        let msg = build_identities_answer(vec![(key, name.to_string())]);

        assert_eq!(msg[0], IDENTITIES_ANSWER);
        assert_eq!(u32::from_be_bytes(msg[1..5].try_into().unwrap()), 1);

        let blob_len = u32::from_be_bytes(msg[5..9].try_into().unwrap()) as usize;
        assert_eq!(blob_len, blob.len());
        assert_eq!(&msg[9..9 + blob_len], blob.as_slice());

        let name_offset = 9 + blob_len;
        let name_len =
            u32::from_be_bytes(msg[name_offset..name_offset + 4].try_into().unwrap()) as usize;
        assert_eq!(name_len, name.len());
        assert_eq!(
            &msg[name_offset + 4..name_offset + 4 + name_len],
            name.as_bytes()
        );
    }

    #[test]
    fn build_identities_answer_multiple_keys_encodes_correct_count() {
        let key1 = PublicKey {
            alg: "ssh-ed25519".to_string(),
            blob: vec![1, 2],
        };
        let key2 = PublicKey {
            alg: "ssh-rsa".to_string(),
            blob: vec![3, 4, 5],
        };

        let msg = build_identities_answer(vec![
            (key1, "Key One".to_string()),
            (key2, "Key Two".to_string()),
        ]);

        assert_eq!(msg[0], IDENTITIES_ANSWER);
        assert_eq!(u32::from_be_bytes(msg[1..5].try_into().unwrap()), 2);
    }

    #[test]
    fn parse_message_empty_returns_none() {
        assert!(parse_message(&[]).is_none());
    }

    #[test]
    fn parse_message_request_identities_returns_variant() {
        assert!(matches!(
            parse_message(&[REQUEST_IDENTITIES]),
            Some(AgentMessage::RequestIdentities)
        ));
    }

    #[test]
    fn parse_message_unknown_type_returns_unknown_variant() {
        assert!(matches!(
            parse_message(&[99u8]),
            Some(AgentMessage::Unknown(99))
        ));
    }

    #[test]
    fn parse_message_sign_request_valid_payload_returns_parsed_fields() {
        let blob = make_minimal_ed25519_blob();
        let test_data: &[u8] = b"hello";
        let msg = make_sign_request_msg(&blob, test_data, 0);

        let Some(AgentMessage::SignRequest {
            public_key,
            data: parsed_data,
            flags,
        }) = parse_message(&msg)
        else {
            panic!("expected SignRequest variant");
        };

        assert_eq!(public_key.alg, "ssh-ed25519");
        assert_eq!(public_key.blob, blob);
        assert_eq!(parsed_data.as_slice(), test_data);
        assert_eq!(flags, None);
    }

    #[test]
    fn parse_message_sign_request_rsa_sha256_flag_parsed() {
        let blob = make_minimal_ed25519_blob();
        let msg = make_sign_request_msg(&blob, b"data", 2);

        let Some(AgentMessage::SignRequest { flags, .. }) = parse_message(&msg) else {
            panic!("expected SignRequest variant");
        };

        assert_eq!(flags, Some(SignFlags::RsaSha256));
    }

    #[test]
    fn sign_flags_from_raw_zero_returns_none() {
        assert_eq!(SignFlags::from_raw(0), None);
    }

    #[test]
    fn sign_flags_from_raw_2_returns_rsa_sha256() {
        assert_eq!(SignFlags::from_raw(2), Some(SignFlags::RsaSha256));
    }

    #[test]
    fn sign_flags_from_raw_4_returns_rsa_sha512() {
        assert_eq!(SignFlags::from_raw(4), Some(SignFlags::RsaSha512));
    }

    #[test]
    fn sign_flags_from_raw_6_sha256_wins() {
        assert_eq!(SignFlags::from_raw(6), Some(SignFlags::RsaSha256));
    }

    #[test]
    fn parse_message_sign_request_malformed_payload_returns_none() {
        assert!(parse_message(&[SIGN_REQUEST]).is_none());
    }

    #[test]
    fn parse_sign_request_payload_truncated_before_blob_length() {
        let msg = vec![SIGN_REQUEST, 0, 0, 0]; // 3-byte payload, need 4 for blob_len
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn parse_sign_request_payload_blob_extends_past_end() {
        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&20u32.to_be_bytes()); // claims 20-byte blob
        msg.extend_from_slice(&[0u8; 5]); // only 5 bytes present
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn parse_sign_request_payload_blob_too_short_for_alg_length() {
        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&3u32.to_be_bytes()); // blob_len = 3
        msg.extend_from_slice(&[0u8; 3]); // blob has 3 bytes, need 4 for alg_len
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn parse_sign_request_payload_alg_name_extends_past_end() {
        let mut blob = Vec::new();
        blob.extend_from_slice(&100u32.to_be_bytes()); // alg_len = 100
        blob.extend_from_slice(&[0u8; 4]); // only 4 bytes of alg data present

        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(&blob);
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn parse_sign_request_payload_non_utf8_alg_name() {
        let mut blob = Vec::new();
        blob.extend_from_slice(&2u32.to_be_bytes()); // alg_len = 2
        blob.push(0xFF);
        blob.push(0xFE); // invalid UTF-8 sequence

        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(&blob);
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn parse_sign_request_payload_data_section_too_short() {
        let blob = make_minimal_ed25519_blob();
        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(&blob);
        msg.extend_from_slice(&[0u8; 3]); // only 3 bytes after blob, need 4 for data_len
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn parse_sign_request_payload_data_extends_past_end() {
        let blob = make_minimal_ed25519_blob();
        let mut msg = vec![SIGN_REQUEST];
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(&blob);
        msg.extend_from_slice(&100u32.to_be_bytes()); // data_len = 100
        msg.extend_from_slice(&[0u8; 5]); // only 5 bytes of data present
        assert!(parse_message(&msg).is_none());
    }

    #[test]
    fn detect_namespace_empty_returns_none() {
        assert!(detect_namespace(b"").is_none());
    }

    #[test]
    fn detect_namespace_non_sshsig_returns_none() {
        assert!(detect_namespace(b"hello world").is_none());
    }

    #[test]
    fn detect_namespace_sshsig_git_returns_git() {
        assert_eq!(
            detect_namespace(&make_sshsig_blob("git")),
            Some(SIGNamespace::Git)
        );
    }

    #[test]
    fn detect_namespace_sshsig_file_returns_file() {
        assert_eq!(
            detect_namespace(&make_sshsig_blob("file")),
            Some(SIGNamespace::File)
        );
    }

    #[test]
    fn detect_namespace_sshsig_unknown_namespace_returns_unsupported() {
        assert_eq!(
            detect_namespace(&make_sshsig_blob("email")),
            Some(SIGNamespace::Unsupported)
        );
    }

    #[test]
    fn detect_namespace_truncated_after_version_returns_unsupported() {
        let mut data = Vec::new();
        data.extend_from_slice(b"SSHSIG");
        data.extend_from_slice(&1u32.to_be_bytes()); // version only, no namespace length
        assert_eq!(detect_namespace(&data), Some(SIGNamespace::Unsupported));
    }

    #[test]
    fn build_sign_response_has_sign_response_type_byte() {
        use signature::Signer as _;
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let sig = keypair.sign(TEST_DATA);

        let msg = build_sign_response(&sig);

        assert_eq!(msg[0], SIGN_RESPONSE);
    }

    #[test]
    fn build_sign_response_encodes_algorithm_name() {
        use signature::Signer as _;
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let sig = keypair.sign(TEST_DATA);

        let msg = build_sign_response(&sig);

        let alg_len = u32::from_be_bytes(msg[5..9].try_into().unwrap()) as usize;
        let alg_str = std::str::from_utf8(&msg[9..9 + alg_len]).unwrap();
        assert_eq!(alg_str, sig.algorithm().to_string());
    }

    #[test]
    fn build_sign_response_encodes_signature_bytes() {
        use signature::Signer as _;
        use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

        let keypair = Ed25519Keypair::random(&mut OsRng);
        let sig = keypair.sign(TEST_DATA);

        let msg = build_sign_response(&sig);

        let alg_len = u32::from_be_bytes(msg[5..9].try_into().unwrap()) as usize;
        let sig_len_offset = 9 + alg_len;
        let sig_len =
            u32::from_be_bytes(msg[sig_len_offset..sig_len_offset + 4].try_into().unwrap())
                as usize;
        let sig_bytes = &msg[sig_len_offset + 4..sig_len_offset + 4 + sig_len];
        assert_eq!(sig_bytes, sig.as_bytes());
    }
}
