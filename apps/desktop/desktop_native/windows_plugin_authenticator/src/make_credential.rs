use serde_json;
use std::collections::HashMap;
use std::mem::ManuallyDrop;
use std::ptr;
use std::sync::Arc;
use std::time::Duration;
use windows_core::{s, HRESULT};

use crate::com_provider::{
    parse_credential_list, WebAuthnPluginOperationRequest, WebAuthnPluginOperationResponse,
};
use crate::ipc2::{
    PasskeyRegistrationRequest, PasskeyRegistrationResponse, Position, TimedCallback,
    UserVerification, WindowsProviderClient,
};
use crate::util::{delay_load, wstr_to_string, WindowsString};
use crate::webauthn::WEBAUTHN_CREDENTIAL_LIST;

// Windows API types for WebAuthn (from webauthn.h.sample)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_RP_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub pwszId: *const u16,   // PCWSTR
    pub pwszName: *const u16, // PCWSTR
    pub pwszIcon: *const u16, // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_USER_ENTITY_INFORMATION {
    pub dwVersion: u32,
    pub cbId: u32,                   // DWORD
    pub pbId: *const u8,             // PBYTE
    pub pwszName: *const u16,        // PCWSTR
    pub pwszIcon: *const u16,        // PCWSTR
    pub pwszDisplayName: *const u16, // PCWSTR
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETER {
    pub dwVersion: u32,
    pub pwszCredentialType: *const u16, // LPCWSTR
    pub lAlg: i32,                      // LONG - COSE algorithm identifier
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_COSE_CREDENTIAL_PARAMETERS {
    pub cCredentialParameters: u32,
    pub pCredentialParameters: *const WEBAUTHN_COSE_CREDENTIAL_PARAMETER,
}

// Make Credential Request structure (from sample header)
#[repr(C)]
#[derive(Debug, Copy, Clone)]
pub struct WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
    pub dwVersion: u32,
    pub cbRpId: u32,
    pub pbRpId: *const u8,
    pub cbClientDataHash: u32,
    pub pbClientDataHash: *const u8,
    pub pRpInformation: *const WEBAUTHN_RP_ENTITY_INFORMATION,
    pub pUserInformation: *const WEBAUTHN_USER_ENTITY_INFORMATION,
    pub WebAuthNCredentialParameters: WEBAUTHN_COSE_CREDENTIAL_PARAMETERS, // Matches C++ sample
    pub CredentialList: WEBAUTHN_CREDENTIAL_LIST,
    pub cbCborExtensionsMap: u32,
    pub pbCborExtensionsMap: *const u8,
    pub pAuthenticatorOptions: *const crate::webauthn::WebAuthnCtapCborAuthenticatorOptions,
    // Add other fields as needed...
}

struct WEBAUTHN_HMAC_SECRET_SALT {
    /// Size of pbFirst.
    cbFirst: u32,
    // _Field_size_bytes_(cbFirst)
    /// Required
    pbFirst: *mut u8,

    /// Size of pbSecond.
    cbSecond: u32,
    // _Field_size_bytes_(cbSecond)
    pbSecond: *mut u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct WEBAUTHN_EXTENSION {
    pwszExtensionIdentifier: *const u16,
    cbExtension: u32,
    pvExtension: *mut u8,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct WEBAUTHN_EXTENSIONS {
    cExtensions: u32,
    // _Field_size_(cExtensions)
    pExtensions: *mut WEBAUTHN_EXTENSION,
}

#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct WEBAUTHN_CREDENTIAL_ATTESTATION {
    /// Version of this structure, to allow for modifications in the future.
    dwVersion: u32,

    /// Attestation format type
    pwszFormatType: *const u16, // PCWSTR

    /// Size of cbAuthenticatorData.
    cbAuthenticatorData: u32,
    /// Authenticator data that was created for this credential.
    //_Field_size_bytes_(cbAuthenticatorData)
    pbAuthenticatorData: *mut u8,

    /// Size of CBOR encoded attestation information
    /// 0 => encoded as CBOR null value.
    cbAttestation: u32,
    ///Encoded CBOR attestation information
    // _Field_size_bytes_(cbAttestation)
    pbAttestation: *mut u8,

    dwAttestationDecodeType: u32,
    /// Following depends on the dwAttestationDecodeType
    ///  WEBAUTHN_ATTESTATION_DECODE_NONE
    ///      NULL - not able to decode the CBOR attestation information
    ///  WEBAUTHN_ATTESTATION_DECODE_COMMON
    ///      PWEBAUTHN_COMMON_ATTESTATION;
    pvAttestationDecode: *mut u8,

    /// The CBOR encoded Attestation Object to be returned to the RP.
    cbAttestationObject: u32,
    // _Field_size_bytes_(cbAttestationObject)
    pbAttestationObject: *mut u8,

    /// The CredentialId bytes extracted from the Authenticator Data.
    /// Used by Edge to return to the RP.
    cbCredentialId: u32,
    // _Field_size_bytes_(cbCredentialId)
    pbCredentialId: *mut u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_2
    //
    /// Since VERSION 2
    Extensions: WEBAUTHN_EXTENSIONS,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_3
    //
    /// One of the WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    /// the transport that was used.
    dwUsedTransport: u32,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_4
    //
    bEpAtt: bool,
    bLargeBlobSupported: bool,
    bResidentKey: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_5
    //
    bPrfEnabled: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_6
    //
    cbUnsignedExtensionOutputs: u32,
    // _Field_size_bytes_(cbUnsignedExtensionOutputs)
    pbUnsignedExtensionOutputs: *mut u8,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_7
    //
    pHmacSecret: *const WEBAUTHN_HMAC_SECRET_SALT,

    // ThirdPartyPayment Credential or not.
    bThirdPartyPayment: bool,

    //
    // Following fields have been added in WEBAUTHN_CREDENTIAL_ATTESTATION_VERSION_8
    //

    // Multiple WEBAUTHN_CTAP_TRANSPORT_* bits will be set corresponding to
    // the transports that are supported.
    dwTransports: u32,

    // UTF-8 encoded JSON serialization of the client data.
    cbClientDataJSON: u32,
    // _Field_size_bytes_(cbClientDataJSON)
    pbClientDataJSON: *mut u8,

    // UTF-8 encoded JSON serialization of the RegistrationResponse.
    cbRegistrationResponseJSON: u32,
    // _Field_size_bytes_(cbRegistrationResponseJSON)
    pbRegistrationResponseJSON: *mut u8,
}

// Windows API function signatures
type WebAuthNDecodeMakeCredentialRequestFn = unsafe extern "stdcall" fn(
    cbEncoded: u32,
    pbEncoded: *const u8,
    ppMakeCredentialRequest: *mut *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
) -> HRESULT;

type WebAuthNFreeDecodedMakeCredentialRequestFn = unsafe extern "stdcall" fn(
    pMakeCredentialRequest: *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
);

type WebAuthNEncodeMakeCredentialResponseFn = unsafe extern "stdcall" fn(
    cbEncoded: *const WEBAUTHN_CREDENTIAL_ATTESTATION,
    pbEncoded: *mut u32,
    response_bytes: *mut *mut u8,
) -> HRESULT;

// RAII wrapper for decoded make credential request
pub struct DecodedMakeCredentialRequest {
    ptr: *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
    free_fn: Option<WebAuthNFreeDecodedMakeCredentialRequestFn>,
}

impl DecodedMakeCredentialRequest {
    fn new(
        ptr: *const WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST,
        free_fn: Option<WebAuthNFreeDecodedMakeCredentialRequestFn>,
    ) -> Self {
        Self { ptr, free_fn }
    }

    pub fn as_ref(&self) -> &WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST {
        unsafe { &*self.ptr }
    }
}

impl Drop for DecodedMakeCredentialRequest {
    fn drop(&mut self) {
        if !self.ptr.is_null() {
            if let Some(free_fn) = self.free_fn {
                tracing::debug!("Freeing decoded make credential request");
                unsafe {
                    free_fn(self.ptr as *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST);
                }
            }
        }
    }
}

// Function to decode make credential request using Windows API
unsafe fn decode_make_credential_request(
    encoded_request: &[u8],
) -> Result<DecodedMakeCredentialRequest, String> {
    tracing::debug!("Attempting to decode make credential request using Windows API");

    // Try to load the Windows API decode function
    let decode_fn = match delay_load::<WebAuthNDecodeMakeCredentialRequestFn>(
        s!("webauthn.dll"),
        s!("WebAuthNDecodeMakeCredentialRequest"),
    ) {
        Some(func) => func,
        None => {
            return Err(
                "Failed to load WebAuthNDecodeMakeCredentialRequest from webauthn.dll".to_string(),
            );
        }
    };

    // Try to load the free function (optional, might not be available in all versions)
    let free_fn = delay_load::<WebAuthNFreeDecodedMakeCredentialRequestFn>(
        s!("webauthn.dll"),
        s!("WebAuthNFreeDecodedMakeCredentialRequest"),
    );

    // Prepare parameters for the API call
    let cb_encoded = encoded_request.len() as u32;
    let pb_encoded = encoded_request.as_ptr();
    let mut make_credential_request: *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST =
        std::ptr::null_mut();

    // Call the Windows API function
    let result = decode_fn(cb_encoded, pb_encoded, &mut make_credential_request);

    // Check if the call succeeded (following C++ THROW_IF_FAILED pattern)
    if result.is_err() {
        tracing::error!(
            "WebAuthNDecodeMakeCredentialRequest failed with HRESULT: 0x{:08x}",
            result.0
        );
        return Err(format!(
            "Windows API call failed with HRESULT: 0x{:08x}",
            result.0
        ));
    }

    if make_credential_request.is_null() {
        tracing::error!("Windows API succeeded but returned null pointer");
        return Err("Windows API returned null pointer".to_string());
    }

    Ok(DecodedMakeCredentialRequest::new(
        make_credential_request,
        free_fn,
    ))
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
unsafe fn create_make_credential_response(
    attestation_object: Vec<u8>,
) -> std::result::Result<Vec<u8>, HRESULT> {
    use ciborium::Value;
    // Use the attestation object directly as the encoded response
    let att_obj_items = ciborium::from_reader::<Value, _>(&attestation_object[..])
        .map_err(|_| HRESULT(-1))?
        .into_map()
        .map_err(|_| HRESULT(-1))?;

    let webauthn_att_obj: HashMap<&str, &Value> = att_obj_items
        .iter()
        .map(|(k, v)| (k.as_text().unwrap(), v))
        .collect();

    /*
    let ctap_attestation_response = ciborium::Value::Map(vec![
        (Value::Integer(1.into()), webauthn_att_obj["fmt"].clone()),
        (
            Value::Integer(2.into()),
            webauthn_att_obj["authData"].clone(),
        ),
        (
            Value::Integer(3.into()),
            webauthn_att_obj["attStmt"].clone(),
        ),
    ]);

    // Write data into CBOR
    // let mut response = Vec::new();
    // ciborium::into_writer(&ctap_attestation_response, &mut response).map_err(|_| HRESULT(-1))?;
    */

    let webauthn_encode_make_credential_response =
        delay_load::<WebAuthNEncodeMakeCredentialResponseFn>(
            s!("webauthn.dll"),
            s!("WebAuthNEncodeMakeCredentialResponse"),
        )
        .unwrap();
    let att_fmt = webauthn_att_obj
        .get("fmt")
        .ok_or(HRESULT(-1))?
        .as_text()
        .ok_or(HRESULT(-1))?
        .to_utf16();
    let authenticator_data = webauthn_att_obj
        .get("authData")
        .ok_or(HRESULT(-1))?
        .as_bytes()
        .ok_or(HRESULT(-1))?;
    let attestation = WEBAUTHN_CREDENTIAL_ATTESTATION {
        dwVersion: 8,
        pwszFormatType: att_fmt.as_ptr(),
        cbAuthenticatorData: authenticator_data.len() as u32,
        pbAuthenticatorData: authenticator_data.as_ptr() as *mut u8,
        cbAttestation: 0,
        pbAttestation: ptr::null_mut(),
        dwAttestationDecodeType: 0,
        pvAttestationDecode: ptr::null_mut(),
        cbAttestationObject: 0,
        pbAttestationObject: ptr::null_mut(),
        cbCredentialId: 0,
        pbCredentialId: ptr::null_mut(),
        Extensions: WEBAUTHN_EXTENSIONS {
            cExtensions: 0,
            pExtensions: ptr::null_mut(),
        },
        dwUsedTransport: 0x00000010, // INTERNAL
        bEpAtt: false,
        bLargeBlobSupported: false,
        bResidentKey: false,
        bPrfEnabled: false,
        cbUnsignedExtensionOutputs: 0,
        pbUnsignedExtensionOutputs: ptr::null_mut(),
        pHmacSecret: ptr::null_mut(),
        bThirdPartyPayment: false,
        dwTransports: 0x00000030, // INTERNAL, HYBRID
        cbClientDataJSON: 0,
        pbClientDataJSON: ptr::null_mut(),
        cbRegistrationResponseJSON: 0,
        pbRegistrationResponseJSON: ptr::null_mut(),
    };
    let mut response_len = 0;
    let mut response_ptr = ptr::null_mut();
    let result = webauthn_encode_make_credential_response(
        &attestation,
        &mut response_len,
        &mut response_ptr,
    );
    if result.is_err() {
        return Err(result);
    }
    let response = Vec::from_raw_parts(response_ptr, response_len as usize, response_len as usize);

    Ok(response)
    /*
    // Allocate memory for the response data
    let layout = Layout::from_size_align(response_len as usize, 1).map_err(|_| HRESULT(-1))?;
    let response_ptr = alloc(layout);
    if response_ptr.is_null() {
        return Err(HRESULT(-1));
    }

    // Copy response data
    ptr::copy_nonoverlapping(response, response_ptr, response.len());

    // Allocate memory for the response structure
    let response_layout = Layout::new::<WebAuthnPluginOperationResponse>();
    let operation_response_ptr = alloc(response_layout) as *mut WebAuthnPluginOperationResponse;
    if operation_response_ptr.is_null() {
        return Err(HRESULT(-1));
    }

    // Initialize the response
    ptr::write(
        operation_response_ptr,
        WebAuthnPluginOperationResponse {
            encoded_response_byte_count: response.len() as u32,
            encoded_response_pointer: response_ptr,
        },
    );
    tracing::debug!("CTAP-encoded attestation object: {response:?}");
    Ok(operation_response_ptr)
    */
}

/// Implementation of PluginMakeCredential moved from com_provider.rs
pub unsafe fn plugin_make_credential(
    ipc_client: &WindowsProviderClient,
    request: *const WebAuthnPluginOperationRequest,
    response: *mut WebAuthnPluginOperationResponse,
) -> Result<(), HRESULT> {
    tracing::debug!("=== PluginMakeCredential() called ===");

    if request.is_null() {
        tracing::error!("NULL request pointer");
        return Err(HRESULT(-1));
    }

    if response.is_null() {
        tracing::error!("NULL response pointer");
        return Err(HRESULT(-1));
    }

    let req = &*request;
    let transaction_id = format!("{:?}", req.transaction_id);

    let coords = req.window_coordinates().unwrap_or((400, 400));

    if req.encoded_request_byte_count == 0 || req.encoded_request_pointer.is_null() {
        tracing::error!("No encoded request data provided");
        return Err(HRESULT(-1));
    }

    let encoded_request_slice = std::slice::from_raw_parts(
        req.encoded_request_pointer,
        req.encoded_request_byte_count as usize,
    );

    // Try to decode the request using Windows API
    let decoded_wrapper = decode_make_credential_request(encoded_request_slice).map_err(|err| {
        tracing::debug!("ERROR: Failed to decode make credential request: {}", err);
        HRESULT(-1)
    })?;
    let decoded_request = decoded_wrapper.as_ref();
    tracing::debug!("Successfully decoded make credential request using Windows API");

    // Extract RP information
    if decoded_request.pRpInformation.is_null() {
        tracing::error!("RP information is null");
        return Err(HRESULT(-1));
    }

    let rp_info = &*decoded_request.pRpInformation;

    let rpid = if rp_info.pwszId.is_null() {
        tracing::error!("RP ID is null");
        return Err(HRESULT(-1));
    } else {
        match wstr_to_string(rp_info.pwszId) {
            Ok(id) => id,
            Err(e) => {
                tracing::error!("Failed to decode RP ID: {}", e);
                return Err(HRESULT(-1));
            }
        }
    };

    // let rp_name = if rp_info.pwszName.is_null() {
    //     String::new()
    // } else {
    //     wstr_to_string(rp_info.pwszName).unwrap_or_default()
    // };

    // Extract user information
    if decoded_request.pUserInformation.is_null() {
        tracing::error!("User information is null");
        return Err(HRESULT(-1));
    }

    let user = &*decoded_request.pUserInformation;

    let user_id = if user.pbId.is_null() || user.cbId == 0 {
        tracing::error!("User ID is required for registration");
        return Err(HRESULT(-1));
    } else {
        let id_slice = std::slice::from_raw_parts(user.pbId, user.cbId as usize);
        id_slice.to_vec()
    };

    let user_name = if user.pwszName.is_null() {
        tracing::error!("User name is required for registration");
        return Err(HRESULT(-1));
    } else {
        match wstr_to_string(user.pwszName) {
            Ok(name) => name,
            Err(_) => {
                tracing::error!("Failed to decode user name");
                return Err(HRESULT(-1));
            }
        }
    };

    let user_display_name = if user.pwszDisplayName.is_null() {
        None
    } else {
        wstr_to_string(user.pwszDisplayName).ok()
    };

    let user_info = (user_id, user_name, user_display_name);

    // Extract client data hash
    let client_data_hash =
        if decoded_request.cbClientDataHash == 0 || decoded_request.pbClientDataHash.is_null() {
            tracing::error!("Client data hash is required for registration");
            return Err(HRESULT(-1));
        } else {
            let hash_slice = std::slice::from_raw_parts(
                decoded_request.pbClientDataHash,
                decoded_request.cbClientDataHash as usize,
            );
            hash_slice.to_vec()
        };

    // Extract supported algorithms
    let supported_algorithms = if decoded_request
        .WebAuthNCredentialParameters
        .cCredentialParameters
        > 0
        && !decoded_request
            .WebAuthNCredentialParameters
            .pCredentialParameters
            .is_null()
    {
        let params_count = decoded_request
            .WebAuthNCredentialParameters
            .cCredentialParameters as usize;
        let params_ptr = decoded_request
            .WebAuthNCredentialParameters
            .pCredentialParameters;

        (0..params_count)
            .map(|i| unsafe { &*params_ptr.add(i) }.lAlg)
            .collect()
    } else {
        Vec::new()
    };

    // Extract user verification requirement from authenticator options
    let user_verification = if !decoded_request.pAuthenticatorOptions.is_null() {
        let auth_options = &*decoded_request.pAuthenticatorOptions;
        match auth_options.user_verification {
            1 => UserVerification::Required,
            -1 => UserVerification::Discouraged,
            0 | _ => UserVerification::Preferred, // Default or undefined
        }
    } else {
        UserVerification::Preferred // Default or undefined
    };

    // Extract excluded credentials from credential list
    let excluded_credentials = parse_credential_list(&decoded_request.CredentialList);
    if !excluded_credentials.is_empty() {
        tracing::debug!(
            "Found {} excluded credentials for make credential",
            excluded_credentials.len()
        );
    }

    // Create Windows registration request
    let registration_request = PasskeyRegistrationRequest {
        rp_id: rpid.clone(),
        user_handle: user_info.0,
        user_name: user_info.1,
        // user_display_name: user_info.2,
        client_data_hash,
        excluded_credentials,
        user_verification: user_verification,
        supported_algorithms,
        window_xy: Position {
            x: coords.0,
            y: coords.1,
        },
    };

    tracing::debug!(
        "Make credential request - RP: {}, User: {}",
        rpid, registration_request.user_name
    );

    // Send registration request
    let passkey_response =
        send_registration_request(ipc_client, registration_request).map_err(|err| {
            tracing::error!("Registration request failed: {err}");
            HRESULT(-1)
        })?;
    tracing::debug!(
        "Registration response received: {:?}",
        passkey_response
    );

    // Create proper WebAuthn response from passkey_response
    tracing::debug!("Creating WebAuthn make credential response");
    let mut webauthn_response =
        create_make_credential_response(passkey_response.attestation_object).map_err(|err| {
            tracing::error!("Failed to create WebAuthn response: {err}");
            HRESULT(-1)
        })?;
    tracing::debug!(
        "Successfully created WebAuthn response: {webauthn_response:?}"
    );
    (*response).encoded_response_byte_count = webauthn_response.len() as u32;
    (*response).encoded_response_pointer = webauthn_response.as_mut_ptr();
    tracing::debug!("Set pointer, returning HRESULT(0)");
    _ = ManuallyDrop::new(webauthn_response);
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::ptr;

    use windows_core::s;

    use crate::{
        make_credential::{
            create_make_credential_response, WebAuthNEncodeMakeCredentialResponseFn,
            WEBAUTHN_CREDENTIAL_ATTESTATION, WEBAUTHN_EXTENSIONS,
        },
        util::{delay_load, WindowsString},
    };
    #[test]
    fn test_encode_make_credential_custom() {
        let webauthn_att_obj = vec![
            163, 99, 102, 109, 116, 100, 110, 111, 110, 101, 103, 97, 116, 116, 83, 116, 109, 116,
            160, 104, 97, 117, 116, 104, 68, 97, 116, 97, 68, 1, 2, 3, 4,
        ];
        /*
            148, 116, 166, 234, 146, 19, 201,
            156, 47, 116, 178, 36, 146, 179, 32, 207, 64, 38, 42, 148, 193, 169, 80, 160, 57, 127,
            41, 37, 11, 96, 132, 30, 240, 93, 0, 0, 0, 0, 213, 72, 130, 110, 121, 180, 219, 64,
            163, 216, 17, 17, 111, 126, 131, 73, 0, 16, 41, 58, 58, 242, 229, 31, 75, 22, 168, 253,
            151, 122, 177, 155, 237, 89, 165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 154, 18, 243, 88, 48,
            112, 84, 3, 82, 219, 172, 210, 76, 151, 246, 101, 189, 86, 147, 114, 248, 43, 231, 192,
            202, 190, 92, 37, 216, 45, 202, 250, 34, 88, 32, 28, 36, 149, 44, 106, 229, 243, 164,
            190, 234, 102, 125, 168, 224, 155, 182, 190, 178, 218, 158, 98, 11, 57, 187, 41, 10,
            218, 58, 80, 124, 254, 119,
        ];
        */
        let ctap_att_obj = unsafe { create_make_credential_response(webauthn_att_obj).unwrap() };
        println!("{ctap_att_obj:?}");
        let expected = vec![163, 1, 100, 110, 111, 110, 101, 2, 68, 1, 2, 3, 4, 3, 160];
        assert_eq!(expected, ctap_att_obj);
    }

    #[test]
    fn test_encode_make_credential() {
        let response = unsafe {
            let webauthn_encode_make_credential_response =
                delay_load::<WebAuthNEncodeMakeCredentialResponseFn>(
                    s!("webauthn.dll"),
                    s!("WebAuthNEncodeMakeCredentialResponse"),
                )
                .unwrap();
            let mut authenticator_data = vec![1, 2, 3, 4];
            let att_fmt = "none".to_utf16();
            let attestation = WEBAUTHN_CREDENTIAL_ATTESTATION {
                dwVersion: 8,
                pwszFormatType: att_fmt.as_ptr(),
                cbAuthenticatorData: authenticator_data.len() as u32,
                pbAuthenticatorData: authenticator_data.as_mut_ptr(),
                cbAttestation: 0,
                pbAttestation: ptr::null_mut(),
                dwAttestationDecodeType: 0,
                pvAttestationDecode: ptr::null_mut(),
                cbAttestationObject: 0,
                pbAttestationObject: ptr::null_mut(),
                cbCredentialId: 0,
                pbCredentialId: ptr::null_mut(),
                Extensions: WEBAUTHN_EXTENSIONS {
                    cExtensions: 0,
                    pExtensions: ptr::null_mut(),
                },
                dwUsedTransport: 0x00000010, // INTERNAL
                bEpAtt: false,
                bLargeBlobSupported: false,
                bResidentKey: false,
                bPrfEnabled: false,
                cbUnsignedExtensionOutputs: 0,
                pbUnsignedExtensionOutputs: ptr::null_mut(),
                pHmacSecret: ptr::null_mut(),
                bThirdPartyPayment: false,
                dwTransports: 0x00000030, // INTERNAL, HYBRID
                cbClientDataJSON: 0,
                pbClientDataJSON: ptr::null_mut(),
                cbRegistrationResponseJSON: 0,
                pbRegistrationResponseJSON: ptr::null_mut(),
            };
            let mut len = 0;
            let mut response_ptr = ptr::null_mut();
            let result =
                webauthn_encode_make_credential_response(&attestation, &mut len, &mut response_ptr);
            assert!(result.is_ok());
            Vec::from_raw_parts(response_ptr, len as usize, len as usize)
        };
        println!("{response:?}");
        assert_eq!(165, response[0]);
    }
}
