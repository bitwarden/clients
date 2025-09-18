use anyhow::Result;

#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
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
/// * `input` must be an array of utf-16 encoded characters to insert.
///
/// # Errors
///
/// This function returns an `anyhow::Error` if there is any
/// issue obtaining the window title. Detailed reasons will
/// vary based on platform implementation.
pub fn type_input(input: Vec<u16>) -> Result<()> {
    windowing::type_input(input)
}
