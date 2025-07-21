use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
};

/// Gets the title bar string for the foreground window.
pub fn get_foreground_window_title() -> std::result::Result<String, ()> {
    let Ok(window_handle) = get_foreground_window() else {
        return Err(());
    };
    let Ok(Some(window_title)) = get_window_title(window_handle) else {
        return Err(());
    };

    Ok(window_title)
}

/// Gets the foreground window handle.
///
/// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow
fn get_foreground_window() -> Result<HWND, ()> {
    let foreground_window_handle = unsafe { GetForegroundWindow() };

    if foreground_window_handle.is_invalid() {
        return Err(());
    }

    Ok(foreground_window_handle)
}

/// Gets the length of the window title bar text.
///
/// TODO: Future improvement is to use GetLastError for better error handling
///
/// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextlengthw
fn get_window_title_length(window_handle: HWND) -> Result<usize, ()> {
    if window_handle.is_invalid() {
        return Err(());
    }

    match usize::try_from(unsafe { GetWindowTextLengthW(window_handle) }) {
        Ok(length) => Ok(length),
        Err(_) => Err(()),
    }
}

/// Gets the window title bar title.
///
/// TODO: Future improvement is to use GetLastError for better error handling
///
/// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw
fn get_window_title(window_handle: HWND) -> Result<Option<String>, ()> {
    if window_handle.is_invalid() {
        return Err(());
    }

    let window_title_length = get_window_title_length(window_handle)?;
    if window_title_length == 0 {
        return Ok(None);
    }

    let mut buffer: Vec<u16> = vec![0; window_title_length + 1]; // add extra space for the null character

    let window_title_length = unsafe { GetWindowTextW(window_handle, &mut buffer) };
    if window_title_length == 0 {
        return Ok(None);
    }

    let window_title = OsString::from_wide(&buffer);

    Ok(Some(window_title.to_string_lossy().into_owned()))
}
