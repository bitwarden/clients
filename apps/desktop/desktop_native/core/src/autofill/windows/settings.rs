use anyhow::{Context, Result};
use serde::Serialize;
use windows::{core::HSTRING, Foundation::Uri, System::Launcher};

use super::CommandResponse;

/// Windows settings page where the user can enable passkey providers.
const PASSKEY_SETTINGS_URI: &str = "ms-settings:passkeys-advancedoptions";

/// Windows cannot prompt the user to turn on a passkey provider, so this always reports that the
/// request is unsupported.
pub(super) fn handle_request_enable_request() -> Result<RequestEnableResponse> {
    Ok(RequestEnableResponse {
        supported: false,
        enabled: false,
    })
}

pub(super) fn handle_open_settings_request() -> Result<OpenSettingsResponse> {
    let uri = Uri::CreateUri(&HSTRING::from(PASSKEY_SETTINGS_URI))
        .context("Failed to create the passkey settings URI")?;
    let launched = Launcher::LaunchUriAsync(&uri)
        .and_then(|operation| operation.join())
        .context("Failed to open the passkey settings")?;
    anyhow::ensure!(launched, "Windows did not open the passkey settings");
    Ok(OpenSettingsResponse {})
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct RequestEnableResponse {
    supported: bool,
    enabled: bool,
}

impl From<RequestEnableResponse> for CommandResponse {
    fn from(response: RequestEnableResponse) -> Self {
        Self::RequestEnable(response)
    }
}

#[derive(Serialize)]
pub(super) struct OpenSettingsResponse {}

impl From<OpenSettingsResponse> for CommandResponse {
    fn from(response: OpenSettingsResponse) -> Self {
        Self::OpenSettings(response)
    }
}
