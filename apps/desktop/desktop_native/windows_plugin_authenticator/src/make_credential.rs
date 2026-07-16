use std::{
    collections::HashMap,
    sync::{mpsc::Receiver, Arc},
    time::Duration,
};

use autofill_provider::{
    CallbackError, PasskeyRegistrationRequest, PasskeyRegistrationResponse, Position,
    TimedCallback, UserVerification, WindowDetails,
};
use win_webauthn::{
    plugin::{PluginMakeCredentialRequest, PluginMakeCredentialResponse},
    CborParser, CborValue, CtapTransport,
};

use crate::{
    ipc::IpcClient,
    util::{create_context_string, HwndExt},
};

pub fn make_credential(
    ipc_client: &dyn IpcClient,
    request: PluginMakeCredentialRequest,
    cancellation_token: Receiver<()>,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    tracing::debug!("=== PluginMakeCredential() called ===");
    // Extract RP information
    let rp_info = request.rp_information();

    let rp_id = rp_info.id();

    // Extract user information
    let user = request.user_information();

    let user_handle = user.id().to_vec();

    let user_name = user.name();

    // Extract client data hash
    let client_data_hash = request.client_data_hash().to_vec();

    // Extract supported algorithms
    let supported_algorithms: Vec<i32> = request
        .pub_key_cred_params()
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
        .filter_map(|cred| cred.credential_id().map(|id| id.to_vec()))
        .collect();
    if !excluded_credentials.is_empty() {
        tracing::debug!(
            "Found {} excluded credentials for make credential",
            excluded_credentials.len()
        );
    }

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

    let context = create_context_string(request.transaction_id, request.operation_request_hash());

    // Create Windows registration request
    let registration_request = PasskeyRegistrationRequest {
        rp_id: rp_id.clone(),
        user_handle,
        user_name,
        client_data_hash,
        excluded_credentials,
        user_verification,
        supported_algorithms,
        client_window,
        context,
    };

    tracing::debug!("Make credential request - RP: {rp_id}");

    if let Ok(()) = cancellation_token.try_recv() {
        Err(format!("Request {:?} cancelled", request.transaction_id))?;
    }

    // Send registration request
    let passkey_response =
        send_registration_request(ipc_client, registration_request, cancellation_token)
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
    ipc_client: &dyn IpcClient,
    request: PasskeyRegistrationRequest,
    cancellation_token: Receiver<()>,
) -> Result<PasskeyRegistrationResponse, String> {
    tracing::debug!("Registration request data - RP ID: {}, User ID: {} bytes, Client data hash: {} bytes, Algorithms: {:?}, Excluded credentials: {}",
        request.rp_id, request.user_handle.len(), request.client_data_hash.len(), request.supported_algorithms, request.excluded_credentials.len());

    let callback = Arc::new(TimedCallback::new());
    ipc_client.prepare_passkey_registration(request, callback.clone());
    // Corresponds to maximum recommended timeout for WebAuthn.
    // https://www.w3.org/TR/webauthn-3/#recommended-range-and-default-for-a-webauthn-ceremony-timeout
    let wait_time = Duration::from_secs(600);
    let response = callback
        .wait_for_response(wait_time, Some(cancellation_token))
        .map_err(|err| match err {
            CallbackError::Timeout => "Registration request timed out".to_string(),
            CallbackError::Cancelled => "Registration request cancelled".to_string(),
        })?
        .map_err(|err| err.to_string());
    if response.is_ok() {
        tracing::debug!("Requesting credential sync after registering a new credential.");
        ipc_client.send_native_status("request-sync".to_string(), "".to_string());
    }
    response
}

/// Creates a CTAP2 authenticatorMakeCredential response from Bitwarden's
/// WebAuthn registration response.
fn create_make_credential_response(
    attestation_object: Vec<u8>,
) -> std::result::Result<Vec<u8>, Box<dyn std::error::Error>> {
    // Use the attestation object directly as the encoded response
    let att_obj_items = CborParser::parse(&attestation_object)
        .map_err(|err| format!("Failed to deserialize WebAuthn attestation object: {err}"))?
        .into_map()
        .map_err(|_| "object is not a CBOR map".to_string())?;

    let webauthn_att_obj: HashMap<&str, &CborValue> = att_obj_items
        .iter()
        .filter_map(|(k, v)| k.as_text().map(|s| (s, v)))
        .collect();

    let att_fmt = webauthn_att_obj
        .get("fmt")
        .and_then(|s| s.as_text())
        .ok_or("could not read `fmt` key as a string".to_string())?
        .to_string();
    let authenticator_data = webauthn_att_obj
        .get("authData")
        .and_then(|d| d.as_bytes())
        .ok_or("could not read `authData` key as bytes".to_string())?
        .to_vec();
    let attestation = PluginMakeCredentialResponse {
        format_type: att_fmt,
        authenticator_data,
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
    Ok(attestation.to_ctap_response()?)
}

#[cfg(test)]
mod tests {
    use win_webauthn::CborWriter;

    use super::create_make_credential_response;

    fn build_attestation_object(fmt: &str, auth_data: &[u8]) -> Vec<u8> {
        let mut buf = Vec::new();
        let mut writer = CborWriter::new(&mut buf);
        writer.write_map_start(3).unwrap();
        writer.write_text("fmt").unwrap();
        writer.write_text(fmt).unwrap();
        writer.write_text("attStmt").unwrap();
        writer.write_map_start(0).unwrap();
        writer.write_text("authData").unwrap();
        writer.write_bytes(auth_data).unwrap();
        buf
    }

    #[test]
    fn returns_error_for_non_map_cbor() {
        // CBOR positive integer 1 — not a map
        let not_a_map = vec![0x01u8];
        assert!(create_make_credential_response(not_a_map).is_err());
    }

    #[test]
    fn returns_error_for_empty_input() {
        assert!(create_make_credential_response(vec![]).is_err());
    }

    #[test]
    fn returns_error_when_fmt_key_is_missing() {
        let mut buf = Vec::new();
        let mut writer = CborWriter::new(&mut buf);
        writer.write_map_start(1).unwrap();
        writer.write_text("authData").unwrap();
        writer.write_bytes([1, 2, 3, 4]).unwrap();
        assert!(create_make_credential_response(buf).is_err());
    }

    #[test]
    fn returns_error_when_auth_data_key_is_missing() {
        let mut buf = Vec::new();
        let mut writer = CborWriter::new(&mut buf);
        writer.write_map_start(1).unwrap();
        writer.write_text("fmt").unwrap();
        writer.write_text("none").unwrap();
        assert!(create_make_credential_response(buf).is_err());
    }

    #[test]
    fn parses_fmt_and_auth_data_from_attestation_object() {
        // Build a minimal valid attestation object and verify it is parsed without
        // error up to the Windows API call. The call to to_ctap_response() invokes
        // webauthn.dll, so we only assert that CBOR parsing succeeds by checking
        // that errors from the parser are distinct from Windows API errors.
        let att_obj = build_attestation_object("none", &[0x01, 0x02, 0x03, 0x04]);
        let result = create_make_credential_response(att_obj);
        // Either succeeds (Windows with webauthn.dll) or fails at the Windows API
        // layer — the important thing is it does not fail during CBOR parsing, which
        // would produce a string containing "Failed to deserialize" or "CBOR map".
        if let Err(e) = &result {
            let msg = e.to_string();
            assert!(
                !msg.contains("Failed to deserialize") && !msg.contains("CBOR map"),
                "unexpected CBOR parse error: {msg}"
            );
        }
    }
}
