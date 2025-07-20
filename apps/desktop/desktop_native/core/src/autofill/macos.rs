use anyhow::Result;

pub async fn run_command(value: String) -> Result<String> {
    desktop_objc::run_command(value).await
}
