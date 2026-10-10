//! Windows-specific window focus management for biometric prompts.
//!
//! A large part of this is hacks to get around limitations with the Windows-Hello API used,
//! since it does not bring the authentication prompt into focus automatically.

use windows::{
    core::s,
    Win32::{
        Foundation::HWND,
        UI::{
            Input::KeyboardAndMouse::{
                SendInput, SetFocus, INPUT, INPUT_0, INPUT_MOUSE, MOUSEEVENTF_MOVE, MOUSEINPUT,
            },
            WindowsAndMessaging::{
                FindWindowA, GetForegroundWindow, IsWindowVisible, SetForegroundWindow,
            },
        },
    },
};

pub(crate) struct HwndHolder(pub(crate) HWND);
unsafe impl Send for HwndHolder {}

pub(crate) fn get_active_window() -> Option<HwndHolder> {
    unsafe { Some(HwndHolder(GetForegroundWindow())) }
}

/// Searches for a window that looks like a security prompt and brings it to the foreground,
/// unless it already is.
pub fn focus_security_prompt() {
    let Ok(hwnd) = (unsafe { FindWindowA(s!("Credential Dialog Xaml Host"), None) }) else {
        return;
    };
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || GetForegroundWindow() == hwnd {
            return;
        }
    }
    set_focus(hwnd);
}

/// Brings a window owned by another process to the foreground from a background process.
fn set_focus(hwnd: HWND) {
    // The Windows Hello signing prompt is shown by CredentialUIBroker.exe without an owner window,
    // and lands behind every other window. It must be focused, or it will error, but it does not
    // focus itself.
    //
    // SetForegroundWindow is refused unless the calling process meets one of the conditions in
    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setforegroundwindow#remarks
    // The desktop app usually runs in the background while the browser extension asks for
    // biometrics, so the only condition it can meet is "the calling process received the last
    // input event". Injecting a zero-distance mouse move satisfies that without moving the cursor.
    // A synthetic key press is avoided on purpose: if the key-up arrives after the prompt took
    // the foreground, UIPI silently drops it and the key stays stuck down system-wide.
    unsafe {
        let input = INPUT {
            r#type: INPUT_MOUSE,
            Anonymous: INPUT_0 {
                mi: MOUSEINPUT {
                    dx: 0,
                    dy: 0,
                    mouseData: 0,
                    dwFlags: MOUSEEVENTF_MOVE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        };
        if SendInput(&[input], std::mem::size_of::<INPUT>() as i32) != 1 {
            tracing::debug!("[Windows Hello] Failed to inject input before focusing the prompt");
        }
        if !SetForegroundWindow(hwnd).as_bool() {
            tracing::debug!("[Windows Hello] SetForegroundWindow on the prompt was refused");
        }
    }
}

/// When restoring focus to the application window, we need a less aggressive method so the electron
/// window doesn't get frozen.
pub(crate) fn restore_focus(hwnd: HWND) {
    unsafe {
        let _ = SetForegroundWindow(hwnd);
        let _ = SetFocus(Some(hwnd));
    }
}
