//! Encoding for the transaction context that ties a follow-up call, such as a
//! user verification prompt, back to the WebAuthn operation that triggered it.
//!
//! The context leaves this process as an opaque base64 string and comes back
//! later, so the encoding and decoding halves live together to stop them
//! drifting apart.

use anyhow::{anyhow, Context as _, Result};
use base64::engine::{general_purpose::STANDARD, Engine as _};
use windows::core::GUID;

/// Length of the transaction ID prefix of a context string, in bytes.
const TRANSACTION_ID_LEN: usize = size_of::<u128>();

/// Encodes a transaction ID and the hash of its originating operation request
/// into an opaque context string.
pub fn create_context_string(transaction_id: GUID, request_hash: &[u8]) -> String {
    let context = &[&transaction_id.to_u128().to_le_bytes(), request_hash].concat();
    STANDARD.encode(context)
}

/// Decodes a context string produced by [`create_context_string`] back into its
/// transaction ID and operation request hash.
pub fn parse_context_string(context: &str) -> Result<(GUID, Vec<u8>)> {
    let decoded = STANDARD
        .decode(context)
        .context("Context string is not valid base64")?;

    if decoded.len() < TRANSACTION_ID_LEN {
        return Err(anyhow!(
            "Context string is too short: expected at least {TRANSACTION_ID_LEN} bytes, got {}",
            decoded.len()
        ));
    }

    let (transaction_id, request_hash) = decoded.split_at(TRANSACTION_ID_LEN);
    // `split_at` guarantees the length, so this conversion cannot fail.
    let transaction_id: [u8; TRANSACTION_ID_LEN] = transaction_id
        .try_into()
        .expect("transaction ID slice is TRANSACTION_ID_LEN bytes");

    Ok((
        GUID::from_u128(u128::from_le_bytes(transaction_id)),
        request_hash.to_vec(),
    ))
}

#[cfg(test)]
mod tests {
    use base64::engine::{general_purpose::STANDARD, Engine as _};
    use windows::core::GUID;

    use super::{create_context_string, parse_context_string};

    const TRANSACTION_ID: GUID = GUID {
        data1: 1,
        data2: 2,
        data3: 3,
        data4: [4; 8],
    };

    #[test]
    fn context_string_round_trips() {
        let hash = b"abcd";

        let context = create_context_string(TRANSACTION_ID, hash);
        let (transaction_id, parsed_hash) = parse_context_string(&context).unwrap();

        assert_eq!(TRANSACTION_ID, transaction_id);
        assert_eq!(hash, parsed_hash.as_slice());
    }

    #[test]
    fn context_string_round_trips_without_a_hash() {
        let context = create_context_string(TRANSACTION_ID, &[]);
        let (transaction_id, parsed_hash) = parse_context_string(&context).unwrap();

        assert_eq!(TRANSACTION_ID, transaction_id);
        assert!(parsed_hash.is_empty());
    }

    #[test]
    fn parsing_a_context_string_that_is_not_base64_fails() {
        assert!(parse_context_string("not base64!").is_err());
    }

    #[test]
    fn parsing_a_context_string_shorter_than_the_transaction_id_fails() {
        // Valid base64, but only eight bytes of a sixteen byte transaction ID.
        let truncated = STANDARD.encode([0u8; 8]);

        assert!(parse_context_string(&truncated).is_err());
    }
}
