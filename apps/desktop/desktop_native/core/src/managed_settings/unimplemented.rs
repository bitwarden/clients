//! Non-Windows fallback. macOS and Linux have no Windows registry to read; on those platforms the
//! managed-settings container value is instead read from the Electron main process (see the
//! module doc in `mod.rs`), which never calls into this module. These stubs exist only to satisfy
//! the platform dispatch in `mod.rs`.

use anyhow::Result;

/// Always returns `Ok(None)`: there is no Windows registry to read on this platform.
pub fn read() -> Result<Option<String>> {
    Ok(None)
}

/// No-op: there is nothing to watch on this platform.
pub fn watch(_tx: tokio::sync::mpsc::Sender<()>) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_is_none_on_non_windows() {
        assert_eq!(read().unwrap(), None);
    }
}
