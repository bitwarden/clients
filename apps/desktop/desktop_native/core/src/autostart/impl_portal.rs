use anyhow::Result;
use ashpd::desktop::background::Background;
use tracing::{error, info};

pub async fn set_autostart(autostart: bool, params: Vec<String>) -> Result<()> {
    let request = if params.is_empty() {
        Background::request().auto_start(autostart)
    } else {
        Background::request().command(params).auto_start(autostart)
    };

    match request.send().await.and_then(|r| r.response()) {
        Ok(response) => {
            if autostart {
                info!(response = ?response, "[autostart] Successfully enabled autostart");
            } else {
                info!(response = ?response, "[autostart] Successfully disabled autostart");
            }
            Ok(())
        }
        Err(err) => {
            if autostart {
                error!(error = %err, "[autostart] Failed to enable autostart");
            } else {
                error!(error = %err, "[autostart] Failed to disable autostart");
            }
            Err(anyhow::anyhow!("error setting autostart {}", err))
        }
    }
}
