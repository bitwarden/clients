use anyhow::{anyhow, Result};

pub fn register() -> Result<()> {
    windows_plugin_authenticator::register().map_err(|e| anyhow!(e))?;

    Ok(())
}
