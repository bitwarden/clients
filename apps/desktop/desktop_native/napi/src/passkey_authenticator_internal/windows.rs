use anyhow::{anyhow, Result};

pub fn register(authenticator_name: String, clsid: &str, logo_svg: String) -> Result<()> {
    windows_plugin_authenticator::register(authenticator_name, clsid, logo_svg)
        .map_err(|e| anyhow!(e))?;

    Ok(())
}
