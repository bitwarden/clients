use std::path::Path;

use anyhow::Result;

// Explicit paths because this file is itself loaded via `#[path]` from `mod.rs`, which would
// otherwise make the compiler look for these submodules in a `linux/` subdirectory.
#[path = "impl_direct_write.rs"]
mod impl_direct_write;
#[path = "impl_portal.rs"]
mod impl_portal;

/// Values supplied by the Electron main process that the autostart implementations need.
pub struct AutostartConfig {
    /// Absolute path to the app executable (`app.getPath("exe")`).
    pub exec_path: String,
    /// The flag that marks an auto-start launch (`--autostart`).
    pub autostart_flag: String,
}

/// Enable or disable autostart on Linux.
///
/// Detection mirrors the renderer's `utils.ts`: a `container` env var means Flatpak (use the XDG
/// background portal), a `SNAP_USER_DATA` env var means Snap, otherwise it's a plain Linux install.
pub async fn set_autostart(enabled: bool, config: AutostartConfig) -> Result<()> {
    if std::env::var_os("container").is_some() {
        let params = if enabled {
            vec![config.autostart_flag]
        } else {
            vec![]
        };
        impl_portal::set_autostart(enabled, params).await
    } else if let Some(snap_user_data) = std::env::var_os("SNAP_USER_DATA") {
        impl_direct_write::set_autostart_snap(enabled, &config, Path::new(&snap_user_data))
    } else {
        impl_direct_write::set_autostart_linux(enabled, &config)
    }
}
