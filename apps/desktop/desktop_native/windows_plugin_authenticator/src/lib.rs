#![cfg(target_os = "windows")]
use std::collections::HashSet;

use desktop_core::autofill::{read_plugin_config_file, read_plugin_logo};
use win_webauthn::{
    plugin::{Clsid, PluginAddAuthenticatorOptions, WebAuthnPlugin},
    AuthenticatorInfo, CtapVersion, PublicKeyCredentialParameters,
};

pub const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
pub const RPID: &str = "bitwarden.com";

pub fn register() -> Result<(), String> {
    tracing::debug!("register() called...");
    let Some(config) = read_plugin_config_file()
        .map_err(|err| format!("Could not read the plugin authenticator config file: {err:#}"))?
    else {
        tracing::debug!(
            "Not running from an Appx package, so there is no plugin authenticator to register."
        );
        return Ok(());
    };
    let logo = read_plugin_logo()
        .map_err(|err| format!("Could not read the plugin authenticator logo: {err:#}"))?;

    let aaguid = AAGUID
        .try_into()
        .map_err(|err| format!("Invalid AAGUID `{AAGUID}`: {err}"))?;
    let clsid = Clsid::try_from(format!("{{{}}}", config.clsid).as_ref())
        .map_err(|_| format!("invalid CLSID string: {}", config.clsid))?;

    let options = PluginAddAuthenticatorOptions {
        authenticator_name: config.name.clone(),
        clsid,
        rp_id: Some(RPID.to_string()),
        light_theme_logo_svg: Some(logo.to_string()),
        dark_theme_logo_svg: Some(logo.to_string()),
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
        .map_err(|err| format!("Failed to add the authenticator: {err}"))?;
    // We already registered before, so update the details.
    if response.is_none() {
        let update_options = options.into();
        WebAuthnPlugin::update_authenticator_details(&update_options)
            .map_err(|err| format!("Failed to update the authenticator: {err}"))?;
    }
    tracing::debug!("Added the authenticator: {response:?}");
    Ok(())
}
