use anyhow::Result;
use ashpd::desktop::background::Background;

pub async fn set_autostart(autostart: bool, params: Vec<String>) -> Result<()> {
    let request = if params.is_empty() {
        Background::request().auto_start(autostart)
    } else {
        Background::request().command(params).auto_start(autostart)
    };

    match request.send().await.and_then(|r| r.response()) {
        Ok(response) => {
            println!("[ASHPD] Autostart enabled: {:?}", response);
            Ok(())
        }
        Err(err) => {
            println!("[ASHPD] Error enabling autostart: {}", err);
            Err(anyhow::anyhow!("error enabling autostart {}", err))
        }
    }
}
