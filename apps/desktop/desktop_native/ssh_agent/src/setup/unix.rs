//! Shell profile based configuration of `SSH_AUTH_SOCK`.

use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

use anyhow::{anyhow, Result};
use tracing::{debug, info, warn};

/// Written above the generated line so users can recognize and remove it.
const MARKER_COMMENT: &str = "# Bitwarden SSH agent";

/// Placeholder replaced by the socket path in the profile templates below.
const SOCKET_PATH_PLACEHOLDER: &str = "{socket_path}";

/// Shell profiles the export line is appended to, paired with the syntax the
/// shell owning the profile uses.
///
/// e.g. `~/.zshrc` receives `export SSH_AUTH_SOCK="/home/user/.bitwarden-ssh-agent.sock"`
const PROFILES: &[(&str, &str)] = &[
    (".profile", "export SSH_AUTH_SOCK=\"{socket_path}\""),
    (".bashrc", "export SSH_AUTH_SOCK=\"{socket_path}\""),
    (".zshrc", "export SSH_AUTH_SOCK=\"{socket_path}\""),
    (
        ".config/fish/config.fish",
        "set -gx SSH_AUTH_SOCK \"{socket_path}\"",
    ),
];

/// Whether every shell profile already points `SSH_AUTH_SOCK` at the agent.
///
/// # Errors
///
/// Returns an error if the socket path or the home directory cannot be determined,
/// or if a profile cannot be read.
pub fn is_configured() -> Result<bool> {
    all_profiles_configured(&home_dir()?, &crate::socket_address()?)
}

/// Appends the export line to every shell profile that does not have it yet.
///
/// # Errors
///
/// Returns an error if the socket path or the home directory cannot be determined,
/// or if not a single profile could be configured.
pub fn apply_configuration() -> Result<()> {
    let socket_path = crate::socket_address()?;

    apply_to_home(&home_dir()?, &socket_path)
}

/// Every profile is attempted before reporting: one unwritable file (an immutable
/// `~/.zshrc` in a managed home, a sandbox denial) must not stop the profiles after
/// it from being configured.
fn apply_to_home(home: &Path, socket_path: &str) -> Result<()> {
    let mut failed = false;

    for (profile, template) in PROFILES {
        let path = home.join(profile);

        if !profile_applicable(&path) {
            debug!(?path, "shell not set up on this machine, skipping");
            continue;
        }

        if let Err(e) = apply_to_profile(&path, template, socket_path) {
            warn!(?path, error = %e, "could not configure profile");
            failed = true;
        }
    }

    if failed {
        return Err(anyhow!("Could not configure every shell profile"));
    }

    Ok(())
}

fn apply_to_profile(path: &Path, template: &str, socket_path: &str) -> Result<()> {
    if profile_configured(path, socket_path)? {
        debug!(?path, "profile already configured, skipping");

        return Ok(());
    }

    append_line(
        path,
        &template.replace(SOCKET_PATH_PLACEHOLDER, socket_path),
    )?;
    info!(?path, "appended SSH_AUTH_SOCK to profile");

    Ok(())
}

fn all_profiles_configured(home: &Path, socket_path: &str) -> Result<bool> {
    for (profile, _) in PROFILES {
        let path = home.join(profile);

        if profile_applicable(&path) && !profile_configured(&path, socket_path)? {
            return Ok(false);
        }
    }

    Ok(true)
}

/// A profile is only written when its parent directory already exists.
///
/// `~/.profile`, `~/.bashrc` and `~/.zshrc` sit directly in the home directory and
/// are therefore always applicable, while `~/.config/fish/config.fish` is skipped
/// on machines without fish — the sandbox grants cover the file, not the creation
/// of its parent directory.
fn profile_applicable(path: &Path) -> bool {
    path.parent().is_some_and(Path::is_dir)
}

/// A profile counts as configured when it mentions the socket path, regardless of
/// whether we or the user put it there.
fn profile_configured(path: &Path, socket_path: &str) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }

    let contents = fs::read_to_string(path)
        .map_err(|e| anyhow!("Could not read profile {}: {e}", path.display()))?;

    Ok(contents.contains(socket_path))
}

/// Appends at the very end of the file so it overrides anything set earlier.
fn append_line(path: &Path, line: &str) -> Result<()> {
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| anyhow!("Could not open profile {}: {e}", path.display()))?;

    write!(file, "\n{MARKER_COMMENT}\n{line}\n")
        .map_err(|e| anyhow!("Could not write profile {}: {e}", path.display()))
}

/// The user's real home directory, taken from the passwd entry rather than `$HOME`.
///
/// Sandboxed packages point `$HOME` at their own private data directory (the
/// snap revision directory, the macOS app container), so `$HOME` would send the
/// profile writes somewhere no shell ever reads. The sandbox exceptions granted
/// in the snap, flatpak and MAS manifests are all for the real home.
fn home_dir() -> Result<PathBuf> {
    homedir::unix::UserIdentifier::my_id()
        .and_then(|id| id.to_home())
        .ok()
        .flatten()
        .ok_or_else(|| anyhow!("Could not determine home directory"))
}

#[cfg(test)]
mod tests {
    use std::os::unix::fs::PermissionsExt;

    use rand::{distr::Alphanumeric, Rng};

    use super::*;

    /// `r-x------`: readable and traversable, but nothing can be written into it.
    const READ_EXECUTE_ONLY: u32 = 0o500;

    /// `rwx------`, the mode the temporary home is created with.
    const OWNER_ALL: u32 = 0o700;

    const SOCKET_PATH: &str = "/home/test/.bitwarden-ssh-agent.sock";

    /// Temporary home directory, removed on drop.
    struct TempHome(PathBuf);

    impl TempHome {
        fn new() -> Self {
            let suffix: String = rand::rng()
                .sample_iter(Alphanumeric)
                .take(12)
                .map(char::from)
                .collect();
            let path = std::env::temp_dir().join(format!("bw-ssh-setup-{suffix}"));
            fs::create_dir_all(&path).unwrap();

            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn read(&self, profile: &str) -> String {
            fs::read_to_string(self.0.join(profile)).unwrap()
        }

        /// Marks fish as installed by creating the directory its config lives in.
        fn with_fish(self) -> Self {
            fs::create_dir_all(self.0.join(".config/fish")).unwrap();

            self
        }
    }

    impl Drop for TempHome {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn apply_creates_missing_profiles() {
        let home = TempHome::new().with_fish();

        apply_to_home(home.path(), SOCKET_PATH).unwrap();

        assert_eq!(
            home.read(".zshrc"),
            format!("\n{MARKER_COMMENT}\nexport SSH_AUTH_SOCK=\"{SOCKET_PATH}\"\n")
        );
        assert_eq!(
            home.read(".profile"),
            format!("\n{MARKER_COMMENT}\nexport SSH_AUTH_SOCK=\"{SOCKET_PATH}\"\n")
        );
        assert!(home
            .read(".config/fish/config.fish")
            .contains(&format!("set -gx SSH_AUTH_SOCK \"{SOCKET_PATH}\"")));
    }

    #[test]
    fn apply_appends_to_existing_profile() {
        let home = TempHome::new();
        fs::write(home.path().join(".bashrc"), "alias ll='ls -l'\n").unwrap();

        apply_to_home(home.path(), SOCKET_PATH).unwrap();

        assert_eq!(
            home.read(".bashrc"),
            format!(
                "alias ll='ls -l'\n\n{MARKER_COMMENT}\nexport SSH_AUTH_SOCK=\"{SOCKET_PATH}\"\n"
            )
        );
    }

    #[test]
    fn apply_is_idempotent() {
        let home = TempHome::new();

        apply_to_home(home.path(), SOCKET_PATH).unwrap();
        let after_first = home.read(".zshrc");
        apply_to_home(home.path(), SOCKET_PATH).unwrap();

        assert_eq!(home.read(".zshrc"), after_first);
    }

    #[test]
    fn profiles_configured_only_once_all_contain_the_path() {
        let home = TempHome::new().with_fish();

        assert!(!all_profiles_configured(home.path(), SOCKET_PATH).unwrap());

        fs::write(home.path().join(".bashrc"), SOCKET_PATH).unwrap();
        assert!(!all_profiles_configured(home.path(), SOCKET_PATH).unwrap());

        apply_to_home(home.path(), SOCKET_PATH).unwrap();
        assert!(all_profiles_configured(home.path(), SOCKET_PATH).unwrap());
    }

    /// The failure is reported, but only after the profiles that can be written
    /// have been: aborting the loop would leave later profiles untouched even on a
    /// retry, because the same profile fails first every time.
    #[test]
    fn unwritable_profile_does_not_stop_the_others() {
        let home = TempHome::new();
        let unwritable = home.path().join(".profile");
        fs::write(&unwritable, "").unwrap();
        set_readonly(&unwritable);

        let result = apply_to_home(home.path(), SOCKET_PATH);

        assert!(result.is_err());
        assert!(home.read(".profile").is_empty());
        assert!(home.read(".bashrc").contains(SOCKET_PATH));
        assert!(home.read(".zshrc").contains(SOCKET_PATH));
    }

    #[test]
    fn apply_fails_when_no_profile_can_be_written() {
        let home = TempHome::new();
        set_readonly(home.path());

        let result = apply_to_home(home.path(), SOCKET_PATH);

        // Restored so the temporary directory can be cleaned up on drop.
        set_writable(home.path());

        assert!(result.is_err());
    }

    fn set_readonly(path: &Path) {
        let mut permissions = fs::metadata(path).unwrap().permissions();
        permissions.set_mode(READ_EXECUTE_ONLY);
        fs::set_permissions(path, permissions).unwrap();
    }

    fn set_writable(path: &Path) {
        let mut permissions = fs::metadata(path).unwrap().permissions();
        permissions.set_mode(OWNER_ALL);
        fs::set_permissions(path, permissions).unwrap();
    }

    /// Without fish installed, applying must still report configured afterwards —
    /// otherwise the setup dialog would re-open forever.
    #[test]
    fn missing_fish_does_not_block_configuration() {
        let home = TempHome::new();

        apply_to_home(home.path(), SOCKET_PATH).unwrap();

        assert!(!home.path().join(".config/fish").exists());
        assert!(all_profiles_configured(home.path(), SOCKET_PATH).unwrap());
    }
}
