mod status;

use std::{fs::File, io::Read, path::PathBuf, sync::OnceLock};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use status::{handle_status_request, StatusResponse};
use win_webauthn::plugin::Clsid;
use windows::{
    core::HRESULT, ApplicationModel::Package, Win32::Foundation::APPMODEL_ERROR_NO_PACKAGE,
};

static PLUGIN_ID: OnceLock<Clsid> = OnceLock::new();

/// `Package::Current()` reports this when the process is not running from an Appx package.
const NO_PACKAGE: HRESULT = HRESULT::from_win32(APPMODEL_ERROR_NO_PACKAGE.0);

pub async fn run_command(value: String) -> Result<String> {
    let response = dispatch_command(value).await;
    serde_json::to_string(&CommandResult::from(response)).context("Failed to serialize response")
}

async fn dispatch_command(value: String) -> Result<CommandResponse> {
    let request: RunCommandRequest =
        serde_json::from_str(&value).context("Failed to deserialize autofill request")?;

    if request.namespace != "autofill" {
        return Err(anyhow!("Unknown namespace: {}", request.namespace));
    }

    tokio::task::spawn_blocking(move || match request.command {
        RunCommand::Status(_) => handle_status_request().map(CommandResponse::from),
    })
    .await
    .context("Autofill command task failed")?
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RunCommandRequest {
    namespace: String,
    #[serde(flatten)]
    command: RunCommand,
}

#[derive(Deserialize)]
#[serde(tag = "command", content = "params")]
#[serde(rename_all = "camelCase")]
enum RunCommand {
    Status(()),
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
enum CommandResult {
    Success { value: CommandResponse },
    Error { error: String },
}

impl From<anyhow::Result<CommandResponse>> for CommandResult {
    fn from(value: anyhow::Result<CommandResponse>) -> Self {
        match value {
            Ok(response) => Self::Success { value: response },
            Err(err) => Self::Error {
                error: format!("{err:#}"),
            },
        }
    }
}

#[derive(Serialize)]
#[serde(untagged)]
enum CommandResponse {
    Status(StatusResponse),
}

impl From<StatusResponse> for CommandResponse {
    fn from(value: StatusResponse) -> Self {
        Self::Status(value)
    }
}

/// Read the CLSID from the Appx config file, then cache it for the lifetime of the process.
///
/// Returns `Ok(None)` when this build is not packaged as an Appx and so has no plugin. A failure
/// to read a config file that *is* present is returned as an error rather than being cached as
/// "no plugin", which would otherwise wedge the plugin as unavailable until the process restarts.
fn get_clsid() -> Result<Option<Clsid>> {
    if let Some(clsid) = PLUGIN_ID.get() {
        return Ok(Some(*clsid));
    }

    let Some(config_file) = read_plugin_config_file()? else {
        return Ok(None);
    };
    let clsid = Clsid::try_from(format!("{{{}}}", config_file.clsid).as_str())
        .context("Failed to parse valid CLSID from package.")?;

    // Multiple threads may race here, but they all parse the same config file, so whichever
    // value wins is the one they all return.
    Ok(Some(*PLUGIN_ID.get_or_init(|| clsid)))
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
    use serde_json::Value;

    use super::{parse_config, run_command};

    /// Malformed requests are rejected before dispatch, so these never reach Windows.
    async fn run_command_error(json: &str) -> String {
        let response = run_command(json.to_string())
            .await
            .expect("run_command should report failures in its payload, not reject");
        let result: Value = serde_json::from_str(&response).unwrap();

        assert_eq!("error", result["type"], "full response: {result}");
        result["error"]
            .as_str()
            .expect("error payload should be a string")
            .to_string()
    }

    #[tokio::test]
    async fn run_command_reports_unknown_namespace_as_error_result() {
        let json = r#"{"namespace":"not-autofill","command":"status","params":{}}"#;

        let err = run_command_error(json).await;

        assert!(err.contains("Unknown namespace"), "error was: {err}");
    }

    #[tokio::test]
    async fn run_command_reports_unknown_command_as_error_result() {
        let json = r#"{"namespace":"autofill","command":"explode","params":{}}"#;

        run_command_error(json).await;
    }

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
