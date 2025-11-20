#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

// New modular structure
mod assert;
mod com_buffer;
mod com_provider;
mod ipc2;
mod make_credential;
mod types;
mod util;
mod webauthn;
mod win_webauthn;

use std::{collections::HashSet, sync::Arc, time::Duration};

// Re-export main functionality
pub use types::UserVerificationRequirement;

use win_webauthn::{PluginAddAuthenticatorOptions, WebAuthnPlugin};

use crate::{
    ipc2::{ConnectionStatus, TimedCallback, WindowsProviderClient},
    win_webauthn::{
        AuthenticatorInfo, CtapVersion, PluginAuthenticator, PluginCancelOperationRequest,
        PluginGetAssertionRequest, PluginLockStatus, PluginMakeCredentialRequest,
        PublicKeyCredentialParameters,
    },
};

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop";
const RPID: &str = "bitwarden.com";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
const LOGO_SVG: &str = r##"<svg version="1.1" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><path fill="#175ddc" d="M300 253.125C300 279.023 279.023 300 253.125 300H46.875C20.9766 300 0 279.023 0 253.125V46.875C0 20.9766 20.9766 0 46.875 0H253.125C279.023 0 300 20.9766 300 46.875V253.125Z"/><path fill="#fff" d="M243.105 37.6758C241.201 35.7715 238.945 34.834 236.367 34.834H63.6328C61.0254 34.834 58.7988 35.7715 56.8945 37.6758C54.9902 39.5801 54.0527 41.8359 54.0527 44.4141V159.58C54.0527 168.164 55.7227 176.689 59.0625 185.156C62.4023 193.594 66.5625 201.094 71.5137 207.656C76.4648 214.189 82.3535 220.576 89.209 226.787C96.0645 232.998 102.393 238.125 108.164 242.227C113.965 246.328 120 250.195 126.299 253.857C132.598 257.52 137.08 259.98 139.717 261.27C142.354 262.559 144.492 263.584 146.074 264.258C147.275 264.844 148.564 265.166 149.971 265.166C151.377 265.166 152.666 264.873 153.867 264.258C155.479 263.555 157.588 262.559 160.254 261.27C162.891 259.98 167.373 257.49 173.672 253.857C179.971 250.195 186.006 246.328 191.807 242.227C197.607 238.125 203.936 232.969 210.791 226.787C217.646 220.576 223.535 214.219 228.486 207.656C233.438 201.094 237.568 193.623 240.938 185.156C244.277 176.719 245.947 168.193 245.947 159.58V44.4434C245.977 41.8359 245.01 39.5801 243.105 37.6758ZM220.84 160.664C220.84 202.354 150 238.271 150 238.271V59.502H220.84C220.84 59.502 220.84 118.975 220.84 160.664Z"/></svg>"##;

/// Handles initialization and registration for the Bitwarden desktop app as a
/// For now, also adds the authenticator
pub fn register() -> std::result::Result<(), String> {
    // TODO: Can we spawn a new named thread for debugging?
    tracing::debug!("register() called...");

    let r = WebAuthnPlugin::initialize();
    tracing::debug!(
        "Initialized the com library with WebAuthnPlugin::initialize(): {:?}",
        r
    );

    let clsid = CLSID.try_into().expect("valid GUID string");
    let plugin = WebAuthnPlugin::new(clsid);

    let r = plugin.register_server(BitwardenPluginAuthenticator);
    tracing::debug!("Registered the com library: {:?}", r);

    tracing::debug!("Parsing authenticator options");
    let aaguid = AAGUID
        .try_into()
        .map_err(|err| format!("Invalid AAGUID `{AAGUID}`: {err}"))?;
    let options = PluginAddAuthenticatorOptions {
        authenticator_name: AUTHENTICATOR_NAME.to_string(),
        clsid,
        rp_id: Some(RPID.to_string()),
        light_theme_logo_svg: Some(LOGO_SVG.to_string()),
        dark_theme_logo_svg: Some(LOGO_SVG.to_string()),
        authenticator_info: AuthenticatorInfo {
            versions: HashSet::from([CtapVersion::Fido2_0, CtapVersion::Fido2_1]),
            aaguid: aaguid,
            options: Some(HashSet::from([
                "rk".to_string(),
                "up".to_string(),
                "uv".to_string(),
            ])),
            transports: Some(HashSet::from([
                "internal".to_string(),
                "hybrid".to_string(),
            ])),
            algorithms: Some(vec![PublicKeyCredentialParameters {
                alg: -7,
                typ: "public-key".to_string(),
            }]),
        },
        supported_rp_ids: None,
    };
    let response = WebAuthnPlugin::add_authenticator(options);
    tracing::debug!("Added the authenticator: {response:?}");

    Ok(())
}

struct BitwardenPluginAuthenticator;

impl BitwardenPluginAuthenticator {
    fn get_client(&self) -> WindowsProviderClient {
        tracing::debug!("Connecting to client via IPC");
        let client = WindowsProviderClient::connect();
        tracing::debug!("Connected to client via IPC successfully");
        client
    }
}

impl PluginAuthenticator for BitwardenPluginAuthenticator {
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        tracing::debug!("Received MakeCredential: {request:?}");
        Err(format!("MakeCredential not implemented").into())
    }

    fn get_assertion(
        &self,
        request: PluginGetAssertionRequest,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        tracing::debug!("Received GetAssertion: {request:?}");
        Err(format!("GetAssertion not implemented").into())
    }

    fn cancel_operation(
        &self,
        request: PluginCancelOperationRequest,
    ) -> Result<(), Box<dyn std::error::Error>> {
        Ok(())
    }

    fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn std::error::Error>> {
        let callback = Arc::new(TimedCallback::new());
        let client = self.get_client();
        client.get_lock_status(callback.clone());
        match callback.wait_for_response(Duration::from_secs(3)) {
            Ok(Ok(response)) => {
                if response.is_unlocked {
                    Ok(PluginLockStatus::PluginUnlocked)
                } else {
                    Ok(PluginLockStatus::PluginLocked)
                }
            }
            Ok(Err(err)) => Err(format!("GetLockStatus() call failed: {err}").into()),
            Err(_) => Err(format!("GetLockStatus() call timed out").into()),
        }
    }
}
