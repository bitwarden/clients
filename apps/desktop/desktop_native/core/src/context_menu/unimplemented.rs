use anyhow::Result;

/// Not supported on this platform.
pub fn register(_exe_path: &str, _msix_path: &str, _install_dir: &str) -> Result<()> {
    anyhow::bail!("Context menu integration is only supported on Windows")
}

/// Not supported on this platform.
pub fn unregister() -> Result<()> {
    anyhow::bail!("Context menu integration is only supported on Windows")
}
