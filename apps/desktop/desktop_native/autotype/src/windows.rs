use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::thread;

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
/// `input` must be a Windows virtual-key code between A - Z or one
/// of the following virtual keys:
/// VK_TAB, VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN
///
/// TODO: Future improvement is to use GetLastError for better error handling
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
///
/// https://learn.microsoft.com/en-us/windows/win32/inputdev/virtual-key-codes
pub fn type_input(input: Vec<u16>) -> Result<(), ()> {
    //let fake_input = String::from("user@bitwarden.com\tpassword");
    //let input: Vec<u16> = fake_input.encode_utf16().collect();
    println!("----------\nInput vec: {:?}\nInput vec len: {:?}", input, input.len());

    let mut keyboard_inputs: Vec<INPUT> = Vec::new();

    // "release" the hotkey keys: alt-ctrl-i
    keyboard_inputs.push(INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0x12), // alt
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    });
    keyboard_inputs.push(INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(0x11), // ctrl
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    });
    keyboard_inputs.push(INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: Default::default(),
                wScan: 105, // i
                dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    });

    for i in input {
        let next_down_input: INPUT = match i {
            // Inserts a virtual-key down input
            // VK_TAB, VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN
            0x09 | 0x10..0x12 | 0x5B | 0x5C => INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY(i),
                        wScan: 0,
                        dwFlags: Default::default(),
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            // Inserts a unicode down input
            // A - Z
            _ => INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: Default::default(),
                        wScan: i,
                        dwFlags: KEYEVENTF_UNICODE,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        };
        let next_up_input: INPUT = match i {
            // Inserts a virtual-key up input
            // VK_TAB, VK_SHIFT, VK_CONTROL, VK_MENU, VK_LWIN, VK_RWIN
            0x09 | 0x10..0x12 | 0x5B | 0x5C => INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: VIRTUAL_KEY(i),
                        wScan: 0,
                        dwFlags: KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
            // Inserts a unicode up input
            // A - Z
            _ => INPUT {
                r#type: INPUT_KEYBOARD,
                Anonymous: INPUT_0 {
                    ki: KEYBDINPUT {
                        wVk: Default::default(),
                        wScan: i,
                        dwFlags: KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time: 0,
                        dwExtraInfo: 0,
                    },
                },
            },
        };

        keyboard_inputs.push(next_down_input);
        keyboard_inputs.push(next_up_input);
    }

    let insert_count = unsafe { SendInput(&keyboard_inputs, std::mem::size_of::<INPUT>() as i32) };

    let e = unsafe { GetLastError().to_hresult().message() };
    println!("GetLastError(): {:?}", e);

    if insert_count == 0 {
        return Err(()); // input was blocked by another thread
    } else if insert_count != keyboard_inputs.len() as u32 {
        return Err(());
    }

    Ok(())
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
