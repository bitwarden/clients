use anyhow::{anyhow, Result};
use base64::engine::{general_purpose::URL_SAFE_NO_PAD, Engine};
use win_webauthn::{CredentialId, UserId, plugin::{Clsid, PluginCredentialDetails, PluginUserVerificationRequest, WebAuthnPlugin}};
use windows::{Win32::Foundation::HWND, core::GUID};

use crate::autofill::{
    CommandResponse, RunCommand, RunCommandRequest, StatusResponse, StatusState, StatusSupport,
    SyncCredential, SyncParameters, SyncResponse, UserVerificationParameters,
    UserVerificationResponse,
};

const PLUGIN_CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

#[allow(clippy::unused_async)]
pub async fn run_command(value: String) -> Result<String> {
    tracing::debug!("Received command request: {value}");
    let request: RunCommandRequest = serde_json::from_str(&value)
        .map_err(|e| anyhow!("Failed to deserialize passkey request: {e}"))?;

    if request.namespace != "autofill" {
        return Err(anyhow!("Unknown namespace: {}", request.namespace));
    }
    let response: CommandResponse = match request.command {
        RunCommand::Status => handle_status_request()?.try_into()?,
        RunCommand::Sync => {
            let params: SyncParameters = serde_json::from_value(request.params)
                .map_err(|e| anyhow!("Could not parse sync parameters: {e}"))?;
            handle_sync_request(params)?.try_into()?
        }
        RunCommand::UserVerification => {
            let params: UserVerificationParameters = serde_json::from_value(request.params)
                .map_err(|e| anyhow!("Could not parse user verification parameters: {e}"))?;
            handle_user_verification_request(params)?.try_into()?
        }
    };
    serde_json::to_string(&response).map_err(|e| anyhow!("Failed to serialize response: {e}"))
}

fn handle_sync_request(params: SyncParameters) -> Result<SyncResponse> {
    let credentials: Vec<SyncedCredential> = params
        .credentials
        .into_iter()
        .filter_map(|c| c.try_into().ok())
        .collect();
    let num_creds = credentials.len().try_into().unwrap_or(u32::MAX);
    sync_credentials_to_windows(credentials, PLUGIN_CLSID)
        .map_err(|e| anyhow!("Failed to sync credentials to Windows: {e}"))?;
    Ok(SyncResponse { added: num_creds })
}

fn handle_status_request() -> Result<StatusResponse> {
    Ok(StatusResponse {
        support: StatusSupport {
            fido2: true,
            password: false,
            incremental_updates: false,
        },
        state: StatusState { enabled: true },
    })
}

fn handle_user_verification_request(
    request: UserVerificationParameters,
) -> Result<UserVerificationResponse> {
    tracing::debug!(?request, "Handling user verification request");
    let (buf, _) = request.transaction_context[..16].split_at(16);
    let guid_u128 = buf
        .try_into()
        .map_err(|e| anyhow!("Failed to parse transaction ID as u128: {e}"))?;
    let transaction_id = GUID::from_u128(u128::from_le_bytes(guid_u128));
    let hwnd: HWND = unsafe {
        // SAFETY: We check to make sure that the vec is the expected size
        // before converting it. If the handle is invalid when passed to
        // Windows, the request will be rejected. 
        if request.window_handle.len() == size_of::<HWND>() {
            *request.window_handle.as_ptr().cast()
        } else {
            return Err(anyhow!("Invalid window handle received: {:?}", request.window_handle));
        }
    };

    let uv_request = PluginUserVerificationRequest {
        window_handle: hwnd,
        transaction_id: transaction_id,
        user_name: request.username,
        display_hint: Some(request.display_hint),
    };
    let _response = WebAuthnPlugin::perform_user_verification(uv_request)
        .map_err(|err| anyhow!("User Verification request failed: {err}"))?;
    return Ok(UserVerificationResponse {});
}

impl TryFrom<SyncCredential> for SyncedCredential {
    type Error = anyhow::Error;

    fn try_from(value: SyncCredential) -> Result<Self, anyhow::Error> {
        if let SyncCredential::Fido2 {
            rp_id,
            credential_id,
            user_name,
            user_handle,
            ..
        } = value
        {
            Ok(Self {
                credential_id: URL_SAFE_NO_PAD
                    .decode(credential_id)
                    .map_err(|e| anyhow!("Could not decode credential ID: {e}"))?,
                rp_id: rp_id,
                user_name: user_name,
                user_handle: URL_SAFE_NO_PAD
                    .decode(&user_handle)
                    .map_err(|e| anyhow!("Could not decode user handle: {e}"))?,
            })
        } else {
            Err(anyhow!("Only FIDO2 credentials are supported."))
        }
    }
}

/// Initiates credential sync from Electron to Windows - called when Electron wants to push credentials to Windows
fn sync_credentials_to_windows(
    credentials: Vec<SyncedCredential>,
    plugin_clsid: &str,
) -> Result<(), String> {
    tracing::debug!(
        "[SYNC_TO_WIN] sync_credentials_to_windows called with {} credentials for plugin CLSID: {}",
        credentials.len(),
        plugin_clsid
    );

    let clsid = Clsid::try_from(plugin_clsid)
        .map_err(|err| format!("Failed to parse CLSID from string {plugin_clsid}: {err}"))?;
    let plugin = WebAuthnPlugin::new(clsid);

    // Convert Bitwarden credentials to Windows credential details
    let win_credentials = credentials.into_iter().enumerate().filter_map(|(i, cred)| {
        tracing::debug!("[SYNC_TO_WIN] Converting credential {}: RP ID: {}, User: {}, Credential ID: {:?} ({} bytes), User ID: {:?} ({} bytes)",
            i + 1, cred.rp_id, cred.user_name, &cred.credential_id, cred.credential_id.len(), &cred.user_handle, cred.user_handle.len());
        
        let cred_id = match CredentialId::try_from(cred.credential_id) {
            Ok(id) => id,
            Err(err) => {
                tracing::warn!("Skipping sync of credential {} because of an invalid credential ID: {err}", i + 1);
                return None;
            }
        };
        let user_id = match UserId::try_from(cred.user_handle) {
            Ok(id) => id,
            Err(err) => {
                tracing::warn!("Skipping sync of credential {} because of an invalid user ID: {err}", i + 1);
                return None;
            }
        };

        let cred_details = PluginCredentialDetails {
            credential_id: cred_id,
            rp_id: cred.rp_id.clone(),
            rp_friendly_name: Some(cred.rp_id.clone()), // Use RP ID as friendly name for now
            user_id: user_id,
            user_name: cred.user_name.clone(),
            user_display_name: cred.user_name.clone(), // Use user name as display name for now
        };
        tracing::debug!(
            "[SYNC_TO_WIN] Converted credential {} to Windows format",
            i + 1
        );
        Some(cred_details)
    }).collect();

    plugin
        .sync_credentials(win_credentials)
        .map_err(|err| format!("Failed to synchronize credentials: {err}"))
}

/// Credential data for sync operations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncedCredential {
    pub credential_id: Vec<u8>,
    pub rp_id: String,
    pub user_name: String,
    pub user_handle: Vec<u8>,
}