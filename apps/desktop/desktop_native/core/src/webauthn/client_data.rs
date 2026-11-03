//! Client data for platforms where the app, rather than the OS, creates it.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::Serialize;

use super::Error;

/// Member order follows WebAuthn's [client data serialization][order].
///
/// [order]: https://www.w3.org/TR/webauthn-3/#clientdatajson-serialization
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CollectedClientData<'a> {
    r#type: &'a str,
    challenge: String,
    origin: String,
    cross_origin: bool,
}

/// Creates the `CollectedClientData` JSON for a `webauthn.get` ceremony, with an origin of
/// `https://{rp_id}`.
pub(super) fn get_client_data_json(challenge: &[u8], rp_id: &str) -> Result<Vec<u8>, Error> {
    validate_rp_id(rp_id)?;
    let client_data = CollectedClientData {
        r#type: "webauthn.get",
        challenge: URL_SAFE_NO_PAD.encode(challenge),
        origin: format!("https://{rp_id}"),
        cross_origin: false,
    };
    serde_json::to_vec(&client_data).map_err(|err| Error::Platform {
        message: format!("Failed to serialize client data: {err}"),
        dom_error_name: None,
    })
}

/// Checks that the RP ID can be used as the host of an `https://` origin.
fn validate_rp_id(rp_id: &str) -> Result<(), Error> {
    let valid = !rp_id.is_empty()
        && !rp_id.starts_with('.')
        && !rp_id.ends_with('.')
        && rp_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.');
    if valid {
        Ok(())
    } else {
        Err(Error::InvalidRequest(format!(
            "rpId is not a valid domain: {rp_id:?}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_client_data_json() {
        let json = get_client_data_json(&[1, 2, 3], "example.com").unwrap();
        assert_eq!(
            String::from_utf8(json).unwrap(),
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"https://example.com","crossOrigin":false}"#
        );
    }

    #[test]
    fn test_rejects_rp_id_that_is_not_a_domain() {
        for rp_id in [
            "",
            "example.com/path",
            "example.com:443",
            "user@example.com",
            ".example.com",
            "example.com.",
        ] {
            assert!(get_client_data_json(&[1], rp_id).is_err(), "{rp_id:?}");
        }
    }
}
