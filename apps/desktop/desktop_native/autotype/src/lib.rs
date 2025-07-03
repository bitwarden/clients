use windows::Win32::UI::Input::KeyboardAndMouse::{RegisterHotKey, HOT_KEY_MODIFIERS, MOD_ALT};
use windows_result::*;

pub fn get_focused_window() {}

/*
    A safe wrapper around the unsafe RegisterHotKey Win32 function.

    https://microsoft.github.io/windows-docs-rs/doc/windows/Win32/UI/Input/KeyboardAndMouse/fn.RegisterHotKey.html
    https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-registerhotkey
*/
pub fn register_hotkey() -> std::result::Result<String, String> {
    let r = unsafe { RegisterHotKey(None, 1, MOD_ALT, 42) }; // ALT + b

    if let windows_result::Result::Err(e) = r {
        return std::result::Result::Err(e.message());
    }

    Ok(String::from("it works!"))
}
