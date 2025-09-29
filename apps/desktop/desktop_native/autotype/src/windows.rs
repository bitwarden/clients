use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;

use tracing::debug;
use windows::Win32::Foundation::{GetLastError, HWND};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    VIRTUAL_KEY,
};
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

/// Attempts to type the input text wherever the user's cursor is.
///
/// `input` must be an array of utf-16 encoded characters to insert.
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
pub fn type_input(input: Vec<u16>) -> Result<(), ()> {
    const TAB_KEY: u16 = 9;
    let mut keyboard_inputs: Vec<INPUT> = Vec::new();

    // Release hotkeys
    keyboard_inputs.push(build_virtual_key_input(InputKeyPress::Up, 0x11)); // ctrl
    keyboard_inputs.push(build_virtual_key_input(InputKeyPress::Up, 0x10)); // shift
    keyboard_inputs.push(build_unicode_input(InputKeyPress::Up, 42)); // b

    for i in input {
        let next_down_input = if i == TAB_KEY {
            build_virtual_key_input(InputKeyPress::Down, i as u8)
        } else {
            build_unicode_input(InputKeyPress::Down, i)
        };
        let next_up_input = if i == TAB_KEY {
            build_virtual_key_input(InputKeyPress::Up, i as u8)
        } else {
            build_unicode_input(InputKeyPress::Up, i)
        };

        keyboard_inputs.push(next_down_input);
        keyboard_inputs.push(next_up_input);
    }

    send_input(keyboard_inputs)
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

/// Used in build_input() to specify if an input key is being pressed (down) or released (up).
enum InputKeyPress {
    Down,
    Up,
}

/// A function for easily building keyboard unicode INPUT structs used in SendInput().
///
/// Before modifying this function, make sure you read the SendInput() documentation:
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
fn build_unicode_input(key_press: InputKeyPress, character: u16) -> INPUT {
    match key_press {
        InputKeyPress::Down => INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: Default::default(),
                    wScan: character,
                    dwFlags: KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
        InputKeyPress::Up => INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: Default::default(),
                    wScan: character,
                    dwFlags: KEYEVENTF_KEYUP | KEYEVENTF_UNICODE,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
    }
}

/// A function for easily building keyboard virtual-key INPUT structs used in SendInput().
///
/// Before modifying this function, make sure you read the SendInput() documentation:
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
/// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
fn build_virtual_key_input(key_press: InputKeyPress, virtual_key: u8) -> INPUT {
    match key_press {
        InputKeyPress::Down => INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(virtual_key as u16),
                    wScan: Default::default(),
                    dwFlags: Default::default(),
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
        InputKeyPress::Up => INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(virtual_key as u16),
                    wScan: Default::default(),
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        },
    }
}

/// Attempts to type the provided input wherever the user's cursor is.
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
fn send_input(inputs: Vec<INPUT>) -> Result<(), ()> {
    let insert_count = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };

    let e = unsafe { GetLastError().to_hresult().message() };
    debug!("type_input() called, GetLastError() is: {:?}", e);

    if insert_count == 0 {
        return Err(()); // input was blocked by another thread
    } else if insert_count != inputs.len() as u32 {
        return Err(()); // input insertion not completed
    }

    Ok(())
}
