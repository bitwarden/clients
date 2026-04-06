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
            info!(
                response = ?response,
                "[ASHPD] Autostart enabled");
            Ok(())
        }
        Err(err) => {
            error!(
                error = %err,
                "[ASHPD] Error enabling autostart");
            Err(anyhow::anyhow!("error enabling autostart {}", err))
        }
    }
}
