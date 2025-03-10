use windows::{
    core::s,
    Win32::{
        Foundation::HWND,
        UI::{
            Input::KeyboardAndMouse::SetFocus,
            WindowsAndMessaging::{FindWindowA, SetForegroundWindow},
        },
    },
};

/// Searches for a window that looks like a security prompt and set it as focused.
/// Only works when the process has permission to foreground, either by being in foreground
/// Or by being given foreground permission https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow#remarks
pub fn focus_security_prompt() {
    let class_name = s!("Credential Dialog Xaml Host");
    let hwnd = unsafe { FindWindowA(class_name, None) };
    if let Ok(hwnd) = hwnd {
        set_focus(hwnd);
    }
}

pub(crate) fn set_focus(window: HWND) {
    unsafe {
        let _ = SetForegroundWindow(window);
        let _ = SetFocus(window);
    }
}
