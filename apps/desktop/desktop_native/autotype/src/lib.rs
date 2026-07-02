use anyhow::Result;

#[cfg(target_os = "windows")]
mod modifier_keys;

#[cfg(target_os = "windows")]
pub(crate) use modifier_keys::*;

#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "windows", path = "windows/mod.rs")]
mod windowing;

/// Gets the title bar string for the foreground window.
///
/// # Errors
///
/// This function returns an `anyhow::Error` if there is any
/// issue obtaining the window title. Detailed reasons will
/// vary based on platform implementation.
pub fn get_foreground_window_title() -> Result<String> {
    windowing::get_foreground_window_title()
}

/// Returns the raw bytes of the foreground window handle (HWND).
///
/// # Errors
///
/// Returns an error if the foreground window handle cannot be retrieved or is invalid.
pub fn get_foreground_window_handle() -> Result<Vec<u8>> {
    windowing::get_foreground_window_handle()
}

/// Restores focus to the window identified by the given HWND bytes.
///
/// `settle` — if true, sleeps briefly after restoring focus to give the window manager
/// time to process the focus change before `SendInput` fires.
///
/// # Errors
///
/// Returns an error if the HWND bytes are invalid or the focus cannot be restored.
pub fn focus_window(hwnd: Vec<u8>, settle: bool) -> Result<()> {
    windowing::focus_window(hwnd, settle)
}

/// Attempts to type the input text wherever the user's cursor is.
///
/// # Arguments
///
/// * `input` an array of utf-16 encoded characters to insert.
/// * `keyboard_shortcut` a vector of valid shortcut keys: Control, Alt, Super, Shift, letters a - Z
///
/// # Errors
///
/// This function returns an `anyhow::Error` if there is any
/// issue in typing the input. Detailed reasons will
/// vary based on platform implementation.
pub fn type_input(input: &[u16], keyboard_shortcut: &[String]) -> Result<()> {
    windowing::type_input(input, keyboard_shortcut)
}
