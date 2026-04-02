//! Windows implementation of the Explorer context menu integration.
//!
//! Creates a cascading "Bitwarden" submenu in the Windows Explorer right-click
//! context menu for both files (`*`) and directories (`Directory`). Uses HKCU
//! registry keys so no elevation is required.
//!
//! On Windows 11, additionally registers a Sparse MSIX package to provide a
//! modern context menu entry via an IExplorerCommand COM shell extension.

use anyhow::Result;
use windows_registry::Key;

/// The root registry paths for the legacy context menu entries.
const FILE_ROOT: &str = r"Software\Classes\*\shell\Bitwarden";
const DIRECTORY_ROOT: &str = r"Software\Classes\Directory\shell\Bitwarden";

/// Registry key for storing the Bitwarden install path (used by the shell extension DLL).
const INSTALL_PATH_KEY: &str = r"Software\Bitwarden";

/// The identity name of the sparse package, used for lookup during unregistration.
const SPARSE_PACKAGE_NAME: &str = "8bitSolutionsLLC.BitwardenDesktopShellExtension";

/// Register the Bitwarden context menu entries in the Windows Explorer
/// right-click menu for both files and directories.
///
/// Creates a cascading submenu with a "Create Send" action that launches the
/// Bitwarden desktop app with the selected path.
///
/// On Windows 11, also registers a sparse MSIX package for the modern
/// (top-level) context menu.
pub fn register(exe_path: &str, msix_path: &str, install_dir: &str) -> Result<()> {
    // Write the exe path to the registry for the shell extension DLL to discover
    write_install_path(exe_path)?;

    // Legacy registry entries (Windows 10 + Win11 "Show more options")
    register_for_root(FILE_ROOT, exe_path, "--send-path", "%1")?;
    register_for_root(DIRECTORY_ROOT, exe_path, "--send-path", "%V")?;

    // Sparse package for Windows 11 modern context menu (best-effort)
    if let Err(e) = register_sparse_package(msix_path, install_dir) {
        tracing::warn!("Failed to register sparse package for modern context menu: {e:#}");
    }

    Ok(())
}

/// Remove all Bitwarden context menu entries from the Windows Explorer
/// right-click menu.
pub fn unregister() -> Result<()> {
    // Remove legacy registry entries
    let _ = windows_registry::CURRENT_USER.remove_tree(FILE_ROOT);
    let _ = windows_registry::CURRENT_USER.remove_tree(DIRECTORY_ROOT);

    // Remove sparse package (best-effort)
    if let Err(e) = unregister_sparse_package() {
        tracing::warn!("Failed to unregister sparse package: {e}");
    }

    // Clean up install path registry key
    let _ = windows_registry::CURRENT_USER.remove_tree(INSTALL_PATH_KEY);

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
    key.set_string("Icon", format!("{exe_path},0"))?;
    Ok(())
}

/// Write the Bitwarden executable path to the registry so the shell extension
/// DLL can discover it at runtime.
fn write_install_path(exe_path: &str) -> Result<()> {
    let key = windows_registry::CURRENT_USER.create(INSTALL_PATH_KEY)?;
    key.set_string("InstallPath", exe_path)?;
    Ok(())
}

/// Convert a Windows file path to a file:// URI.
fn path_to_file_uri(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    if normalized.starts_with("//") {
        // UNC path: \\server\share -> file://server/share
        format!("file:{normalized}")
    } else {
        // Local path: C:/path -> file:///C:/path
        format!("file:///{normalized}")
    }
}

/// Register the sparse MSIX package for the Windows 11 modern context menu.
///
/// This gives the app package identity, which allows the COM shell extension DLL
/// to be loaded by explorer.exe for the modern context menu.
fn register_sparse_package(msix_path: &str, install_dir: &str) -> Result<()> {
    use windows::{
        Foundation::Uri,
        Management::Deployment::{AddPackageOptions, PackageManager},
    };

    let pm = PackageManager::new()?;
    let options = AddPackageOptions::new()?;

    // Set the external location to the install directory where the DLL lives
    let install_uri = Uri::CreateUri(&windows_registry::HSTRING::from(path_to_file_uri(
        install_dir,
    )))?;
    options.SetExternalLocationUri(&install_uri)?;

    // Register the sparse package
    let msix_uri = Uri::CreateUri(&windows_registry::HSTRING::from(path_to_file_uri(
        msix_path,
    )))?;
    let result = pm.AddPackageByUriAsync(&msix_uri, &options)?.join()?;

    if !result.IsRegistered()? {
        let error_text = result.ErrorText()?;
        anyhow::bail!("Sparse package deployment failed: {error_text}");
    }

    Ok(())
}

/// Unregister the Bitwarden sparse package if present.
fn unregister_sparse_package() -> Result<()> {
    use windows::Management::Deployment::PackageManager;

    let pm = PackageManager::new()?;

    // Search for our sparse package among the current user's packages
    for pkg in pm.FindPackages()? {
        if let Ok(id) = pkg.Id() {
            if let Ok(name) = id.Name() {
                if name.to_string_lossy() == SPARSE_PACKAGE_NAME {
                    if let Ok(full_name) = id.FullName() {
                        pm.RemovePackageAsync(&full_name)?.join()?;
                    }
                    break;
                }
            }
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[ignore = "requires Windows with registry access"]
    fn test_register_unregister() {
        let exe_path = r"C:\Program Files\Bitwarden\Bitwarden.exe";
        let msix_path = r"C:\Program Files\Bitwarden\bitwarden-sparse.msix";
        let install_dir = r"C:\Program Files\Bitwarden";
        register(exe_path, msix_path, install_dir).expect("Failed to register");
        unregister().expect("Failed to unregister");
    }

    #[test]
    fn test_path_to_file_uri() {
        assert_eq!(
            path_to_file_uri(r"C:\Program Files\Bitwarden"),
            "file:///C:/Program Files/Bitwarden"
        );
        assert_eq!(
            path_to_file_uri(r"\\server\share\path"),
            "file://server/share/path"
        );
    }
}
