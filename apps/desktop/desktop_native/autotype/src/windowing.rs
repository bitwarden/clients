/*
    The `windowing` module provides a safe abstraction
    over unsafe Win32 API functions for autotype
    usage.
*/

use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, HARDWAREINPUT, INPUT, INPUT_0, INPUT_TYPE, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    MOUSEINPUT, VIRTUAL_KEY,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
};

/*
    Returns a handle to the foreground window.

    https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow
*/
pub fn get_foreground_window() -> Result<HWND, ()> {
    let foreground_window_handle = unsafe { GetForegroundWindow() };

    if foreground_window_handle.is_invalid() {
        return Err(());
    }

    Ok(foreground_window_handle)
}

/*
    Returns the window title, if possible.

    https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw
    https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror
*/
pub fn get_window_title(window_handle: HWND) -> Result<Option<String>, ()> {
    if window_handle.is_invalid() {
        return Err(());
    }

    let window_title_length = get_window_title_length(window_handle)?;
    if window_title_length == 0 {
        // TODO: Future improvement is to use GetLastError
        return Ok(None);
    }

    let mut buffer: Vec<u16> = vec![0; window_title_length + 1]; // add extra space for the null character

    let window_title_length = unsafe { GetWindowTextW(window_handle, &mut buffer) };
    if window_title_length == 0 {
        // TODO: Future improvement is to use GetLastError
        return Ok(None);
    }

    let window_title = OsString::from_wide(&buffer);
    Ok(Some(window_title.to_string_lossy().into_owned()))
}

/*
    Attempts to type the input text wherever the user's cursor is.

    TODO: a lot, differentiate between unicode and virtual keys, etc.

    https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
    https://learn.microsoft.com/en-us/windows/win32/api/winuser/ns-winuser-keybdinput
*/
pub fn type_input(input: Vec<u8>) -> Result<(), ()> {
    const B_KEY: u16 = 0x42;
    const KEYBOARD_EVENT_KEY_UP: u32 = 2;
    const LET_SYSTEM_PROVIDE_TIMESTAMP: u32 = 0;

    let test_input = INPUT {
        r#type: INPUT_TYPE(0),
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(B_KEY),
                wScan: 0,
                dwFlags: KEYBD_EVENT_FLAGS(KEYBOARD_EVENT_KEY_UP),
                time: LET_SYSTEM_PROVIDE_TIMESTAMP,
                dwExtraInfo: 0,
            },
        },
    };

    let test_input_vec: Vec<INPUT> = vec![test_input];
    let test_input_vec_mem_size: usize = std::mem::size_of::<INPUT>() * test_input_vec.len();

    let insert_count = unsafe { SendInput(&test_input_vec, test_input_vec_mem_size as i32) };

    if insert_count <= 0 {
        Err(())
    } else if insert_count != input.len() as u32 {
        Err(())
    } else {
        Ok(())
    }
}

/*
    Gets the length of the title for a window.

    https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextlengthw
    https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror
*/
fn get_window_title_length(window_handle: HWND) -> Result<usize, ()> {
    if window_handle.is_invalid() {
        return Err(());
    }

    match unsafe { usize::try_from(GetWindowTextLengthW(window_handle)) } {
        Ok(length) => Ok(length),
        // TODO: Future improvement is to use GetLastError
        Err(_) => Err(()),
    }
}
