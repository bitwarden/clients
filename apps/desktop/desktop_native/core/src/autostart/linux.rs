use std::path::Path;

use anyhow::Result;

// Explicit paths because this file is itself loaded via `#[path]` from `mod.rs`, which would
// otherwise make the compiler look for these submodules in a `linux/` subdirectory.
#[path = "impl_direct_write.rs"]
mod impl_direct_write;
#[path = "impl_portal.rs"]
mod impl_portal;

const FLATPAK_COMMAND: &str = "bitwarden.sh";
const PARAMETER_PASSTHROUGH: &str = "%U";

/// Values supplied by the Electron main process that the autostart implementations need.
pub struct AutostartConfig {
    /// Absolute path to the app executable (`app.getPath("exe")`).
    pub exec_path: String,
    /// The flag that marks an auto-start launch (`--autostart`).
    pub autostart_flag: String,
}

/// Enable or disable autostart on Linux.
pub async fn set_autostart(enabled: bool, config: AutostartConfig) -> Result<()> {
    if std::env::var_os("container").is_some() {
        let params = if enabled {
            vec![
                FLATPAK_COMMAND.to_string(),
                config.autostart_flag,
                PARAMETER_PASSTHROUGH.to_string(),
            ]
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
