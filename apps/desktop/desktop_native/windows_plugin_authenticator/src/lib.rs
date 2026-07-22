#![cfg(target_os = "windows")]
use std::{collections::HashSet, io::Read, path::PathBuf};

use serde::Deserialize;
use win_webauthn::{
    plugin::{Clsid, PluginAddAuthenticatorOptions, WebAuthnPlugin},
    AuthenticatorInfo, CtapVersion, PublicKeyCredentialParameters,
};
use windows::ApplicationModel::Package;

pub const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
pub const RPID: &str = "bitwarden.com";

pub fn register() -> Result<(), String> {
    tracing::debug!("register() called...");
    let config = read_config_file()?;
    let logo = read_logo()?;

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

pub fn read_config_file() -> Result<ConfigFile, String> {
    let config_path = get_resource_path("plugin_authenticator_config.json")
        .map_err(|err| format!("Failed to find configuration file path: {err}"))?;

    let config_file = std::fs::File::open(config_path)
        .map_err(|err| format!("Could not open authenticator config file: {err}"))?;
    let config = parse_config(config_file)?;
    tracing::debug!("Found config file: {config:?}");
    Ok(config)
}

fn get_resource_path(resource: &str) -> Result<PathBuf, windows::core::Error> {
    let mut path = Package::Current()
        .and_then(|package| package.InstalledLocation())
        .and_then(|folder| folder.Path())
        .map(|path| PathBuf::from(path.to_os_string()))?;
    path.push("app\\resources");
    path.push(resource);
    Ok(path)
}

fn parse_config(reader: impl std::io::Read) -> Result<ConfigFile, String> {
    serde_json::from_reader(reader)
        .map_err(|err| format!("Could not read authenticator config file: {err}"))
}

fn read_logo() -> Result<String, String> {
    let logo_path = get_resource_path("plugin_authenticator_logo.svg")
        .map_err(|err| format!("Failed to find logo path: {err}"))?;

    let mut logo = String::new();
    std::fs::File::open(logo_path)
        .map_err(|err| format!("Could not open authenticator logo file: {err}"))?
        .read_to_string(&mut logo)
        .map_err(|err| format!("Could not read logo file: {err}"))?;
    Ok(logo)
}

#[derive(Debug, Deserialize)]
pub struct ConfigFile {
    pub clsid: String,
    pub name: String,
}

#[cfg(test)]
mod tests {
    use super::parse_config;

    #[test]
    fn parse_config_succeeds_with_valid_json() {
        let json = br#"{"clsid": "0f7dc5d9-69ce-4652-8572-6877fd695062", "name": "Bitwarden"}"#;
        let config = parse_config(json.as_slice()).unwrap();
        assert_eq!(config.clsid, "0f7dc5d9-69ce-4652-8572-6877fd695062");
        assert_eq!(config.name, "Bitwarden");
    }

    #[test]
    fn parse_config_fails_when_clsid_is_missing() {
        let json = br#"{"name": "Bitwarden"}"#;
        assert!(parse_config(json.as_slice()).is_err());
    }

    #[test]
    fn parse_config_fails_when_name_is_missing() {
        let json = br#"{"clsid": "0f7dc5d9-69ce-4652-8572-6877fd695062"}"#;
        assert!(parse_config(json.as_slice()).is_err());
    }

    #[test]
    fn parse_config_fails_on_malformed_json() {
        let json = b"not json at all";
        assert!(parse_config(json.as_slice()).is_err());
    }

    #[test]
    fn parse_config_error_message_mentions_config_file() {
        let json = b"{}";
        let err = parse_config(json.as_slice()).unwrap_err();
        assert!(
            err.contains("authenticator config file"),
            "error was: {err}"
        );
    }
}
