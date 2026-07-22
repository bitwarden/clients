use std::{
    sync::{mpsc::Receiver, Arc},
    time::Duration,
};

use autofill_provider::{
    CallbackError, PasskeyAssertionRequest, PasskeyAssertionResponse,
    PasskeyAssertionWithoutUserInterfaceRequest, Position, TimedCallback, UserVerification,
    WindowDetails,
};
use win_webauthn::{plugin::PluginGetAssertionRequest, CborWriter};

use crate::{
    ipc::IpcClient,
    util::{create_context_string, HwndExt},
};

pub fn get_assertion(
    ipc_client: &dyn IpcClient,
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
        .filter_map(|cred| cred.credential_id().map(|id| id.to_vec()))
        .collect();

    let client_pos = request
        .window_handle
        .center_position()
        .unwrap_or((640, 480));
    let client_window = WindowDetails {
        position: Position {
            x: client_pos.0,
            y: client_pos.1,
        },
        handle: Some(request.window_handle.0.addr().to_le_bytes().to_vec()),
    };

    tracing::debug!(
        "Get assertion request - RP: {}, Allowed credentials: {:?}",
        rp_id,
        allowed_credential_ids
    );
    let context = create_context_string(request.transaction_id, request.operation_request_hash());

    // Send assertion request
    let assertion_request = PasskeyAssertionRequest {
        rp_id,
        client_data_hash,
        allowed_credentials: allowed_credential_ids,
        user_verification,
        client_window,
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
    ipc_client: &dyn IpcClient,
    request: PasskeyAssertionRequest,
    cancellation_token: Receiver<()>,
) -> Result<PasskeyAssertionResponse, String> {
    tracing::debug!(
        "Assertion request data - RP ID: {}, Client data hash: {} bytes, Allowed credentials: {:?}",
        request.rp_id,
        request.client_data_hash.len(),
        request.allowed_credentials,
    );

    let callback = Arc::new(TimedCallback::new());
    if request.allowed_credentials.len() == 1 {
        // Copy details into without user interface. On Windows, we don't
        // require any extra fields, but we use a separate method/type to signal
        // to the desktop app to try resolving this without the UI.
        let request = PasskeyAssertionWithoutUserInterfaceRequest {
            rp_id: request.rp_id,
            credential_id: request.allowed_credentials[0].clone(),
            client_data_hash: request.client_data_hash,
            user_verification: request.user_verification,
            client_window: request.client_window,
            context: request.context,
            // These are currently only used on macOS
            record_identifier: None,
            user_name: None,
            user_handle: None,
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
    // Create CTAP2 GetAssertion response map according to CTAP2 specification
    let mut cbor_data = vec![];
    let mut writer = CborWriter::new(&mut cbor_data);

    let mut num_elements = 4;
    if !user_handle.is_empty() {
        num_elements += 1;
    }
    writer.write_map_start(num_elements)?;

    // [1] credential (optional) - Always include credential descriptor
    writer.write_number(1)?;
    writer.write_map_start(2)?;
    writer.write_text("id")?;
    writer.write_bytes(&credential_id)?;
    writer.write_text("type")?;
    writer.write_text("public-key")?;

    // [2] authenticatorData (required)
    writer.write_number(2)?;
    writer.write_bytes(&authenticator_data)?;

    // [3] signature (required)
    writer.write_number(3)?;
    writer.write_bytes(&signature)?;

    // [4] user (optional) - include if user handle is provided
    if !user_handle.is_empty() {
        writer.write_number(4)?;
        writer.write_map_start(1)?;
        writer.write_text("id")?;
        writer.write_bytes(&user_handle)?;
    }

    // [5] numberOfCredentials (optional), but we'll always send it
    writer.write_number(5)?;
    writer.write_number(1)?;

    // Encode to CBOR with error handling
    tracing::debug!("Formatted CBOR assertion response: {:?}", cbor_data);
    Ok(cbor_data)
}

#[cfg(test)]
mod tests {
    use win_webauthn::{CborParser, CborValue};

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

    #[test]
    fn response_has_five_map_entries_with_non_empty_user_handle() {
        let cbor = create_get_assertion_response(
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
            vec![9, 10, 11, 12],
            vec![13, 14, 15, 16],
        )
        .unwrap();

        let map = CborParser::parse(&cbor).unwrap().into_map().unwrap();
        assert_eq!(map.len(), 5);
    }

    #[test]
    fn response_omits_user_entry_when_user_handle_is_empty() {
        let cbor = create_get_assertion_response(
            vec![1, 2, 3, 4],
            vec![5, 6, 7, 8],
            vec![9, 10, 11, 12],
            vec![], // empty → no [4] user entry
        )
        .unwrap();

        let map = CborParser::parse(&cbor).unwrap().into_map().unwrap();
        assert_eq!(map.len(), 4);
        assert!(!map.iter().any(|(k, _)| *k == CborValue::PositiveInteger(4)));
    }

    #[test]
    fn credential_descriptor_contains_id_and_public_key_type() {
        let credential_id = vec![0xaa, 0xbb, 0xcc, 0xdd];
        let cbor = create_get_assertion_response(
            credential_id.clone(),
            vec![1, 2],
            vec![3, 4],
            vec![5, 6],
        )
        .unwrap();

        let map = CborParser::parse(&cbor).unwrap().into_map().unwrap();
        let (_, cred_descriptor) = map
            .iter()
            .find(|(k, _)| *k == CborValue::PositiveInteger(1))
            .expect("key [1] (credential) must be present");
        let cred_map = match cred_descriptor {
            CborValue::Map(m) => m,
            _ => panic!("credential descriptor must be a CBOR map"),
        };

        let type_entry = cred_map
            .iter()
            .find(|(k, _)| k.as_text() == Some("type"))
            .expect("type key must be present");
        assert_eq!(type_entry.1.as_text(), Some("public-key"));

        let id_entry = cred_map
            .iter()
            .find(|(k, _)| k.as_text() == Some("id"))
            .expect("id key must be present");
        assert_eq!(id_entry.1.as_bytes(), Some(credential_id.as_slice()));
    }
}
