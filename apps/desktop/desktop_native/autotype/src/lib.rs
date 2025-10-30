use anyhow::Result;

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
pub fn type_input(input: &[u16], keyboard_shortcut: Vec<String>) -> Result<()> {
    windowing::type_input(input, keyboard_shortcut)
}
