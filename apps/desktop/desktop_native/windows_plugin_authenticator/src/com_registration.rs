use std::ptr;

use base64::Engine;
use windows::Win32::System::Com::*;
use windows_core::{s, ComObjectInterface, GUID, HRESULT, HSTRING, PCWSTR};

use crate::com_provider;
use crate::util::delay_load;
use crate::webauthn::*;
use ciborium::value::Value;

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const RPID: &str = "bitwarden.com";
const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
const LOGO_SVG: &str = r#"<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 300 300"><path fill="#ff0000" d="M300 253.125C300 279.023 279.023 300 253.125 300H46.875C20.9766 300 0 279.023 0 253.125V46.875C0 20.9766 20.9766 0 46.875 0H253.125C279.023 0 300 20.9766 300 46.875V253.125Z"/><path fill="#fff" d="M243.105 37.6758C241.201 35.7715 238.945 34.834 236.367 34.834H63.6328C61.0254 34.834 58.7988 35.7715 56.8945 37.6758C54.9902 39.5801 54.0527 41.8359 54.0527 44.4141V159.58C54.0527 168.164 55.7227 176.689 59.0625 185.156C62.4023 193.594 66.5625 201.094 71.5137 207.656C76.4648 214.189 82.3535 220.576 89.209 226.787C96.0645 232.998 102.393 238.125 108.164 242.227C113.965 246.328 120 250.195 126.299 253.857C132.598 257.52 137.08 259.98 139.717 261.27C142.354 262.559 144.492 263.584 146.074 264.258C147.275 264.844 148.564 265.166 149.971 265.166C151.377 265.166 152.666 264.873 153.867 264.258C155.479 263.555 157.588 262.559 160.254 261.27C162.891 259.98 167.373 257.49 173.672 253.857C179.971 250.195 186.006 246.328 191.807 242.227C197.607 238.125 203.936 232.969 210.791 226.787C217.646 220.576 223.535 214.219 228.486 207.656C233.438 201.094 237.568 193.623 240.938 185.156C244.277 176.719 245.947 168.193 245.947 159.58V44.4434C245.977 41.8359 245.01 39.5801 243.105 37.6758ZM220.84 160.664C220.84 202.354 150 238.271 150 238.271V59.502H220.84C220.84 59.502 220.84 118.975 220.84 160.664Z"/></svg>"#;

/// Parses a UUID string (with hyphens) into bytes
fn parse_uuid_to_bytes(uuid_str: &str) -> Result<Vec<u8>, String> {
    let uuid_clean = uuid_str.replace("-", "");
    if uuid_clean.len() != 32 {
        return Err("Invalid UUID format".to_string());
    }

    uuid_clean
        .chars()
        .collect::<Vec<char>>()
        .chunks(2)
        .map(|chunk| {
            let hex_str: String = chunk.iter().collect();
            u8::from_str_radix(&hex_str, 16)
                .map_err(|_| format!("Invalid hex character in UUID: {}", hex_str))
        })
        .collect()
}

/// Converts a CLSID string to a GUID
pub(crate) fn parse_clsid_to_guid_str(clsid_str: &str) -> Result<GUID, String> {
    // Remove hyphens and parse as hex
    let clsid_clean = clsid_str.replace("-", "");
    if clsid_clean.len() != 32 {
        return Err("Invalid CLSID format".to_string());
    }

    // Convert to u128 and create GUID
    let clsid_u128 = u128::from_str_radix(&clsid_clean, 16)
        .map_err(|_| "Failed to parse CLSID as hex".to_string())?;

    Ok(GUID::from_u128(clsid_u128))
}

/// Converts the CLSID constant string to a GUID
fn parse_clsid_to_guid() -> Result<GUID, String> {
    parse_clsid_to_guid_str(CLSID)
}

/// Generates CBOR-encoded authenticator info according to FIDO CTAP2 specifications
/// See: https://fidoalliance.org/specs/fido-v2.0-ps-20190130/fido-client-to-authenticator-protocol-v2.0-ps-20190130.html#authenticatorGetInfo
fn generate_cbor_authenticator_info() -> Result<Vec<u8>, String> {
    // Parse AAGUID from string format to bytes
    let aaguid_bytes = parse_uuid_to_bytes(AAGUID)?;

    // Create the authenticator info map according to CTAP2 spec
    // Using Vec<(Value, Value)> because that's what ciborium::Value::Map expects
    let mut authenticator_info = Vec::new();

    // 1: versions - Array of supported FIDO versions
    authenticator_info.push((
        Value::Integer(1.into()),
        Value::Array(vec![
            Value::Text("FIDO_2_0".to_string()),
            Value::Text("FIDO_2_1".to_string()),
        ]),
    ));

    // 2: extensions - Array of supported extensions (empty for now)
    authenticator_info.push((Value::Integer(2.into()), Value::Array(vec![])));

    // 3: aaguid - 16-byte AAGUID
    authenticator_info.push((Value::Integer(3.into()), Value::Bytes(aaguid_bytes)));

    // 4: options - Map of supported options
    let options = vec![
        (Value::Text("rk".to_string()), Value::Bool(true)), // resident key
        (Value::Text("up".to_string()), Value::Bool(true)), // user presence
        (Value::Text("uv".to_string()), Value::Bool(true)), // user verification
    ];
    authenticator_info.push((Value::Integer(4.into()), Value::Map(options)));

    // 9: transports - Array of supported transports
    authenticator_info.push((
        Value::Integer(9.into()),
        Value::Array(vec![
            Value::Text("internal".to_string()),
            Value::Text("hybrid".to_string()),
        ]),
    ));

    // 10: algorithms - Array of supported algorithms
    let algorithm = vec![
        (Value::Text("alg".to_string()), Value::Integer((-7).into())), // ES256
        (
            Value::Text("type".to_string()),
            Value::Text("public-key".to_string()),
        ),
    ];
    authenticator_info.push((
        Value::Integer(10.into()),
        Value::Array(vec![Value::Map(algorithm)]),
    ));

    // Encode to CBOR
    let mut buffer = Vec::new();
    ciborium::ser::into_writer(&Value::Map(authenticator_info), &mut buffer)
        .map_err(|e| format!("Failed to encode CBOR: {}", e))?;

    Ok(buffer)
}

/// Initializes the COM library for use on the calling thread,
/// and registers + sets the security values.
pub fn initialize_com_library() -> std::result::Result<(), String> {
    let result = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };

    if result.is_err() {
        return Err(format!(
            "Error: couldn't initialize the COM library\n{}",
            result.message()
        ));
    }

    match unsafe {
        CoInitializeSecurity(
            None,
            -1,
            None,
            None,
            RPC_C_AUTHN_LEVEL_DEFAULT,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_NONE,
            None,
        )
    } {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "Error: couldn't initialize COM security\n{}",
            e.message()
        )),
    }
}

/// Registers the Bitwarden Plugin Authenticator COM library with Windows.
pub fn register_com_library() -> std::result::Result<(), String> {
    static FACTORY: windows_core::StaticComObject<com_provider::Factory> =
        com_provider::Factory.into_static();
    let clsid_guid = parse_clsid_to_guid().map_err(|e| format!("Failed to parse CLSID: {}", e))?;
    let clsid: *const GUID = &clsid_guid;

    match unsafe {
        CoRegisterClassObject(
            clsid,
            FACTORY.as_interface_ref(),
            //FACTORY.as_interface::<pluginauthenticator::IPluginAuthenticator>(),
            CLSCTX_LOCAL_SERVER,
            REGCLS_MULTIPLEUSE,
        )
    } {
        Ok(_) => Ok(()),
        Err(e) => Err(format!(
            "Error: couldn't register the COM library\n{}",
            e.message()
        )),
    }
}

/// Adds Bitwarden as a plugin authenticator.
pub fn add_authenticator() -> std::result::Result<(), String> {
    let authenticator_name: HSTRING = AUTHENTICATOR_NAME.into();
    let authenticator_name_ptr = PCWSTR(authenticator_name.as_ptr()).as_ptr();

    // Parse CLSID into GUID structure
    let clsid_guid =
        parse_clsid_to_guid().map_err(|e| format!("Failed to parse CLSID to GUID: {}", e))?;

    let relying_party_id: HSTRING = RPID.into();
    let relying_party_id_ptr = PCWSTR(relying_party_id.as_ptr()).as_ptr();

    // Base64-encode the SVG as required by Windows API
    let logo_b64: String = base64::encode(LOGO_SVG);
    let logo_b64_buf: Vec<u16> = logo_b64.encode_utf16().collect();

    // Generate CBOR authenticator info dynamically
    let authenticator_info_bytes = generate_cbor_authenticator_info()
        .map_err(|e| format!("Failed to generate authenticator info: {}", e))?;

    let add_authenticator_options = WebAuthnPluginAddAuthenticatorOptions {
        authenticator_name: authenticator_name_ptr,
        rclsid: &clsid_guid, // Changed to GUID reference
        rpid: relying_party_id_ptr,
        light_theme_logo_svg: logo_b64_buf.as_ptr(),
        dark_theme_logo_svg: logo_b64_buf.as_ptr(),
        cbor_authenticator_info_byte_count: authenticator_info_bytes.len() as u32,
        cbor_authenticator_info: authenticator_info_bytes.as_ptr(), // Use as_ptr() not as_mut_ptr()
        supported_rp_ids_count: 0, // NEW field: 0 means all RPs supported
        supported_rp_ids: ptr::null(), // NEW field
    };

    let mut add_response_ptr: *mut WebAuthnPluginAddAuthenticatorResponse = ptr::null_mut();

    let result = unsafe {
        delay_load::<WebAuthNPluginAddAuthenticatorFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAddAuthenticator"), // Stable function name
        )
    };

    match result {
        Some(api) => {
            let result = unsafe { api(&add_authenticator_options, &mut add_response_ptr) };

            if result.is_err() {
                return Err(format!(
                    "Error: Error response from WebAuthNPluginAddAuthenticator()\n{}",
                    result.message()
                ));
            }

            // Free the response if needed
            if !add_response_ptr.is_null() {
                free_add_authenticator_response(add_response_ptr);
            }

            Ok(())
        },
        None => {
            Err(String::from("Error: Can't complete add_authenticator(), as the function WebAuthNPluginAddAuthenticator can't be found."))
        }
    }
}

fn free_add_authenticator_response(response: *mut WebAuthnPluginAddAuthenticatorResponse) {
    let result = unsafe {
        delay_load::<WebAuthNPluginFreeAddAuthenticatorResponseFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginFreeAddAuthenticatorResponse"),
        )
    };

    if let Some(api) = result {
        unsafe { api(response) };
    }
}

type WebAuthNPluginAddAuthenticatorFnDeclaration = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorOptions: *const WebAuthnPluginAddAuthenticatorOptions,
    ppPluginAddAuthenticatorResponse: *mut *mut WebAuthnPluginAddAuthenticatorResponse,
) -> HRESULT;

type WebAuthNPluginFreeAddAuthenticatorResponseFnDeclaration = unsafe extern "cdecl" fn(
    pPluginAddAuthenticatorResponse: *mut WebAuthnPluginAddAuthenticatorResponse,
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_cbor_authenticator_info() {
        let result = generate_cbor_authenticator_info();
        assert!(result.is_ok(), "CBOR generation should succeed");

        let cbor_bytes = result.unwrap();
        assert!(!cbor_bytes.is_empty(), "CBOR bytes should not be empty");

        // Verify the CBOR can be decoded back
        let decoded: Result<Value, _> = ciborium::de::from_reader(&cbor_bytes[..]);
        assert!(decoded.is_ok(), "Generated CBOR should be valid");

        // Verify it's a map with expected keys
        if let Value::Map(map) = decoded.unwrap() {
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(1.into())),
                "Should contain versions (key 1)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(2.into())),
                "Should contain extensions (key 2)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(3.into())),
                "Should contain aaguid (key 3)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(4.into())),
                "Should contain options (key 4)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(9.into())),
                "Should contain transports (key 9)"
            );
            assert!(
                map.iter().any(|(k, _)| k == &Value::Integer(10.into())),
                "Should contain algorithms (key 10)"
            );
        } else {
            panic!("CBOR should decode to a map");
        }

        // Print the generated CBOR for verification
        println!("Generated CBOR hex: {}", hex::encode(&cbor_bytes));
    }

    #[test]
    fn test_aaguid_parsing() {
        let result = parse_uuid_to_bytes(AAGUID);
        assert!(result.is_ok(), "AAGUID parsing should succeed");

        let aaguid_bytes = result.unwrap();
        assert_eq!(aaguid_bytes.len(), 16, "AAGUID should be 16 bytes");
        assert_eq!(aaguid_bytes[0], 0xd5, "First byte should be 0xd5");
        assert_eq!(aaguid_bytes[1], 0x48, "Second byte should be 0x48");

        // Verify full expected AAGUID
        let expected_hex = "d548826e79b4db40a3d811116f7e8349";
        let expected_bytes = hex::decode(expected_hex).unwrap();
        assert_eq!(
            aaguid_bytes, expected_bytes,
            "AAGUID should match expected value"
        );
    }

    #[test]
    fn test_parse_clsid_to_guid() {
        let result = parse_clsid_to_guid();
        assert!(result.is_ok(), "CLSID parsing should succeed");
    }
}
