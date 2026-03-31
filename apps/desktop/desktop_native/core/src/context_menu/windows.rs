//! Windows implementation of the Explorer context menu integration.
//!
//! Creates a cascading "Bitwarden" submenu in the Windows Explorer right-click
//! context menu for both files (`*`) and directories (`Directory`). Uses HKCU
//! registry keys so no elevation is required.

use anyhow::Result;
use windows_registry::Key;

/// The root registry paths for the context menu entries.
const FILE_ROOT: &str = r"Software\Classes\*\shell\Bitwarden";
const DIRECTORY_ROOT: &str = r"Software\Classes\Directory\shell\Bitwarden";

/// Register the Bitwarden context menu entries in the Windows Explorer
/// right-click menu for both files and directories.
///
/// Creates a cascading submenu with a "Create Send" action that launches the
/// Bitwarden desktop app with the selected path.
pub fn register(exe_path: &str) -> Result<()> {
    register_for_root(FILE_ROOT, exe_path, "--send-path", "%1")?;
    register_for_root(DIRECTORY_ROOT, exe_path, "--send-path", "%V")?;
    Ok(())
}

/// Remove all Bitwarden context menu entries from the Windows Explorer
/// right-click menu.
pub fn unregister() -> Result<()> {
    // remove_tree deletes the key and all subkeys; ignore errors if already absent
    let _ = windows_registry::CURRENT_USER.remove_tree(FILE_ROOT);
    let _ = windows_registry::CURRENT_USER.remove_tree(DIRECTORY_ROOT);
    Ok(())
}

fn register_for_root(root: &str, exe_path: &str, arg_flag: &str, path_var: &str) -> Result<()> {
    // Create the top-level "Bitwarden" cascading menu entry
    let root_key = windows_registry::CURRENT_USER.create(root)?;
    root_key.set_string("MUIVerb", "Bitwarden")?;
    root_key.set_string("SubCommands", "")?;
    set_icon(&root_key, exe_path)?;

    // Create the "Create Send" subcommand
    let create_send_path = format!(r"{root}\shell\CreateSend");
    let create_send_key = windows_registry::CURRENT_USER.create(&create_send_path)?;
    create_send_key.set_string("MUIVerb", "Create Send")?;
    set_icon(&create_send_key, exe_path)?;

    // Create the command that launches the app
    let command_path = format!(r"{root}\shell\CreateSend\command");
    let command_key = windows_registry::CURRENT_USER.create(&command_path)?;
    let command_value = format!(r#""{exe_path}" "{arg_flag}" "{path_var}""#);
    command_key.set_string("", &command_value)?;

    Ok(())
}

fn set_icon(key: &Key, exe_path: &str) -> Result<()> {
    key.set_string("Icon", &format!("{exe_path},0"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires Windows with registry access"]
    fn test_register_unregister() {
        let exe_path = r"C:\Program Files\Bitwarden\Bitwarden.exe";
        register(exe_path).expect("Failed to register");
        unregister().expect("Failed to unregister");
    }
}
