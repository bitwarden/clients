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
/// `input` must be a vector of utf-16 encoded characters to insert.
/// `keyboard_shortcut` must be a vector of Strings, where valid shortcut keys: Control, Alt, Super, Shift, letters a - Z
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
pub fn type_input(input: Vec<u16>, keyboard_shortcut: Vec<String>) -> Result<(), ()> {
    println!("type_input hotkey: {:?}", keyboard_shortcut);

    const TAB_KEY: u8 = 9;

    let mut keyboard_inputs: Vec<INPUT> = Vec::new();

    // Add key "up" inputs for the shortcut
    for key in keyboard_shortcut {
        keyboard_inputs.push(convert_shortcut_key_to_up_input(key)?);
    }

    // Add key "down" and "up" inputs for the input
    // (currently in this form: {username}/t{password})
    for i in input {
        let next_down_input = if i == TAB_KEY.into() {
            build_virtual_key_input(InputKeyPress::Down, i as u8)
        } else {
            build_unicode_input(InputKeyPress::Down, i)
        };
        let next_up_input = if i == TAB_KEY.into() {
            build_virtual_key_input(InputKeyPress::Up, i as u8)
        } else {
            build_unicode_input(InputKeyPress::Up, i)
        };

        keyboard_inputs.push(next_down_input);
        keyboard_inputs.push(next_up_input);
    }

    send_input(keyboard_inputs)
}

/// Converts a valid shortcut key to an "up" keyboard input
fn convert_shortcut_key_to_up_input(key: String) -> Result<INPUT, ()> {
    const SHIFT_KEY: u8 = 0x10;
    const CONTROL_KEY: u8 = 0x11;
    const ALT_KEY: u8 = 0x12;
    const LEFT_WINDOWS_KEY: u8 = 0x5B;
    const UPPERCASE_A_UNICODE_DECIMAL_VALUE: u16 = 65;
    const UPPERCASE_Z_UNICODE_DECIMAL_VALUE: u16 = 90;
    const LOWERCASE_A_UNICODE_DECIMAL_VALUE: u16 = 97;
    const LOWERCASE_Z_UNICODE_DECIMAL_VALUE: u16 = 122;

    if key == "Shift" {
        Ok(build_virtual_key_input(InputKeyPress::Up, SHIFT_KEY))
    } else if key == "Control" {
        Ok(build_virtual_key_input(InputKeyPress::Up, CONTROL_KEY))
    } else if key == "Alt" {
        Ok(build_virtual_key_input(InputKeyPress::Up, ALT_KEY))
    } else if key == "Super" {
        Ok(build_virtual_key_input(InputKeyPress::Up, LEFT_WINDOWS_KEY))
    } else {
        let unicode_value: Vec<u16> = key.encode_utf16().collect();

        if let Some(key_unicode_value_as_decimal) = unicode_value.first() {
            if (*key_unicode_value_as_decimal >= UPPERCASE_A_UNICODE_DECIMAL_VALUE
                && *key_unicode_value_as_decimal <= UPPERCASE_Z_UNICODE_DECIMAL_VALUE)
                || (*key_unicode_value_as_decimal >= LOWERCASE_A_UNICODE_DECIMAL_VALUE
                    && *key_unicode_value_as_decimal <= LOWERCASE_Z_UNICODE_DECIMAL_VALUE)
            {
                Ok(build_unicode_input(
                    InputKeyPress::Up,
                    key_unicode_value_as_decimal.clone(),
                ))
            } else {
                Err(())
            }
        } else {
            Err(())
        }
    }
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
