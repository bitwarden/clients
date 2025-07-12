#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
mod windowing;

/*
    Gets the title bar string for the foreground window.
*/
pub fn get_foreground_window_title() -> std::result::Result<String, ()> {
    windowing::get_foreground_window_title()
}
