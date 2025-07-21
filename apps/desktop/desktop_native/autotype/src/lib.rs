#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
mod windowing;

/// Gets the title bar string for the foreground window.
///
/// TODO: The error handling will be improved in a future PR: PM-23615
#[allow(clippy::result_unit_err)]
pub fn get_foreground_window_title() -> std::result::Result<String, ()> {
    windowing::get_foreground_window_title()
}
