use std::{ffi::OsString, os::windows::ffi::OsStringExt};

use anyhow::{anyhow, Result};
use tracing::{debug, error};
use windows::Win32::{
    Foundation::{GetLastError, SetLastError, WIN32_ERROR},
    UI::{
        Input::KeyboardAndMouse::{
            SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP,
            KEYEVENTF_UNICODE, VIRTUAL_KEY,
        },
        WindowsAndMessaging::{GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW},
    },
};

mod window_handle;
use window_handle::WindowHandle;

const WIN_SUCCESS: WIN32_ERROR = WIN32_ERROR(0);

fn clear_last_error() {
    debug!("Clearing last error with SetLastError");
    unsafe {
        SetLastError(WIN32_ERROR(0));
    }
}

fn get_last_error() -> WIN32_ERROR {
    let last_err = unsafe { GetLastError() };
    debug!("GetLastError(): {}", last_err.to_hresult());
    last_err
}

// ---------- Window title --------------

/// Gets the title bar string for the foreground window.
pub fn get_foreground_window_title() -> Result<String> {
    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow
    let foreground_window_handle = unsafe { GetForegroundWindow() };

    let window_handle = WindowHandle::new(foreground_window_handle)?;

    get_window_title(&window_handle)
}

/// Gets the length of the window title bar text.
///
/// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextlengthw
fn get_window_title_length(window_handle: &WindowHandle) -> Result<usize> {
    // GetWindowTextLengthW does not itself clear the last error so we must do it ourselves.
    clear_last_error();

    let length = unsafe { GetWindowTextLengthW(*window_handle.get()?) };

    let length = usize::try_from(length)?;

    if length == 0 {
        // attempt to retreive win32 error
        let last_err = get_last_error();
        if last_err != WIN_SUCCESS {
            let last_err = last_err.to_hresult().message();
            error!(last_err, "Error getting window text length");
            return Err(anyhow!("Error getting window text length: {last_err}"));
        }
        // still return error because we won't be able to get window title string
        error!("Window text length is zero");
        return Err(anyhow!("Error getting window text length"));
    }

    Ok(length)
}

/// Gets the window title bar title.
///
/// https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw
fn get_window_title(window_handle: &WindowHandle) -> Result<String> {
    let window_title_length = get_window_title_length(window_handle)?;

    let mut buffer: Vec<u16> = vec![0; window_title_length + 1]; // add extra space for the null character

    let len_written = unsafe { GetWindowTextW(*window_handle.get()?, &mut buffer) };

    if len_written == 0 {
        // attempt to retreive win32 error
        let last_err = get_last_error();
        if last_err != WIN_SUCCESS {
            let last_err = last_err.to_hresult().message();
            error!(last_err, "Error retrieving window title");
            return Err(anyhow!("Error retrieving window title. {last_err}"));
        }
        // still return error because we won't be able to get window title string
        error!(window_title_length, "No window title retrieved, read 0.");
        return Err(anyhow!(
            "No window title length, read 0 but expected {window_title_length}"
        ));
    }

    let window_title = OsString::from_wide(&buffer);

    Ok(window_title.to_string_lossy().into_owned())
}

// ---------- Type Input --------------

/// Attempts to type the input text wherever the user's cursor is.
///
/// `input` must be a vector of utf-16 encoded characters to insert.
/// `keyboard_shortcut` must be a vector of Strings, where valid shortcut keys: Control, Alt, Super, Shift, letters a - Z
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
pub fn type_input(input: Vec<u16>, keyboard_shortcut: Vec<String>) -> Result<()> {
    const TAB_KEY: u8 = 9;

    // the length of this vec is always (2x length of input chars + shortcut keys to release)
    let mut keyboard_inputs: Vec<INPUT> =
        Vec::with_capacity((input.len() * 2) + keyboard_shortcut.len());

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

/// Converts a valid shortcut key to an "up" keyboard input.
///
/// `input` must be a valid shortcut key: Control, Alt, Super, Shift, letters [a-z][A-Z]
fn convert_shortcut_key_to_up_input(key: String) -> Result<INPUT> {
    const SHIFT_KEY: u8 = 0x10;
    const SHIFT_KEY_STR: &str = "Shift";
    const CONTROL_KEY: u8 = 0x11;
    const CONTROL_KEY_STR: &str = "Control";
    const ALT_KEY: u8 = 0x12;
    const ALT_KEY_STR: &str = "Alt";
    const LEFT_WINDOWS_KEY: u8 = 0x5B;
    const LEFT_WINDOWS_KEY_STR: &str = "Super";

    Ok(match key.as_str() {
        SHIFT_KEY_STR => build_virtual_key_input(InputKeyPress::Up, SHIFT_KEY),
        CONTROL_KEY_STR => build_virtual_key_input(InputKeyPress::Up, CONTROL_KEY),
        ALT_KEY_STR => build_virtual_key_input(InputKeyPress::Up, ALT_KEY),
        LEFT_WINDOWS_KEY_STR => build_virtual_key_input(InputKeyPress::Up, LEFT_WINDOWS_KEY),
        _ => build_unicode_input(InputKeyPress::Up, get_alphabetic_hotkey(key)?),
    })
}

/// Given a letter that is a String, get the utf16 encoded
/// decimal version of the letter as long as it meets the
/// [a-z][A-Z] restriction.
///
/// Because we only accept [a-z][A-Z], the decimal u16
/// cast of the letter is safe because the unicode code point
/// of these characters fits in a u16.
fn get_alphabetic_hotkey(letter: String) -> Result<u16> {
    println!("letter: {letter}, letter length: {}", letter.len());
    if letter.len() != 1 {
        error!(
            len = letter.len(),
            "Final keyboard shortcut key should be a single character."
        );
        return Err(anyhow!(
            "Final keyboard shortcut key should be a single character: {letter}"
        ));
    }

    let c = letter.chars().next().expect("letter is size 1");

    // is_ascii_alphabetic() checks for:
    // U+0041 `A` ..= U+005A `Z`, or  U+0061 `a` ..= U+007A `z`
    if !c.is_ascii_alphabetic() {
        error!(letter = %c, "Letter is not ASCII Alphabetic ([a-z][A-Z]).");
        return Err(anyhow!(
            "Letter is not ASCII Alphabetic ([a-z][A-Z]): '{letter}'",
        ));
    }

    Ok(c as u16)
}

/// An input key can be either pressed (down), or released (up).
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
fn send_input(inputs: Vec<INPUT>) -> Result<()> {
    let insert_count = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };

    let last_err = get_last_error();
    debug!("SendInput() called.");

    if insert_count == 0 {
        let last_err = last_err.to_hresult().message();
        error!(GetLastError = %last_err, "SendInput sent 0 inputs. Input was blocked by another thread.");

        return Err(anyhow!("SendInput sent 0 inputs. Input was blocked by another thread. GetLastError: {last_err}"));
    } else if insert_count != inputs.len() as u32 {
        let last_err = last_err.to_hresult().message();
        error!(sent = %insert_count, expected = inputs.len(), GetLastError = %last_err,
            "SendInput sent does not match expected."
        );
        return Err(anyhow!(
            "SendInput does not match expected. sent: {insert_count}, expected: {}",
            inputs.len()
        ));
    }

    debug!("Autotype sent input.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_alphabetic_hot_key_happy() {
        for c in ('a'..='z').chain('A'..='Z') {
            let letter = c.to_string();
            println!("{}", letter);
            let converted = get_alphabetic_hotkey(letter).unwrap();
            assert_eq!(converted, c as u16);
        }
    }

    #[test]
    #[should_panic = "Final keyboard shortcut key should be a single character: foo"]
    fn get_alphabetic_hot_key_fail_not_single_char() {
        let letter = String::from("foo");
        get_alphabetic_hotkey(letter).unwrap();
    }

    #[test]
    #[should_panic = "Letter is not ASCII Alphabetic ([a-z][A-Z]): '}'"]
    fn get_alphabetic_hot_key_fail_not_alphabetic() {
        let letter = String::from("}");
        get_alphabetic_hotkey(letter).unwrap();
    }
}
