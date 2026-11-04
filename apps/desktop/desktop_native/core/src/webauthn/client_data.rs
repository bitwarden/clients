//! Client data for platforms where the app, rather than the OS, creates it.

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};

use super::Error;

/// Member order follows WebAuthn's [client data serialization][order].
///
/// [order]: https://www.w3.org/TR/webauthn-3/#clientdatajson-serialization
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
struct CollectedClientData<'a> {
    r#type: &'a str,
    challenge: String,
    origin: &'a str,
    cross_origin: bool,
}

/// Creates the `CollectedClientData` JSON for a `webauthn.get` ceremony.
///
/// The RP ID must be the origin's host, or a domain that the host is a subdomain of, as WebAuthn
/// requires of a web page.
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
pub(super) fn get_client_data_json(
    challenge: &[u8],
    origin: &str,
    rp_id: &str,
) -> Result<Vec<u8>, Error> {
    validate_rp_id_for_origin(rp_id, origin)?;

    let client_data = CollectedClientData {
        r#type: "webauthn.get",
        challenge: URL_SAFE_NO_PAD.encode(challenge),
        origin,
        cross_origin: false,
    };
    serde_json::to_vec(&client_data).map_err(|err| Error::Platform {
        message: format!("Failed to serialize client data: {err}"),
        dom_error_name: None,
    })
}

/// Checks that the RP ID is the origin's host, or a domain that the host is a subdomain of, as
/// WebAuthn requires of a web page.
pub(super) fn validate_rp_id_for_origin(rp_id: &str, origin: &str) -> Result<(), Error> {
    validate_rp_id(rp_id)?;
    if is_same_or_subdomain(&origin_host(origin)?, rp_id) {
        Ok(())
    } else {
        Err(Error::InvalidRequest(format!(
            "rpId {rp_id:?} is not valid for origin {origin:?}"
        )))
    }
}

/// The members of client data created by the platform that are checked by
/// [validate_platform_client_data_json].
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReceivedClientData {
    r#type: String,
    challenge: String,
    origin: String,
    #[serde(default)]
    cross_origin: bool,
}

/// Checks that the client data of a `webauthn.get` ceremony, created by a platform that sets the
/// origin to `https://<rpId>` itself, has the expected challenge and origin, and is not
/// cross-origin.
///
/// This is a defense-in-depth check: the platform was given the challenge and derives the origin
/// from the RP ID, so the JSON should echo the values we expect. Callers fail the ceremony when
/// this fails, rather than forward unexpected bytes.
///
/// Adapted from `ValidateAppleClientDataJSON` in Electron's
/// `shell/browser/webauthn/electron_platform_passkeys_authenticator_mac.mm`
/// (<https://github.com/electron/electron/blob/050567d5793c2183eac49c6feb1e4c16ad020c54/shell/browser/webauthn/electron_platform_passkeys_authenticator_mac.mm>,
/// added in <https://github.com/electron/electron/pull/51563>). Copyright (c) 2026 Salesforce, Inc.
/// Use of this source code is governed by the MIT license that can be found in Electron's LICENSE
/// file (<https://github.com/electron/electron/blob/050567d5793c2183eac49c6feb1e4c16ad020c54/LICENSE>).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub(super) fn validate_platform_client_data_json(
    client_data_json: &[u8],
    challenge: &[u8],
    rp_id: &str,
) -> Result<(), Error> {
    let invalid = |reason: &str| Error::Platform {
        message: format!("The platform returned invalid client data: {reason}"),
        dom_error_name: None,
    };
    let client_data: ReceivedClientData =
        serde_json::from_slice(client_data_json).map_err(|_| invalid("malformed JSON"))?;
    if client_data.r#type != "webauthn.get" {
        return Err(invalid("unexpected type"));
    }
    if client_data.origin != format!("https://{rp_id}") {
        return Err(invalid("unexpected origin"));
    }
    if URL_SAFE_NO_PAD
        .decode(&client_data.challenge)
        .ok()
        .as_deref()
        != Some(challenge)
    {
        return Err(invalid("unexpected challenge"));
    }
    // We don't request a cross-origin ceremony, so reject one.
    if client_data.cross_origin {
        return Err(invalid("unexpected crossOrigin"));
    }
    Ok(())
}

/// Checks that a U2F app ID, from the [`appid` extension][appid], may be used by the origin.
///
/// The app ID must be an `https` URL whose host is the origin's host, or a domain that the host is
/// a subdomain of. This is a simplified form of the FIDO AppID check, which would also allow the
/// app ID to be a subdomain of the origin's registrable domain.
///
/// [appid]: https://www.w3.org/TR/webauthn-3/#sctn-appid-extension
pub(super) fn validate_app_id(app_id: &str, origin: &str) -> Result<(), Error> {
    let invalid = || {
        Error::InvalidRequest(format!(
            "appid {app_id:?} is not valid for origin {origin:?}"
        ))
    };
    let authority = app_id
        .strip_prefix("https://")
        .and_then(|rest| rest.split(['/', '?', '#']).next())
        .ok_or_else(invalid)?;
    let app_id_host = origin_host(&format!("https://{authority}")).map_err(|_| invalid())?;
    if is_same_or_subdomain(&origin_host(origin)?, &app_id_host) {
        Ok(())
    } else {
        Err(invalid())
    }
}

/// Whether `host` is `domain`, or a subdomain of it, ignoring ASCII case.
fn is_same_or_subdomain(host: &str, domain: &str) -> bool {
    let host = host.to_ascii_lowercase();
    let domain = domain.to_ascii_lowercase();
    host == domain
        || host
            .strip_suffix(&domain)
            .is_some_and(|subdomain| subdomain.ends_with('.'))
}

/// Returns the host of a serialized origin, e.g. `example.com` for `https://example.com:8443`.
///
/// Only `https` origins are accepted, and `http` for `localhost`, matching where browsers allow
/// WebAuthn.
fn origin_host(origin: &str) -> Result<String, Error> {
    let invalid = || Error::InvalidRequest(format!("origin is not valid: {origin:?}"));
    let (scheme, authority) = origin.split_once("://").ok_or_else(invalid)?;
    let host = match authority.rsplit_once(':') {
        Some((host, port)) if !port.is_empty() && port.bytes().all(|b| b.is_ascii_digit()) => host,
        Some(_) => return Err(invalid()),
        None => authority,
    };
    if host.is_empty() || host.contains(['/', '?', '#', '@']) {
        return Err(invalid());
    }
    match scheme {
        "https" => Ok(host.to_string()),
        "http" if host.eq_ignore_ascii_case("localhost") => Ok(host.to_string()),
        _ => Err(invalid()),
    }
}

/// Checks that the RP ID is a domain.
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
        let json =
            get_client_data_json(&[1, 2, 3], "https://vault.example.com", "example.com").unwrap();
        assert_eq!(
            String::from_utf8(json).unwrap(),
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"https://vault.example.com","crossOrigin":false}"#
        );
    }

    #[test]
    fn test_accepts_rp_id_for_origin() {
        for (origin, rp_id) in [
            ("https://example.com", "example.com"),
            ("https://vault.example.com", "example.com"),
            ("https://vault.example.com", "vault.example.com"),
            ("https://Vault.Example.com:8443", "example.com"),
            ("https://localhost:8080", "localhost"),
            ("http://localhost:8080", "localhost"),
        ] {
            assert!(
                get_client_data_json(&[1], origin, rp_id).is_ok(),
                "{origin} {rp_id}"
            );
        }
    }

    #[test]
    fn test_rejects_rp_id_not_valid_for_origin() {
        for (origin, rp_id) in [
            ("https://example.com", "vault.example.com"),
            ("https://notexample.com", "example.com"),
            ("https://example.com.evil.com", "example.com"),
            ("https://evil.com", "example.com"),
        ] {
            assert!(
                get_client_data_json(&[1], origin, rp_id).is_err(),
                "{origin} {rp_id}"
            );
        }
    }

    #[test]
    fn test_rejects_invalid_origins() {
        for origin in [
            "example.com",
            "http://example.com",
            "file:///example.com",
            "https://example.com/path",
            "https://example.com:",
            "https://example.com:port",
            "https://user@example.com",
            "https://",
        ] {
            assert!(
                get_client_data_json(&[1], origin, "example.com").is_err(),
                "{origin}"
            );
        }
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
            assert!(
                get_client_data_json(&[1], "https://example.com", rp_id).is_err(),
                "{rp_id:?}"
            );
        }
    }

    #[test]
    fn test_accepts_platform_client_data() {
        for json in [
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"https://example.com"}"#,
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"https://example.com","crossOrigin":false,"other":1}"#,
        ] {
            assert!(
                validate_platform_client_data_json(json.as_bytes(), &[1, 2, 3], "example.com")
                    .is_ok(),
                "{json}"
            );
        }
    }

    #[test]
    fn test_rejects_unexpected_platform_client_data() {
        for json in [
            "",
            "{}",
            r#"{"type":"webauthn.create","challenge":"AQID","origin":"https://example.com"}"#,
            r#"{"type":"webauthn.get","challenge":"AQIE","origin":"https://example.com"}"#,
            r#"{"type":"webauthn.get","challenge":"AQID=","origin":"https://example.com"}"#,
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"https://vault.example.com"}"#,
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"http://example.com"}"#,
            r#"{"type":"webauthn.get","challenge":"AQID","origin":"https://example.com","crossOrigin":true}"#,
        ] {
            assert!(
                validate_platform_client_data_json(json.as_bytes(), &[1, 2, 3], "example.com")
                    .is_err(),
                "{json}"
            );
        }
    }

    #[test]
    fn test_accepts_app_id_for_origin() {
        for (app_id, origin) in [
            (
                "https://vault.example.com/app-id.json",
                "https://vault.example.com",
            ),
            (
                "https://example.com/app-id.json",
                "https://vault.example.com:8443",
            ),
            (
                "https://vault.example.com:8443/app-id.json",
                "https://vault.example.com",
            ),
        ] {
            assert!(validate_app_id(app_id, origin).is_ok(), "{app_id} {origin}");
        }
    }

    #[test]
    fn test_rejects_app_id_not_valid_for_origin() {
        for (app_id, origin) in [
            ("https://evil.com/app-id.json", "https://vault.example.com"),
            (
                "https://other.example.com/app-id.json",
                "https://vault.example.com",
            ),
            (
                "http://vault.example.com/app-id.json",
                "https://vault.example.com",
            ),
            ("vault.example.com", "https://vault.example.com"),
            (
                "https://user@vault.example.com/app-id.json",
                "https://vault.example.com",
            ),
        ] {
            assert!(
                validate_app_id(app_id, origin).is_err(),
                "{app_id} {origin}"
            );
        }
    }
}
