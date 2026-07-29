use std::{fs::File, io::Read, path::PathBuf};

use anyhow::{Context, Result};
use serde::Deserialize;
use windows::{
    core::HRESULT, ApplicationModel::Package, Win32::Foundation::APPMODEL_ERROR_NO_PACKAGE,
};

/// `Package::Current()` reports this when the process is not running from an Appx package.
const NO_PACKAGE: HRESULT = HRESULT::from_win32(APPMODEL_ERROR_NO_PACKAGE.0);

#[allow(clippy::unused_async)]
pub async fn run_command(_value: String) -> Result<String> {
    todo!("Windows does not support autofill");
}

/// Reads config file stored in Appx package.
///
/// Returns `Ok(None)` when this process is not running from an Appx package, and an error when
/// it is packaged but the config file could not be read. Callers must not conflate the two: the
/// former is the normal unpackaged build, the latter is a packaging defect.
pub fn read_plugin_config_file() -> Result<Option<ConfigFile>> {
    // This is set in apps/desktop/electron-builder*.json.
    let Some(config_path) = get_resource_path("plugin_authenticator_config.json")? else {
        return Ok(None);
    };
    tracing::debug!("[core::autofill] Reading config file from {config_path:?}");
    let config_file = File::options()
        .read(true)
        .open(config_path)
        .context("Could not open authenticator config file")?;
    let config: ConfigFile = parse_config(&config_file)?;
    tracing::debug!("[core::autofill] Parsed config file: {config:?}");
    Ok(Some(config))
}

fn parse_config(config_file: impl Read) -> Result<ConfigFile> {
    serde_json::from_reader(config_file).context("Could not parse authenticator config file")
}

/// Reads logo SVG file stored in Appx package.
///
/// Unlike [`read_plugin_config_file`], a missing package is an error rather than `Ok(None)`: the
/// logo is only read once the config file has already established that this build is packaged.
pub fn read_plugin_logo() -> Result<String> {
    // This is set in apps/desktop/electron-builder*.json.
    let logo_path = get_resource_path("plugin_authenticator_logo.svg")?
        .context("Not running from an Appx package")?;

    let mut logo = String::new();
    File::open(logo_path)
        .context("Could not open authenticator logo file")?
        .read_to_string(&mut logo)
        .context("Could not read logo file")?;
    Ok(logo)
}

/// Returns `Ok(None)` when this process is not running from an Appx package.
fn get_resource_path(resource: &str) -> Result<Option<PathBuf>> {
    let installed_location = Package::Current()
        .and_then(|package| package.InstalledLocation())
        .and_then(|folder| folder.Path());
    let mut path = match installed_location {
        Ok(path) => PathBuf::from(path.to_os_string()),
        Err(err) if err.code() == NO_PACKAGE => return Ok(None),
        Err(err) => return Err(err).context("Could not read Appx package location"),
    };
    // Base path of Electron Build
    path.push("app\\resources");
    path.push(resource);
    Ok(Some(path))
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
        let json = br#"{
            "clsid": "0f7dc5d9-69ce-4652-8572-6877fd695062",
            "name": "Bitwarden"
        }"#;
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
            err.to_string().contains("authenticator config file"),
            "error was: {err}"
        );
    }
}
