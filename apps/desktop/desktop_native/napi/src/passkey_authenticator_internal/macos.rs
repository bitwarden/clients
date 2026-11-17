use anyhow::{bail, Context, Result};

use super::RegisterError;
use crate::passkey_authenticator::passkey_authenticator::PasskeyProviderState;

pub fn register() -> Result<(), RegisterError> {
    // The OS registers the autofill extension, so there is nothing to do as long as the app is
    // entitled to act as a credential provider.
    if desktop_core::autofill::has_credential_provider_entitlement() {
        Ok(())
    } else {
        Err(RegisterError::NotSupported)
    }
}

pub async fn get_state() -> anyhow::Result<PasskeyProviderState> {
    // The OS registers the autofill extension, so the app only needs the entitlement.
    if !desktop_core::autofill::has_credential_provider_entitlement() {
        return Ok(PasskeyProviderState {
            registered: false,
            enabled: false,
        });
    }
    let status = credential_provider_status().await?;
    Ok(PasskeyProviderState {
        registered: status.passkeys_supported,
        enabled: status.passkeys_supported && status.enabled,
    })
}

/// The app's status as a credential provider.
struct CredentialProviderStatus {
    /// Whether this version of macOS supports passkeys from credential providers.
    passkeys_supported: bool,
    /// Whether the user has enabled the app as a credential provider.
    enabled: bool,
}

/// Gets the app's status as a credential provider.
async fn credential_provider_status() -> Result<CredentialProviderStatus> {
    let output = desktop_core::autofill::run_command(
        serde_json::json!({ "namespace": "autofill", "command": "status", "params": {} })
            .to_string(),
    )
    .await?;
    let output: serde_json::Value =
        serde_json::from_str(&output).context("Failed to parse autofill status output")?;
    if output["type"] != "success" {
        bail!("Failed to get autofill status: {}", output["error"]);
    }
    Ok(CredentialProviderStatus {
        passkeys_supported: output["value"]["support"]["fido2"]
            .as_bool()
            .context("Autofill status output is missing passkey support")?,
        enabled: output["value"]["state"]["enabled"]
            .as_bool()
            .context("Autofill status output is missing the enabled state")?,
    })
}
