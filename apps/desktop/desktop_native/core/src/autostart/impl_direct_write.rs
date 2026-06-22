//! Direct `.desktop` autostart-file management for plain Linux and Snap.
//!
//! On Snap the autostart Exec uses the bare `bitwarden` command (the snap package name from
//! `electron-builder.json`), not the unpacked `exec_path`, because the exec path is different
//! since the snap sandbox has a filesystem namespace.

use std::{fs, path::Path};

use anyhow::{anyhow, Result};
use tracing::{error, info};

use super::AutostartConfig;

/// The snap package name, used as the autostart Exec command under Snap confinement.
const SNAP_COMMAND: &str = "bitwarden";
/// The autostart file name we write under both plain Linux and Snap.
const DESKTOP_FILE_NAME: &str = "bitwarden.desktop";

/// Plain-Linux autostart: write/remove `~/.config/autostart/bitwarden.desktop`.
pub fn set_autostart_linux(enabled: bool, config: &AutostartConfig) -> Result<()> {
    let home_dir = dirs::home_dir().ok_or_else(|| anyhow!("could not determine home directory"))?;
    let autostart_dir = home_dir.join(".config").join("autostart");
    set_autostart_in_dir(enabled, config, &autostart_dir)
}

/// Write/remove `bitwarden.desktop` in the given autostart directory.
fn set_autostart_in_dir(
    enabled: bool,
    config: &AutostartConfig,
    autostart_dir: &Path,
) -> Result<()> {
    let target = autostart_dir.join(DESKTOP_FILE_NAME);

    if !enabled {
        return remove_file(&target);
    }

    if !Path::new(&config.exec_path).is_absolute() {
        return Err(anyhow!(
            "exec_path must be an absolute path: {}",
            config.exec_path
        ));
    }

    let contents =
        desktop_file_contents(&format!("{} {}", config.exec_path, config.autostart_flag));
    let result = write_desktop_file(autostart_dir, &target, &contents);
    match result {
        Ok(()) => info!(path = ?target, "[autostart] Enabled autostart"),
        Err(ref e) => error!(path = ?target, error = ?e, "[autostart] Failed to enable autostart"),
    }
    result
}

/// Snap autostart: remove every `*.desktop` in `$SNAP_USER_DATA/.config/autostart` (clearing the
/// electron-builder-generated entry), then place a single fresh `bitwarden.desktop` when enabling.
pub fn set_autostart_snap(
    enabled: bool,
    config: &AutostartConfig,
    snap_user_data: &Path,
) -> Result<()> {
    let autostart_dir = snap_user_data.join(".config").join("autostart");
    // Create the autostart directory if it's missing so we can place our entry there.
    fs::create_dir_all(&autostart_dir)?;

    remove_desktop_files(&autostart_dir)?;

    if !enabled {
        return Ok(());
    }

    let target = autostart_dir.join(DESKTOP_FILE_NAME);
    let contents = desktop_file_contents(&format!("{} {}", SNAP_COMMAND, config.autostart_flag));
    let result = write_desktop_file(&autostart_dir, &target, &contents);
    match result {
        Ok(()) => info!(path = ?target, "[autostart] Enabled autostart for Snap"),
        Err(ref e) => {
            error!(path = ?target, error = ?e, "[autostart] Failed to enable autostart for Snap")
        }
    }
    result
}

fn desktop_file_contents(exec: &str) -> String {
    format!(
        "[Desktop Entry]
Type=Application
Name=Bitwarden
Comment=Bitwarden startup script
Exec={exec}
StartupNotify=false
Terminal=false
"
    )
}

fn write_desktop_file(dir: &Path, target: &Path, contents: &str) -> Result<()> {
    fs::create_dir_all(dir)?;
    fs::write(target, contents)?;
    Ok(())
}

fn remove_file(target: &Path) -> Result<()> {
    if target.exists() {
        fs::remove_file(target)?;
        info!(path = ?target, "[autostart] Removed autostart file");
    }
    Ok(())
}

fn remove_desktop_files(dir: &Path) -> Result<()> {
    for entry in fs::read_dir(dir)? {
        let path = entry?.path();
        if path.extension().is_some_and(|ext| ext == "desktop") {
            remove_file(&path)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU32, Ordering};

    use super::*;

    static COUNTER: AtomicU32 = AtomicU32::new(0);

    /// Minimal self-cleaning temp directory (no extra dev-dependencies).
    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new() -> Self {
            let unique = format!(
                "bw-autostart-test-{}-{}",
                std::process::id(),
                COUNTER.fetch_add(1, Ordering::SeqCst)
            );
            let path = std::env::temp_dir().join(unique);
            fs::create_dir_all(&path).unwrap();
            TempDir { path }
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    fn config() -> AutostartConfig {
        AutostartConfig {
            exec_path: "/opt/Bitwarden/bitwarden".to_string(),
            autostart_flag: "--autostart".to_string(),
        }
    }

    #[test]
    fn linux_enable_writes_file_with_exec_and_flag() {
        let dir = TempDir::new();
        let target = dir.path.join("bitwarden.desktop");

        set_autostart_in_dir(true, &config(), &dir.path).unwrap();

        let contents = fs::read_to_string(&target).unwrap();
        assert!(contents.contains("Exec=/opt/Bitwarden/bitwarden --autostart"));
    }

    #[test]
    fn linux_disable_removes_file() {
        let dir = TempDir::new();
        let target = dir.path.join("bitwarden.desktop");

        set_autostart_in_dir(true, &config(), &dir.path).unwrap();
        assert!(target.exists());

        set_autostart_in_dir(false, &config(), &dir.path).unwrap();
        assert!(!target.exists());
    }

    #[test]
    fn linux_enable_rejects_relative_exec_path() {
        let dir = TempDir::new();
        let target = dir.path.join("bitwarden.desktop");
        let cfg = AutostartConfig {
            exec_path: "bitwarden".to_string(),
            autostart_flag: "--autostart".to_string(),
        };

        let result = set_autostart_in_dir(true, &cfg, &dir.path);

        assert!(result.is_err());
        assert!(!target.exists());
    }

    #[test]
    fn linux_disable_is_noop_when_missing() {
        let dir = TempDir::new();

        // Should not error even though no file exists yet.
        set_autostart_in_dir(false, &config(), &dir.path).unwrap();
    }

    #[test]
    fn snap_enable_clears_existing_and_places_single_file() {
        let snap = TempDir::new();
        let cfg = config();
        let autostart_dir = snap.path.join(".config/autostart");
        fs::create_dir_all(&autostart_dir).unwrap();

        fs::write(autostart_dir.join("com.bitwarden.desktop.desktop"), "stale").unwrap();
        fs::write(autostart_dir.join("bitwarden.desktop"), "old contents").unwrap();

        set_autostart_snap(true, &cfg, &snap.path).unwrap();

        let remaining: Vec<_> = fs::read_dir(&autostart_dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(remaining, vec!["bitwarden.desktop".to_string()]);

        let contents = fs::read_to_string(autostart_dir.join("bitwarden.desktop")).unwrap();
        assert!(contents.contains("Exec=bitwarden --autostart"));
        assert!(!contents.contains("old contents"));
    }

    #[test]
    fn snap_disable_clears_all_desktop_files() {
        let snap = TempDir::new();
        let cfg = config();
        let autostart_dir = snap.path.join(".config/autostart");
        fs::create_dir_all(&autostart_dir).unwrap();
        fs::write(autostart_dir.join("com.bitwarden.desktop.desktop"), "stale").unwrap();
        fs::write(autostart_dir.join("bitwarden.desktop"), "old").unwrap();

        set_autostart_snap(false, &cfg, &snap.path).unwrap();

        let remaining = fs::read_dir(&autostart_dir).unwrap().count();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn snap_enable_creates_missing_autostart_dir() {
        let snap = TempDir::new();
        let cfg = config();

        // No .config/autostart directory exists yet; enabling should create it and place our file.
        set_autostart_snap(true, &cfg, &snap.path).unwrap();

        let target = snap.path.join(".config/autostart/bitwarden.desktop");
        assert!(target.exists());
        assert!(fs::read_to_string(&target)
            .unwrap()
            .contains("Exec=bitwarden --autostart"));
    }
}
