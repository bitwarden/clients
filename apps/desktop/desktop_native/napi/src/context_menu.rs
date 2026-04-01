#[napi]
pub mod context_menu {
    /// Register the Bitwarden context menu in Windows Explorer for both files
    /// and directories.
    ///
    /// - `exe_path`: path to Bitwarden.exe (embedded in registry commands)
    /// - `msix_path`: path to the sparse MSIX package for Win11 modern menu
    /// - `install_dir`: application install directory (external location for sparse package)
    #[napi]
    pub fn register(exe_path: String, msix_path: String, install_dir: String) -> napi::Result<()> {
        Ok(desktop_core::context_menu::register(
            &exe_path,
            &msix_path,
            &install_dir,
        )?)
    }

    /// Remove all Bitwarden context menu entries from Windows Explorer.
    #[napi]
    pub fn unregister() -> napi::Result<()> {
        Ok(desktop_core::context_menu::unregister()?)
    }
}
