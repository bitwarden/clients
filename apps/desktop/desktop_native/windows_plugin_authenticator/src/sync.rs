use hex;
use serde_json;

use crate::com_registration::parse_clsid_to_guid_str;
use crate::ipc::send_passkey_request;
use crate::types::*;
use crate::util::debug_log;
use crate::webauthn::*;

/// Helper for sync requests - requests credentials from Electron for a specific RP ID
pub fn send_sync_request(rpid: &str) -> Option<PasskeyResponse> {
    debug_log(&format!(
        "[SYNC] send_sync_request called for RP ID: {}",
        rpid
    ));

    let request = PasskeySyncRequest {
        rp_id: rpid.to_string(),
    };

    debug_log(&format!("[SYNC] Created sync request for RP ID: {}", rpid));

    match serde_json::to_string(&request) {
        Ok(request_json) => {
            debug_log(&format!(
                "[SYNC] Serialized sync request to JSON: {}",
                request_json
            ));
            debug_log(&format!("[SYNC] Sending sync request to Electron via IPC"));
            let response = send_passkey_request(RequestType::Sync, request_json, rpid);
            match &response {
                Some(resp) => debug_log(&format!(
                    "[SYNC] Received response from Electron: {:?}",
                    resp
                )),
                None => debug_log("[SYNC] No response received from Electron"),
            }
            response
        }
        Err(e) => {
            debug_log(&format!(
                "[SYNC] ERROR: Failed to serialize sync request: {}",
                e
            ));
            None
        }
    }
}

/// Initiates credential sync from Electron to Windows - called when Electron wants to push credentials to Windows
pub fn sync_credentials_to_windows(
    credentials: Vec<SyncedCredential>,
    plugin_clsid: &str,
) -> Result<(), String> {
    debug_log(&format!(
        "[SYNC_TO_WIN] sync_credentials_to_windows called with {} credentials for plugin CLSID: {}",
        credentials.len(),
        plugin_clsid
    ));

    // Parse CLSID string to GUID
    let clsid_guid = parse_clsid_to_guid_str(plugin_clsid)
        .map_err(|e| format!("Failed to parse CLSID: {}", e))?;

    if credentials.is_empty() {
        debug_log("[SYNC_TO_WIN] No credentials to sync, proceeding with empty sync");
    }

    // Convert Bitwarden credentials to Windows credential details
    let mut win_credentials = Vec::new();

    for (i, cred) in credentials.iter().enumerate() {
        let truncated_cred_id = if cred.credential_id.len() > 16 {
            format!("{}...", hex::encode(&cred.credential_id[..16]))
        } else {
            hex::encode(&cred.credential_id)
        };
        let truncated_user_id = if cred.user_handle.len() > 16 {
            format!("{}...", hex::encode(&cred.user_handle[..16]))
        } else {
            hex::encode(&cred.user_handle)
        };

        debug_log(&format!("[SYNC_TO_WIN] Converting credential {}: RP ID: {}, User: {}, Credential ID: {} ({} bytes), User ID: {} ({} bytes)",
            i + 1, cred.rp_id, cred.user_name, truncated_cred_id, cred.credential_id.len(), truncated_user_id, cred.user_handle.len()));

        let win_cred = WebAuthnPluginCredentialDetails::create_from_bytes(
            cred.credential_id.clone(), // Pass raw bytes
            cred.rp_id.clone(),
            cred.rp_id.clone(),       // Use RP ID as friendly name for now
            cred.user_handle.clone(), // Pass raw bytes
            cred.user_name.clone(),
            cred.user_name.clone(), // Use user name as display name for now
        );

        win_credentials.push(win_cred);
        debug_log(&format!(
            "[SYNC_TO_WIN] Converted credential {} to Windows format",
            i + 1
        ));
    }

    // First try to remove all existing credentials for this plugin
    debug_log("Attempting to remove all existing credentials before sync...");
    match remove_all_credentials(clsid_guid) {
        Ok(()) => {
            debug_log("Successfully removed existing credentials");
        }
        Err(e) if e.contains("can't be loaded") => {
            debug_log("RemoveAllCredentials function not available - this is expected for some Windows versions");
            // This is fine, the function might not exist in all versions
        }
        Err(e) => {
            debug_log(&format!(
                "Warning: Failed to remove existing credentials: {}",
                e
            ));
            // Continue anyway, as this might be the first sync or an older Windows version
        }
    }

    // Add the new credentials (only if we have any)
    if credentials.is_empty() {
        debug_log("No credentials to add to Windows - sync completed successfully");
        Ok(())
    } else {
        debug_log("Adding new credentials to Windows...");
        match add_credentials(clsid_guid, win_credentials) {
            Ok(()) => {
                debug_log("Successfully synced credentials to Windows");
                Ok(())
            }
            Err(e) => {
                debug_log(&format!(
                    "ERROR: Failed to add credentials to Windows: {}",
                    e
                ));
                Err(e)
            }
        }
    }
}

/// Gets all credentials from Windows for a specific plugin - used when Electron requests current state
pub fn get_credentials_from_windows(plugin_clsid: &str) -> Result<Vec<SyncedCredential>, String> {
    debug_log(&format!(
        "Getting all credentials from Windows for plugin CLSID: {}",
        plugin_clsid
    ));

    // Parse CLSID string to GUID
    let clsid_guid = parse_clsid_to_guid_str(plugin_clsid)
        .map_err(|e| format!("Failed to parse CLSID: {}", e))?;

    match get_all_credentials(clsid_guid) {
        Ok(credentials) => {
            debug_log(&format!(
                "Retrieved {} credentials from Windows",
                credentials.len()
            ));

            let mut bitwarden_credentials = Vec::new();

            // Convert Windows credentials to Bitwarden format
            for cred in credentials {
                let synced_cred = SyncedCredential {
                    credential_id: cred.credential_id,
                    rp_id: cred.rpid,
                    user_name: cred.user_name,
                    user_handle: cred.user_id,
                };

                debug_log(&format!(
                    "Converted Windows credential: RP ID: {}, User: {}, Credential ID: {} bytes",
                    synced_cred.rp_id,
                    synced_cred.user_name,
                    synced_cred.credential_id.len()
                ));

                bitwarden_credentials.push(synced_cred);
            }

            Ok(bitwarden_credentials)
        }
        Err(e) => {
            debug_log(&format!(
                "ERROR: Failed to get credentials from Windows: {}",
                e
            ));
            Err(e)
        }
    }
}
