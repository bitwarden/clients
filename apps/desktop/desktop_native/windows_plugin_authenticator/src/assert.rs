use serde_json;
use std::{
    sync::{mpsc::Receiver, Arc},
    time::Duration,
};

use win_webauthn::plugin::PluginGetAssertionRequest;

use crate::{
    ipc2::{
        CallbackError, PasskeyAssertionRequest, PasskeyAssertionResponse,
        PasskeyAssertionWithoutUserInterfaceRequest, Position, TimedCallback, UserVerification,
        WindowsProviderClient,
    },
    util::{create_context_string, HwndExt},
};

pub fn get_assertion(
    ipc_client: &WindowsProviderClient,
    request: PluginGetAssertionRequest,
    cancellation_token: Receiver<()>,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Extract RP information
    let rp_id = request.rp_id().to_string();

    // Extract client data hash
    let client_data_hash = request.client_data_hash().to_vec();

    // Extract user verification requirement from authenticator options
    let user_verification = match request
        .authenticator_options()
        .and_then(|opts| opts.user_verification())
    {
        Some(true) => UserVerification::Required,
        Some(false) => UserVerification::Discouraged,
        None => UserVerification::Preferred,
    };

    // Extract allowed credentials from credential list
    let allowed_credential_ids: Vec<Vec<u8>> = request
        .allow_credentials()
        .iter()
        .filter_map(|cred| cred.credential_id())
        .map(|id| id.to_vec())
        .collect();

    let client_window_handle = request.window_handle.0.addr().to_le_bytes().to_vec();
    let client_pos = request
        .window_handle
        .center_position()
        .unwrap_or((640, 480));

    tracing::debug!(
        "Get assertion request - RP: {}, Allowed credentials: {:?}",
        rp_id,
        allowed_credential_ids
    );
    let context = create_context_string(request.transaction_id);

    // Send assertion request
    let assertion_request = PasskeyAssertionRequest {
        rp_id,
        client_data_hash,
        allowed_credentials: allowed_credential_ids,
        user_verification,
        client_window_handle,
        window_xy: Position {
            x: client_pos.0,
            y: client_pos.1,
        },
        context,
    };
    let passkey_response =
        send_assertion_request(ipc_client, assertion_request, cancellation_token)
            .map_err(|err| format!("Failed to get assertion response from IPC channel: {err}"))?;
    tracing::debug!("Assertion response received: {:?}", passkey_response);

    // Create proper WebAuthn response from passkey_response
    tracing::debug!("Creating WebAuthn get assertion response");

    let response = create_get_assertion_response(
        passkey_response.credential_id,
        passkey_response.authenticator_data,
        passkey_response.signature,
        passkey_response.user_handle,
    )?;
    Ok(response)
}

/// Helper for assertion requests
fn send_assertion_request(
    ipc_client: &WindowsProviderClient,
    request: PasskeyAssertionRequest,
    cancellation_token: Receiver<()>,
) -> Result<PasskeyAssertionResponse, String> {
    tracing::debug!(
        "Assertion request data - RP ID: {}, Client data hash: {} bytes, Allowed credentials: {:?}",
        request.rp_id,
        request.client_data_hash.len(),
        request.allowed_credentials,
    );

    let request_json = serde_json::to_string(&request)
        .map_err(|err| format!("Failed to serialize assertion request: {err}"))?;
    tracing::debug!(?request_json, "Sending assertion request");
    let callback = Arc::new(TimedCallback::new());
    if request.allowed_credentials.len() == 1 {
        // copying this into another struct because I'm too lazy to make an enum right now.
        let request = PasskeyAssertionWithoutUserInterfaceRequest {
            rp_id: request.rp_id,
            credential_id: request.allowed_credentials[0].clone(),
            client_data_hash: request.client_data_hash,
            user_verification: request.user_verification,
            client_window_handle: request.client_window_handle,
            window_xy: request.window_xy,
            context: request.context,
        };
        ipc_client.prepare_passkey_assertion_without_user_interface(request, callback.clone());
    } else {
        ipc_client.prepare_passkey_assertion(request, callback.clone());
    }
    let wait_time = Duration::from_secs(600);
    callback
        .wait_for_response(wait_time, Some(cancellation_token))
        .map_err(|err| match err {
            CallbackError::Timeout => "Assertion request timed out".to_string(),
            CallbackError::Cancelled => "Assertion request cancelled".to_string(),
        })?
        .map_err(|err| err.to_string())
}

/// Creates a WebAuthn get assertion response from Bitwarden's assertion response
fn create_get_assertion_response(
    credential_id: Vec<u8>,
    authenticator_data: Vec<u8>,
    signature: Vec<u8>,
    user_handle: Vec<u8>,
) -> std::result::Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Construct a CTAP2 response with the proper structure

    // Create CTAP2 GetAssertion response map according to CTAP2 specification
    let mut cbor_response: Vec<(ciborium::Value, ciborium::Value)> = Vec::new();

    // [1] credential (optional) - Always include credential descriptor
    let credential_map = vec![
        (
            ciborium::Value::Text("id".to_string()),
            ciborium::Value::Bytes(credential_id.clone()),
        ),
        (
            ciborium::Value::Text("type".to_string()),
            ciborium::Value::Text("public-key".to_string()),
        ),
    ];
    cbor_response.push((
        ciborium::Value::Integer(1.into()),
        ciborium::Value::Map(credential_map),
    ));

    // [2] authenticatorData (required)
    cbor_response.push((
        ciborium::Value::Integer(2.into()),
        ciborium::Value::Bytes(authenticator_data),
    ));

    // [3] signature (required)
    cbor_response.push((
        ciborium::Value::Integer(3.into()),
        ciborium::Value::Bytes(signature),
    ));

    // [4] user (optional) - include if user handle is provided
    if !user_handle.is_empty() {
        let user_map = vec![(
            ciborium::Value::Text("id".to_string()),
            ciborium::Value::Bytes(user_handle),
        )];
        cbor_response.push((
            ciborium::Value::Integer(4.into()),
            ciborium::Value::Map(user_map),
        ));
    }

    // [5] numberOfCredentials (optional)
    cbor_response.push((
        ciborium::Value::Integer(5.into()),
        ciborium::Value::Integer(1.into()),
    ));

    let cbor_value = ciborium::Value::Map(cbor_response);

    // Encode to CBOR with error handling
    let mut cbor_data = Vec::new();
    if let Err(e) = ciborium::ser::into_writer(&cbor_value, &mut cbor_data) {
        return Err(format!("Failed to encode CBOR assertion response: {e}"))?;
    }

    tracing::debug!("Formatted CBOR assertion response: {:?}", cbor_data);
    Ok(cbor_data)
}

#[cfg(test)]
mod tests {
    use super::create_get_assertion_response;

    #[test]
    fn test_create_native_assertion_response() {
        let credential_id = vec![1, 2, 3, 4];
        let authenticator_data = vec![5, 6, 7, 8];
        let signature = vec![9, 10, 11, 12];
        let user_handle = vec![13, 14, 15, 16];
        let cbor = create_get_assertion_response(
            credential_id,
            authenticator_data,
            signature,
            user_handle,
        )
        .unwrap();
        // CTAP2_OK, Map(5 elements)
        assert_eq!([0x00, 0xa5], cbor[..2]);
    }
}
