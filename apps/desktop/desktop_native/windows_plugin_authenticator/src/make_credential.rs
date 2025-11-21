use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use crate::ipc2::{
    PasskeyRegistrationRequest, PasskeyRegistrationResponse, Position, TimedCallback,
    UserVerification, WindowsProviderClient,
};
use crate::win_webauthn::{
    plugin::{PluginMakeCredentialRequest, PluginMakeCredentialResponse},
    CtapTransport, ErrorKind, HwndExt, WinWebAuthnError,
};

pub fn make_credential(
    ipc_client: &WindowsProviderClient,
    request: PluginMakeCredentialRequest,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    tracing::debug!("=== PluginMakeCredential() called ===");

    // Extract RP information
    let rp_info = request
        .rp_information()
        .ok_or_else(|| "RP information is null".to_string())?;

    let rpid = rp_info.id()?;

    // let rp_name = rp_info.name().unwrap_or_else(|| String::new());

    // Extract user information
    let user = request
        .user_information()
        .ok_or_else(|| "User information is null".to_string())?;

    let user_handle = user
        .id()
        .map_err(|err| format!("User ID is required for registration: {err}"))?
        .to_vec();

    let user_name = user
        .name()
        .map_err(|err| format!("User name is required for registration: {err}"))?;

    // let user_display_name = user.display_name();

    // Extract client data hash
    let client_data_hash = request
        .client_data_hash()
        .map_err(|err| format!("Client data hash is required for registration: {err}"))?
        .to_vec();

    // Extract supported algorithms
    let supported_algorithms: Vec<i32> = request
        .pub_key_cred_params()
        .iter()
        .map(|params| params.alg())
        .collect();

    // Extract user verification requirement from authenticator options
    let user_verification = match request
        .authenticator_options()
        .and_then(|opts| opts.user_verification())
    {
        Some(true) => UserVerification::Required,
        Some(false) => UserVerification::Discouraged,
        None => UserVerification::Preferred,
    };

    // Extract excluded credentials from credential list
    let excluded_credentials: Vec<Vec<u8>> = request
        .exclude_credentials()
        .iter()
        .filter_map(|cred| cred.credential_id())
        .map(|id| id.to_vec())
        .collect();
    if !excluded_credentials.is_empty() {
        tracing::debug!(
            "Found {} excluded credentials for make credential",
            excluded_credentials.len()
        );
    }

    let transaction_id = request.transaction_id.to_u128().to_le_bytes().to_vec();
    let client_pos = request
        .window_handle
        .center_position()
        .unwrap_or((640, 480));

    // Create Windows registration request
    let registration_request = PasskeyRegistrationRequest {
        rp_id: rpid.clone(),
        user_handle: user_handle,
        user_name: user_name,
        // user_display_name: user_info.2,
        client_data_hash,
        excluded_credentials,
        user_verification: user_verification,
        supported_algorithms,
        window_xy: Position {
            x: client_pos.0,
            y: client_pos.1,
        },
        context: transaction_id,
    };

    tracing::debug!(
        "Make credential request - RP: {}, User: {}",
        rpid,
        registration_request.user_name
    );

    // Send registration request
    let passkey_response = send_registration_request(ipc_client, registration_request)
        .map_err(|err| format!("Registration request failed: {err}"))?;
    tracing::debug!("Registration response received: {:?}", passkey_response);

    // Create proper WebAuthn response from passkey_response
    tracing::debug!("Creating WebAuthn make credential response");
    let webauthn_response = create_make_credential_response(passkey_response.attestation_object)
        .map_err(|err| format!("Failed to create WebAuthn response: {err}"))?;
    tracing::debug!("Successfully created WebAuthn response: {webauthn_response:?}");
    Ok(webauthn_response)
}

/// Helper for registration requests  
fn send_registration_request(
    ipc_client: &WindowsProviderClient,
    request: PasskeyRegistrationRequest,
) -> Result<PasskeyRegistrationResponse, String> {
    tracing::debug!("Registration request data - RP ID: {}, User ID: {} bytes, User name: {}, Client data hash: {} bytes, Algorithms: {:?}, Excluded credentials: {}", 
        request.rp_id, request.user_handle.len(), request.user_name, request.client_data_hash.len(), request.supported_algorithms, request.excluded_credentials.len());

    let request_json = serde_json::to_string(&request)
        .map_err(|err| format!("Failed to serialize registration request: {err}"))?;
    tracing::debug!("Sending registration request: {}", request_json);
    let callback = Arc::new(TimedCallback::new());
    ipc_client.prepare_passkey_registration(request, callback.clone());
    let response = callback
        .wait_for_response(Duration::from_secs(30))
        .map_err(|_| "Registration request timed out".to_string())?
        .map_err(|err| err.to_string());
    if response.is_ok() {
        tracing::debug!("Requesting credential sync after registering a new credential.");
        ipc_client.send_native_status("request-sync".to_string(), "".to_string());
    }
    response
}

/// Creates a CTAP make credential response from Bitwarden's WebAuthn registration response
fn create_make_credential_response(
    attestation_object: Vec<u8>,
) -> std::result::Result<Vec<u8>, WinWebAuthnError> {
    use ciborium::Value;
    // Use the attestation object directly as the encoded response
    let att_obj_items = ciborium::from_reader::<Value, _>(&attestation_object[..])
        .map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Failed to deserialize WebAuthn attestation object",
                err,
            )
        })?
        .into_map()
        .map_err(|_| WinWebAuthnError::new(ErrorKind::Serialization, "object is not a CBOR map"))?;

    let webauthn_att_obj: HashMap<&str, &Value> = att_obj_items
        .iter()
        .map(|(k, v)| (k.as_text().unwrap(), v))
        .collect();

    let att_fmt = webauthn_att_obj
        .get("fmt")
        .and_then(|s| s.as_text())
        .ok_or(WinWebAuthnError::new(
            ErrorKind::Serialization,
            "could not read `fmt` key as a string",
        ))?
        .to_string();
    let authenticator_data = webauthn_att_obj
        .get("authData")
        .and_then(|d| d.as_bytes())
        .ok_or(WinWebAuthnError::new(
            ErrorKind::Serialization,
            "could not read `authData` key as bytes",
        ))?
        .clone();
    let attestation = PluginMakeCredentialResponse {
        format_type: att_fmt,
        authenticator_data: authenticator_data,
        attestation_statement: None,
        attestation_object: None,
        credential_id: None,
        extensions: None,
        used_transport: CtapTransport::Internal,
        ep_att: false,
        large_blob_supported: false,
        resident_key: true,
        prf_enabled: false,
        unsigned_extension_outputs: None,
        hmac_secret: None,
        third_party_payment: false,
        transports: Some(vec![CtapTransport::Internal, CtapTransport::Hybrid]),
        client_data_json: None,
        registration_response_json: None,
    };
    attestation.to_ctap_response()
}

#[cfg(test)]
mod tests {
    use super::create_make_credential_response;
    #[test]
    fn test_encode_make_credential_custom() {
        let webauthn_att_obj = vec![
            163, 99, 102, 109, 116, 100, 110, 111, 110, 101, 103, 97, 116, 116, 83, 116, 109, 116,
            160, 104, 97, 117, 116, 104, 68, 97, 116, 97, 68, 1, 2, 3, 4,
        ];
        let ctap_att_obj = create_make_credential_response(webauthn_att_obj).unwrap();
        println!("{ctap_att_obj:?}");
        let expected = vec![163, 1, 100, 110, 111, 110, 101, 2, 68, 1, 2, 3, 4, 3, 160];
        assert_eq!(expected, ctap_att_obj);
    }
}
