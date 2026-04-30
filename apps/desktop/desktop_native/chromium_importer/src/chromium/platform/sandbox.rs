/// Sandbox specific (for Mac App Store Builds)
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

// Bundle IDs of supported Chromium browsers - used to determine if browser is installed
const BROWSER_BUNDLE_IDS: &[(&str, &str)] = &[
    ("Chrome", "com.google.Chrome"),
    ("Chromium", "org.chromium.Chromium"),
    ("Microsoft Edge", "com.microsoft.edgemac"),
    ("Brave", "com.brave.Browser"),
    ("Arc", "company.thebrowser.Browser"),
    ("Opera", "com.operasoftware.Opera"),
    ("Vivaldi", "com.vivaldi.Vivaldi"),
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckBrowserInstalledResponse {
    is_installed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type")]
enum CommandResult<T> {
    Success { value: T },
    Error { error: String },
}

#[derive(Debug, Deserialize)]
struct RequestAccessResponse {
    #[allow(dead_code)]
    bookmark: String,
}

#[derive(Debug, Deserialize)]
struct HasStoredAccessResponse {
    #[serde(rename = "hasAccess")]
    has_access: bool,
}

#[derive(Debug, Deserialize)]
struct StartAccessResponse {
    path: String,
}

#[derive(Debug, Serialize)]
struct CommandInput {
    namespace: String,
    command: String,
    params: serde_json::Value,
}

pub struct ScopedBrowserAccess {
    browser_name: String,
    path: PathBuf,
}

impl ScopedBrowserAccess {
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Request access to browser directory and create a security bookmark if access is approved
    pub async fn request_only(browser_name: &str) -> Result<()> {
        let config = crate::chromium::platform::SUPPORTED_BROWSERS
            .iter()
            .find(|b| b.name == browser_name)
            .ok_or_else(|| anyhow!("Unsupported browser: {}", browser_name))?;

        if !is_browser_installed(browser_name).await? {
            return Err(anyhow!(
                "chromiumImporterBrowserNotInstalled:{}",
                browser_name
            ));
        }

        // If we already have a stored bookmark for this browser, skip the picker —
        // `resume` will validate it on the subsequent profile load and re-prompt
        // through this flow only if the bookmark is gone or unusable.
        if has_stored_access(browser_name).await? {
            return Ok(());
        }

        // For macOS, data_dir is always a single-element array
        let relative_path = config
            .data_dir
            .first()
            .ok_or_else(|| anyhow!("No data directory configured for browser"))?;

        let input = CommandInput {
            namespace: "chromium_importer".to_string(),
            command: "request_access".to_string(),
            params: serde_json::json!({
                "browserName": browser_name,
                "relativePath": relative_path,
            }),
        };

        let output = desktop_objc::run_command(serde_json::to_string(&input)?)
            .await
            .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

        let result: CommandResult<RequestAccessResponse> = serde_json::from_str(&output)
            .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

        match result {
            CommandResult::Success { .. } => Ok(()),
            CommandResult::Error { error } => Err(anyhow!("{}", error)),
        }
    }

    /// Resume browser directory access using previously created security bookmark
    pub async fn resume(browser_name: &str) -> Result<Self> {
        if !has_stored_access(browser_name).await? {
            return Err(anyhow!("Access has not been granted for this browser"));
        }

        // Start accessing the browser
        let start_input = CommandInput {
            namespace: "chromium_importer".to_string(),
            command: "start_access".to_string(),
            params: serde_json::json!({
                "browserName": browser_name,
            }),
        };

        let start_output = desktop_objc::run_command(serde_json::to_string(&start_input)?)
            .await
            .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

        let start_result: CommandResult<StartAccessResponse> = serde_json::from_str(&start_output)
            .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

        match start_result {
            CommandResult::Success { value } => Ok(Self {
                browser_name: browser_name.to_string(),
                path: PathBuf::from(value.path),
            }),
            CommandResult::Error { error } => Err(anyhow!("{}", error)),
        }
    }
}

impl Drop for ScopedBrowserAccess {
    fn drop(&mut self) {
        let browser_name = self.browser_name.clone();

        tokio::task::spawn(async move {
            let input = CommandInput {
                namespace: "chromium_importer".to_string(),
                command: "stop_access".to_string(),
                params: serde_json::json!({
                    "browserName": browser_name,
                }),
            };

            if let Ok(input_json) = serde_json::to_string(&input) {
                let _ = desktop_objc::run_command(input_json).await;
            }
        });
    }
}

async fn is_browser_installed(browser_name: &str) -> Result<bool> {
    let bundle_id = BROWSER_BUNDLE_IDS
        .iter()
        .find(|(name, _)| *name == browser_name)
        .map(|(_, id)| *id);

    let Some(bundle_id) = bundle_id else {
        return Ok(true);
    };

    let input = CommandInput {
        namespace: "chromium_importer".to_string(),
        command: "check_browser_installed".to_string(),
        params: serde_json::json!({
            "bundleId": bundle_id,
        }),
    };

    let output = desktop_objc::run_command(serde_json::to_string(&input)?)
        .await
        .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

    let result: CommandResult<CheckBrowserInstalledResponse> = serde_json::from_str(&output)
        .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

    match result {
        CommandResult::Success { value } => Ok(value.is_installed),
        CommandResult::Error { error } => Err(anyhow!("{}", error)),
    }
}

async fn has_stored_access(browser_name: &str) -> Result<bool> {
    let input = CommandInput {
        namespace: "chromium_importer".to_string(),
        command: "has_stored_access".to_string(),
        params: serde_json::json!({
            "browserName": browser_name,
        }),
    };

    let output = desktop_objc::run_command(serde_json::to_string(&input)?)
        .await
        .map_err(|e| anyhow!("Failed to call ObjC command: {}", e))?;

    let result: CommandResult<HasStoredAccessResponse> = serde_json::from_str(&output)
        .map_err(|e| anyhow!("Failed to parse ObjC response: {}", e))?;

    match result {
        CommandResult::Success { value } => Ok(value.has_access),
        CommandResult::Error { error } => Err(anyhow!("{}", error)),
    }
}
