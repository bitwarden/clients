use anyhow::{anyhow, Result};
use napi::{
    bindgen_prelude::Promise,
    threadsafe_function::{ErrorStrategy::CalleeHandled, ThreadsafeFunction},
};
use serde_json;
use tokio::sync::mpsc;

// Use the PasskeyRequestEvent from the parent module
pub use crate::passkey_authenticator::{PasskeyRequestEvent, SyncedCredential};

pub fn register() -> Result<()> {
    windows_plugin_authenticator::register().map_err(|e| anyhow!(e))?;

    Ok(())
}

pub async fn on_request(
    callback: ThreadsafeFunction<PasskeyRequestEvent, CalleeHandled>,
) -> napi::Result<String> {
    let (tx, mut rx) = mpsc::unbounded_channel();

    // Set the sender in the Windows plugin authenticator
    windows_plugin_authenticator::set_request_sender(tx);

    // Spawn task to handle incoming events
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // The request is already serialized as JSON in the event
            let request_json = event.request_json;

            // Get the request type as a string
            let request_type = match event.request_type {
                windows_plugin_authenticator::RequestType::Assertion => "assertion".to_string(),
                windows_plugin_authenticator::RequestType::Registration => {
                    "registration".to_string()
                }
                windows_plugin_authenticator::RequestType::Sync => "sync".to_string(),
            };

            let napi_event = PasskeyRequestEvent {
                request_type,
                request_json,
            };

            // Call the callback asynchronously and capture the return value
            let promise_result: Result<Promise<String>, napi::Error> =
                callback.call_async(Ok(napi_event)).await;
            // awai promse

            match promise_result {
                Ok(promise_result) => match promise_result.await {
                    Ok(result) => {
                        // Parse the JSON response directly back to Rust enum
                        let response: windows_plugin_authenticator::PasskeyResponse =
                            match serde_json::from_str(&result) {
                                Ok(resp) => resp,
                                Err(e) => windows_plugin_authenticator::PasskeyResponse::Error {
                                    message: format!("JSON parse error: {}", e),
                                },
                            };
                        let _ = event.response_sender.send(response);
                    }
                    Err(e) => {
                        eprintln!("Error calling passkey callback inner: {}", e);
                        let _ = event.response_sender.send(
                            windows_plugin_authenticator::PasskeyResponse::Error {
                                message: format!("Inner Callback error: {}", e),
                            },
                        );
                    }
                },
                Err(e) => {
                    eprintln!("Error calling passkey callback: {}", e);
                    let _ = event.response_sender.send(
                        windows_plugin_authenticator::PasskeyResponse::Error {
                            message: format!("Callback error: {}", e),
                        },
                    );
                }
            }
        }
    });

    Ok("Event listener registered successfully".to_string())
}

impl From<windows_plugin_authenticator::SyncedCredential> for SyncedCredential {
    fn from(cred: windows_plugin_authenticator::SyncedCredential) -> Self {
        use base64::Engine;
        Self {
            credential_id: base64::engine::general_purpose::URL_SAFE_NO_PAD
                .encode(&cred.credential_id),
            rp_id: cred.rp_id,
            user_name: cred.user_name,
            user_handle: base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&cred.user_handle),
        }
    }
}

impl From<SyncedCredential> for windows_plugin_authenticator::SyncedCredential {
    fn from(cred: SyncedCredential) -> Self {
        use base64::Engine;
        Self {
            credential_id: base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(&cred.credential_id)
                .unwrap_or_default(),
            rp_id: cred.rp_id,
            user_name: cred.user_name,
            user_handle: base64::engine::general_purpose::URL_SAFE_NO_PAD
                .decode(&cred.user_handle)
                .unwrap_or_default(),
        }
    }
}

pub fn sync_credentials_to_windows(credentials: Vec<SyncedCredential>) -> napi::Result<()> {
    const PLUGIN_CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

    log::info!(
        "[NAPI] sync_credentials_to_windows called with {} credentials",
        credentials.len()
    );

    // Log each credential being synced (with truncated IDs for security)
    for (i, cred) in credentials.iter().enumerate() {
        let truncated_cred_id = if cred.credential_id.len() > 16 {
            format!("{}...", &cred.credential_id[..16])
        } else {
            cred.credential_id.clone()
        };
        let truncated_user_id = if cred.user_handle.len() > 16 {
            format!("{}...", &cred.user_handle[..16])
        } else {
            cred.user_handle.clone()
        };
        log::info!(
            "[NAPI] Credential {}: RP={}, User={}, CredID={}, UserID={}",
            i + 1,
            cred.rp_id,
            cred.user_name,
            truncated_cred_id,
            truncated_user_id
        );
    }

    // Convert NAPI types to internal types using From trait
    let internal_credentials: Vec<windows_plugin_authenticator::SyncedCredential> =
        credentials.into_iter().map(|cred| cred.into()).collect();

    log::info!(
        "[NAPI] Calling Windows Plugin Authenticator sync with CLSID: {}",
        PLUGIN_CLSID
    );
    let result = windows_plugin_authenticator::sync_credentials_to_windows(
        internal_credentials,
        PLUGIN_CLSID,
    );

    match &result {
        Ok(()) => log::info!("[NAPI] sync_credentials_to_windows completed successfully"),
        Err(e) => log::error!("[NAPI] sync_credentials_to_windows failed: {}", e),
    }

    result.map_err(|e| napi::Error::from_reason(format!("Sync credentials failed: {}", e)))
}

pub fn get_credentials_from_windows() -> napi::Result<Vec<SyncedCredential>> {
    const PLUGIN_CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

    log::info!(
        "[NAPI] get_credentials_from_windows called with CLSID: {}",
        PLUGIN_CLSID
    );

    let result = windows_plugin_authenticator::get_credentials_from_windows(PLUGIN_CLSID);

    let internal_credentials = match &result {
        Ok(creds) => {
            log::info!("[NAPI] Retrieved {} credentials from Windows", creds.len());
            result
                .map_err(|e| napi::Error::from_reason(format!("Get credentials failed: {}", e)))?
        }
        Err(e) => {
            log::error!("[NAPI] get_credentials_from_windows failed: {}", e);
            return Err(napi::Error::from_reason(format!(
                "Get credentials failed: {}",
                e
            )));
        }
    };

    // Convert internal types to NAPI types
    let napi_credentials: Vec<SyncedCredential> = internal_credentials
        .into_iter()
        .enumerate()
        .map(|(i, cred)| {
            let result_cred: SyncedCredential = cred.into();
            let truncated_cred_id = if result_cred.credential_id.len() > 16 {
                format!("{}...", &result_cred.credential_id[..16])
            } else {
                result_cred.credential_id.clone()
            };
            log::info!(
                "[NAPI] Retrieved credential {}: RP={}, User={}, CredID={}",
                i + 1,
                result_cred.rp_id,
                result_cred.user_name,
                truncated_cred_id
            );
            result_cred
        })
        .collect();

    log::info!(
        "[NAPI] get_credentials_from_windows completed successfully, returning {} credentials",
        napi_credentials.len()
    );
    Ok(napi_credentials)
}
