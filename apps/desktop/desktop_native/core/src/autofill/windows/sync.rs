use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use serde_with::{
    base64::{Base64, UrlSafe},
    formats::Unpadded,
    serde_as,
};
use win_webauthn::{
    plugin::{Clsid, PluginCredentialDetails, WebAuthnPlugin},
    CredentialId, UserId,
};

use super::{get_clsid, CommandResponse};

pub(super) fn handle_sync_request(params: SyncParameters) -> Result<SyncResponse> {
    let Some(clsid) = get_clsid()? else {
        return Err(anyhow!(
            "[core::autofill::sync] Sync requested, but CLSID not found"
        ));
    };

    let win_credentials = to_plugin_credentials(params.credentials)?;
    let added = sync_credentials_to_windows(win_credentials, clsid)?;
    Ok(SyncResponse { added })
}

/// Drops credential types Windows cannot store, converts the rest, and skips any
/// individual credential Windows would reject rather than failing the whole batch.
fn to_plugin_credentials(credentials: Vec<SyncCredential>) -> Result<Vec<PluginCredentialDetails>> {
    let win_credentials =
        credentials
            .into_iter()
            .enumerate()
            .filter_map(|(i, c)| match c {
                SyncCredential::Fido2(cred) => Some((i, cred)),
                SyncCredential::Password => None,
            })
            .filter_map(|(i, cred)| {
                PluginCredentialDetails::try_from(cred)
                    .map_err(|err| {
                        tracing::warn!(
                            "[core::autofill] Skipping sync of credential {i} due to error: {err:#}"
                        );
                    })
                    .ok()
            })
            // Windows array lengths are represented with u32, so we can't submit more than that.
            .take(u32::MAX.try_into().context(
                "Windows binary unexpectedly running on an architecture where usize < u32",
            )?)
            .collect();
    Ok(win_credentials)
}

/// Initiates credential sync from Electron to Windows - called when Electron wants to push
/// credentials to Windows
fn sync_credentials_to_windows(
    win_credentials: Vec<PluginCredentialDetails>,
    plugin_clsid: Clsid,
) -> Result<u32> {
    tracing::debug!(
        "[core::autofill] sync_credentials_to_windows called with {} credentials for plugin CLSID: {}",
        win_credentials.len(),
        plugin_clsid
    );

    let plugin = WebAuthnPlugin::new(plugin_clsid);

    // INVARIANT: to_plugin_credentials limits the list length to u32::MAX.
    let num_to_add = win_credentials
        .len()
        .try_into()
        .expect("Credential list to be <= u32::MAX");
    tracing::debug!(
        "[core::autofill] Synchronizing {} credentials to Windows",
        win_credentials.len()
    );

    plugin
        .sync_credentials(win_credentials)
        .context("Failed to synchronize credentials")?;
    Ok(num_to_add)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SyncParameters {
    credentials: Vec<SyncCredential>,
}

#[serde_as]
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "camelCase")]
enum SyncCredential {
    // Currently Windows only supports syncing passkeys, so this is unused.
    Password,
    Fido2(SyncFido2Credential),
}

#[serde_as]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncFido2Credential {
    rp_id: String,

    #[serde_as(as = "Base64<UrlSafe, Unpadded>")]
    credential_id: Vec<u8>,

    user_name: Option<String>,

    #[serde_as(as = "Option<Base64<UrlSafe, Unpadded>>")]
    user_handle: Option<Vec<u8>>,
}

impl TryFrom<SyncFido2Credential> for PluginCredentialDetails {
    type Error = anyhow::Error;

    fn try_from(value: SyncFido2Credential) -> Result<Self, Self::Error> {
        let cred_id =
            CredentialId::try_from(value.credential_id).context("Invalid credential ID")?;
        let user_id = value
            .user_handle
            .ok_or_else(|| anyhow!("No user handle specified"))
            .and_then(|id| UserId::try_from(id).context("Invalid user ID"))?;
        let user_name = value
            .user_name
            .ok_or_else(|| anyhow!("No username specified"))?;

        Ok(PluginCredentialDetails {
            credential_id: cred_id,
            rp_id: value.rp_id.clone(),
            rp_friendly_name: Some(value.rp_id.clone()), // Use RP ID as friendly name for now
            user_id,
            user_name: user_name.clone(),
            user_display_name: user_name, // Use user name as display name for now
        })
    }
}

#[derive(Serialize)]
pub(super) struct SyncResponse {
    added: u32,
}

impl From<SyncResponse> for CommandResponse {
    fn from(value: SyncResponse) -> Self {
        Self::Sync(value)
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use win_webauthn::plugin::PluginCredentialDetails;

    use super::{to_plugin_credentials, SyncCredential, SyncFido2Credential, SyncResponse};
    use crate::autofill::autofill::{
        CommandResponse, CommandResult, RunCommand, RunCommandRequest,
    };

    /// Windows accepts credential IDs of 16..=1023 bytes and user handles of 1..=64 bytes.
    fn fido2_credential(credential_id: Vec<u8>, user_handle: Vec<u8>) -> SyncFido2Credential {
        SyncFido2Credential {
            rp_id: "example.com".to_string(),
            credential_id,
            user_name: Some("user@example.com".to_string()),
            user_handle: Some(user_handle),
        }
    }

    fn valid_credential() -> SyncFido2Credential {
        fido2_credential(vec![7u8; 16], vec![9u8; 32])
    }

    #[test]
    fn converts_credential_and_fills_placeholder_display_names() {
        let details = PluginCredentialDetails::try_from(valid_credential()).unwrap();

        assert_eq!([7u8; 16].as_slice(), details.credential_id.as_ref());
        assert_eq!([9u8; 32].as_slice(), details.user_id.as_ref());
        assert_eq!("example.com", details.rp_id);
        assert_eq!("user@example.com", details.user_name);
        // Both are placeholders today. If Bitwarden starts sending real friendly names,
        // these assertions should be updated deliberately rather than silently drift.
        assert_eq!(Some("example.com".to_string()), details.rp_friendly_name);
        assert_eq!("user@example.com", details.user_display_name);
    }

    #[test]
    fn accepts_credential_id_at_length_bounds() {
        for len in [16, 1023] {
            let cred = fido2_credential(vec![1u8; len], vec![9u8; 32]);
            assert!(
                PluginCredentialDetails::try_from(cred).is_ok(),
                "credential ID of {len} bytes should be accepted"
            );
        }
    }

    #[test]
    fn rejects_credential_id_outside_length_bounds() {
        for len in [0, 15, 1024] {
            let cred = fido2_credential(vec![1u8; len], vec![9u8; 32]);
            assert!(
                PluginCredentialDetails::try_from(cred).is_err(),
                "credential ID of {len} bytes should be rejected"
            );
        }
    }

    /// Passkeys imported from other providers may carry no user handle. Windows rejects an
    /// empty user ID, so such credentials are silently dropped from the sync today.
    #[test]
    fn rejects_empty_user_handle() {
        let cred = fido2_credential(vec![1u8; 16], vec![]);
        assert!(PluginCredentialDetails::try_from(cred).is_err());
    }

    #[test]
    fn rejects_none_user_handle() {
        let mut cred = fido2_credential(vec![1u8; 16], vec![]);
        cred.user_handle = None;
        assert!(PluginCredentialDetails::try_from(cred).is_err());
    }

    #[test]
    fn accepts_user_handle_at_maximum_length() {
        let cred = fido2_credential(vec![1u8; 16], vec![9u8; 64]);
        assert!(PluginCredentialDetails::try_from(cred).is_ok());
    }

    #[test]
    fn rejects_user_handle_above_maximum_length() {
        let cred = fido2_credential(vec![1u8; 16], vec![9u8; 65]);
        assert!(PluginCredentialDetails::try_from(cred).is_err());
    }

    /// Conversion failures are written to the log, so they must describe the problem by
    /// length only - never by credential contents, RP ID, or username.
    #[test]
    fn conversion_error_does_not_leak_credential_contents() {
        let cred = SyncFido2Credential {
            rp_id: "secret-rp.example".to_string(),
            credential_id: b"short".to_vec(),
            user_name: Some("victim@example.com".to_string()),
            user_handle: Some(vec![9u8; 32]),
        };

        let err = PluginCredentialDetails::try_from(cred).unwrap_err();
        let rendered = format!("{err:#}");

        assert!(
            rendered.contains("received 5"),
            "error should report the length: {rendered}"
        );
        for secret in ["secret-rp.example", "victim@example.com", "short"] {
            assert!(
                !rendered.contains(secret),
                "error leaked {secret:?}: {rendered}"
            );
        }
    }

    #[test]
    fn filters_out_password_credentials() {
        let credentials = vec![
            SyncCredential::Password,
            SyncCredential::Fido2(valid_credential()),
            SyncCredential::Password,
        ];

        assert_eq!(1, to_plugin_credentials(credentials).unwrap().len());
    }

    #[test]
    fn skips_invalid_credentials_without_aborting_the_batch() {
        let usernameless = SyncFido2Credential {
            rp_id: "example.com".to_string(),
            credential_id: vec![4u8; 16],
            user_name: None,
            user_handle: Some(vec![9u8; 16]),
        };

        let credentials = vec![
            SyncCredential::Fido2(fido2_credential(vec![1u8; 16], vec![9u8; 32])),
            // Invalid: credential ID is one byte under the minimum.
            SyncCredential::Fido2(fido2_credential(vec![2u8; 15], vec![9u8; 32])),
            SyncCredential::Fido2(fido2_credential(vec![3u8; 16], vec![9u8; 32])),
            SyncCredential::Fido2(fido2_credential(vec![3u8; 16], vec![])),
            SyncCredential::Fido2(usernameless),
        ];

        let result = to_plugin_credentials(credentials).unwrap();

        assert_eq!(2, result.len());
        assert_eq!([1u8; 16].as_slice(), result[0].credential_id.as_ref());
        assert_eq!([3u8; 16].as_slice(), result[1].credential_id.as_ref());
    }

    /// Signing out syncs an empty list to clear the Windows autofill store, so an empty
    /// input must produce an empty list rather than an error.
    #[test]
    fn returns_empty_list_for_empty_input() {
        assert!(to_plugin_credentials(vec![]).unwrap().is_empty());
    }

    #[test]
    fn returns_empty_list_when_all_credentials_are_passwords() {
        let credentials = vec![SyncCredential::Password, SyncCredential::Password];
        assert!(to_plugin_credentials(credentials).unwrap().is_empty());
    }

    #[test]
    fn test_optional_fields_deserialize_to_none_when_null() {
        let json = r#"{
            "type":"fido2",
            "cipherId":"c7ea35e7-5e7a-48ff-b4ce-b4940151967a",
            "credentialId":"Y3JlZGVudGlhbElk-v_D",
            "rpId":"example.com",
            "userHandle": null,
            "userName": null
        }"#;

        let cred = serde_json::from_str::<SyncCredential>(json).unwrap();
        let SyncCredential::Fido2(fido_cred) = cred else {
            panic!("expected Fido2 credential");
        };
        assert!(fido_cred.user_handle.is_none());
        assert!(fido_cred.user_name.is_none());
    }

    #[test]
    fn test_optional_fields_deserialize_to_none_when_absent() {
        let json = r#"{
            "type":"fido2",
            "cipherId":"c7ea35e7-5e7a-48ff-b4ce-b4940151967a",
            "credentialId":"Y3JlZGVudGlhbElk-v_D",
            "rpId":"example.com"
        }"#;

        let cred = serde_json::from_str::<SyncCredential>(json).unwrap();
        let SyncCredential::Fido2(fido_cred) = cred else {
            panic!("expected Fido2 credential");
        };
        assert!(fido_cred.user_handle.is_none());
    }

    #[test]
    fn test_request_deserialization() {
        let json = r#"{
            "namespace":"autofill",
            "command":"sync",
            "params": { "credentials": [{
                "type":"fido2",
                "cipherId":"c7ea35e7-5e7a-48ff-b4ce-b4940151967a",
                "credentialId":"Y3JlZGVudGlhbElk-v_D",
                "rpId":"example.com",
                "userHandle":"dXNlckhhbmRsZQD6_8M-",
                "userName":"bitwarden-windows-demo1"
            }]}
        }"#;
        let request: RunCommandRequest = serde_json::from_str(json).unwrap();

        let RunCommandRequest {
            command: RunCommand::Sync(params),
            ..
        } = &request
        else {
            panic!("should match sync");
        };
        assert_eq!("autofill", request.namespace);
        let SyncCredential::Fido2(SyncFido2Credential {
            rp_id,
            credential_id,
            user_name,
            user_handle,
            ..
        }) = &params.credentials[0]
        else {
            panic!("should have matched")
        };
        assert_eq!("example.com", rp_id);
        assert_eq!(b"credentialId\xfa\xff\xc3", credential_id.as_slice());
        assert_eq!(
            b"userHandle\x00\xfa\xff\xc3>",
            user_handle.as_ref().unwrap().as_slice()
        );
        assert_eq!("bitwarden-windows-demo1", user_name.as_ref().unwrap());
    }

    #[test]
    fn test_result_serialization() {
        let result = CommandResult::Success {
            value: CommandResponse::Sync(SyncResponse { added: 10 }),
        };
        let json = serde_json::to_string(&result).unwrap();
        let expected_json = json!({
            "type": "success",
            "value": { "added": 10 },
        })
        .to_string();
        assert_eq!(expected_json, json);
    }
}
