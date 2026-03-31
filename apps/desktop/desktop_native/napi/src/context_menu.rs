#[napi]
pub mod context_menu {
    /// Register the Bitwarden context menu in Windows Explorer for both files
    /// and directories. The `exe_path` is embedded in the registry commands.
    #[napi]
    pub fn register(exe_path: String) -> napi::Result<()> {
        Ok(desktop_core::context_menu::register(&exe_path)?)
    }

    /// Remove all Bitwarden context menu entries from Windows Explorer.
    #[napi]
    pub fn unregister() -> napi::Result<()> {
        Ok(desktop_core::context_menu::unregister()?)
    }
}
