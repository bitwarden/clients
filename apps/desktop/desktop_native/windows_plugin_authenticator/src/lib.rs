#![cfg(target_os = "windows")]
use std::collections::HashSet;

use desktop_core::autofill::{read_plugin_config_file, read_plugin_logos};
use win_webauthn::{
    plugin::{Clsid, PluginAddAuthenticatorOptions, WebAuthnPlugin},
    AuthenticatorInfo, CtapVersion, PublicKeyCredentialParameters,
};

pub const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
pub const RPID: &str = "bitwarden.com";

/// Errors returned by [register].
#[derive(Debug)]
pub enum RegisterError {
    /// The app is not packaged for the plugin authenticator, so there is nothing to register.
    NotSupported,
    /// The app is packaged for the plugin authenticator, but registration failed.
    Failed(String),
}

pub fn register() -> Result<(), RegisterError> {
    tracing::debug!("register() called...");
    let Some(config) = read_plugin_config_file().map_err(|err| {
        RegisterError::Failed(format!(
            "Could not read the plugin authenticator config file: {err:#}"
        ))
    })?
    else {
        tracing::debug!(
            "Not running from an Appx package, so there is no plugin authenticator to register."
        );
        return Err(RegisterError::NotSupported);
    };
    let (light_logo, dark_logo) = read_plugin_logos().map_err(|err| {
        RegisterError::Failed(format!(
            "Could not read the plugin authenticator logos: {err:#}"
        ))
    })?;

    let aaguid = AAGUID
        .try_into()
        .map_err(|err| RegisterError::Failed(format!("Invalid AAGUID `{AAGUID}`: {err}")))?;
    let clsid = Clsid::try_from(format!("{{{}}}", config.clsid).as_ref())
        .map_err(|_| RegisterError::Failed(format!("invalid CLSID string: {}", config.clsid)))?;

    let options = PluginAddAuthenticatorOptions {
        authenticator_name: config.name.clone(),
        clsid,
        rp_id: Some(RPID.to_string()),
        light_theme_logo_svg: Some(light_logo),
        dark_theme_logo_svg: Some(dark_logo),
        authenticator_info: AuthenticatorInfo {
            versions: HashSet::from([CtapVersion::Fido2_0, CtapVersion::Fido2_1]),
            aaguid,
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
    let response = WebAuthnPlugin::add_authenticator(&options)
        .map_err(|err| RegisterError::Failed(format!("Failed to add the authenticator: {err}")))?;
    // We already registered before, so update the details.
    if response.is_none() {
        let update_options = options.into();
        WebAuthnPlugin::update_authenticator_details(&update_options).map_err(|err| {
            RegisterError::Failed(format!("Failed to update the authenticator: {err}"))
        })?;
    }
    tracing::debug!("Added the authenticator: {response:?}");
    Ok(())
}
