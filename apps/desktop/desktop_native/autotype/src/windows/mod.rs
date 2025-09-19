use std::{ffi::OsString, os::windows::ffi::OsStringExt};

use anyhow::{anyhow, Result};
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

fn clear_last_error() {
    // TODO debug!("Clearing last error with SetLastError");
    unsafe {
        SetLastError(WIN32_ERROR(0));
    }
}

fn get_last_error() -> String {
    let last_err = unsafe { GetLastError().to_hresult().message() };
    println!("GetLastError(): {last_err}"); // TODO: debug!()

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
        let last_err = get_last_error();
        if !last_err.is_empty() {
            let error_string = format!("Error getting window text length: {last_err}");
            eprintln!("{error_string}"); // TODO: error!()
            return Err(anyhow!(error_string));
        }
        let error_string = "Window text length is zero.";
        eprintln!("{error_string}"); // TODO: error!()
        return Err(anyhow!(error_string));
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
        if !last_err.is_empty() {
            let error_string = format!("Error retrieving window title: {last_err}");
            eprintln!("{error_string}"); // TODO: error!()
            return Err(anyhow!(last_err));
        }
        // still return error because we won't be able to get window title string
        let error_string = "Window title length is zero.";
        eprintln!("{error_string}"); // TODO: error!()
        return Err(anyhow!(error_string));
    }

    let window_title = OsString::from_wide(&buffer);

    Ok(window_title.to_string_lossy().into_owned())
}

// ---------- Type Input --------------

/// Attempts to type the input text wherever the user's cursor is.
///
/// `input` must be an array of utf-16 encoded characters to insert.
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
pub fn type_input(input: Vec<u16>) -> Result<()> {
    const TAB_KEY: u16 = 9;

    // the length of this vec is always (2x length of input chars + 3 hotkeys to release)
    let mut keyboard_inputs: Vec<INPUT> = Vec::with_capacity((input.len() * 2) + 3);

    // Release hotkeys
    keyboard_inputs.push(build_virtual_key_input(InputKeyPress::Up, 0x12)); // alt
    keyboard_inputs.push(build_virtual_key_input(InputKeyPress::Up, 0x11)); // ctrl
    keyboard_inputs.push(build_unicode_input(InputKeyPress::Up, 105)); // i

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

    if insert_count == 0 {
        let last_err = get_last_error();
        let error_string =
            format!("SendInput sent 0 inputs. Input was blocked by another thread. : {last_err}");

        eprintln!("{error_string}"); // TODO: error!()
        return Err(anyhow!(error_string));
    } else if insert_count != inputs.len() as u32 {
        let last_err = get_last_error();
        let error_string = format!(
            "SendInput sent {insert_count} but expected {}: {last_err}",
            inputs.len()
        );

        eprintln!("{error_string}"); // TODO: error!()
        return Err(anyhow!(error_string));
    }

    // TODO debug!("Sent input.");

    Ok(())
}
