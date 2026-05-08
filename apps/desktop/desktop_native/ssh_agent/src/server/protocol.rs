//! SSH agent wire protocol constants and message builders.
//!
//! Adheres to the protocol defined in:
//! <https://datatracker.ietf.org/doc/draft-ietf-sshm-ssh-agent/>

use crate::crypto::PublicKey;

/// SSH2_AGENTC_REQUEST_IDENTITIES
pub(super) const REQUEST_IDENTITIES: u8 = 11;
/// SSH2_AGENT_IDENTITIES_ANSWER
pub(super) const IDENTITIES_ANSWER: u8 = 12;
/// SSH_AGENT_FAILURE
pub(super) const FAILURE: u8 = 5;

/// Wraps a message body in a 4-byte big-endian length prefix.
pub(super) fn frame(msg: Vec<u8>) -> Vec<u8> {
    let len = msg.len() as u32;
    let mut framed = Vec::with_capacity(4 + msg.len());
    framed.extend_from_slice(&len.to_be_bytes());
    framed.extend(msg);
    framed
}

/// Builds an SSH AGENT_IDENTITIES_ANSWER message from a list of public keys and names.
pub(super) fn build_identities_answer(keys: Vec<(PublicKey, String)>) -> Vec<u8> {
    let mut msg = Vec::new();
    msg.push(IDENTITIES_ANSWER);
    let count = keys.len() as u32;
    msg.extend_from_slice(&count.to_be_bytes());
    for (public_key, name) in keys {
        let blob = public_key.blob();
        msg.extend_from_slice(&(blob.len() as u32).to_be_bytes());
        msg.extend_from_slice(blob);
        let name_bytes = name.as_bytes();
        msg.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
        msg.extend_from_slice(name_bytes);
    }
    msg
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::PublicKey;

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
}
