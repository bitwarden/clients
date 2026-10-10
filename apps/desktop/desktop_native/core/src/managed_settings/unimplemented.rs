//! Linux reads its managed settings from a root-owned file in the Electron main process.

use anyhow::Result;

/// Always `None`, because this platform has no native managed-settings source.
pub fn read() -> Result<Option<String>> {
    Ok(None)
}

/// Does nothing, because this platform has no native managed-settings source.
pub fn watch(_tx: tokio::sync::mpsc::Sender<()>) -> Result<()> {
    Ok(())
}
