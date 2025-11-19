use anyhow::{anyhow, Result};
use tracing::{debug, error};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, KEYEVENTF_UNICODE,
    VIRTUAL_KEY,
};

use super::{ErrorOperations, Win32ErrorOperations};

/// `InputOperations` provides an interface to Window32 API for
/// working with inputs.
#[cfg_attr(test, mockall::automock)]
trait InputOperations {
    /// Attempts to type the provided input wherever the user's cursor is.
    ///
    /// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
    fn send_input(inputs: &[INPUT]) -> u32;
}

struct Win32InputOperations;

impl InputOperations for Win32InputOperations {
    fn send_input(inputs: &[INPUT]) -> u32 {
        const INPUT_STRUCT_SIZE: i32 = std::mem::size_of::<INPUT>() as i32;
        let insert_count = unsafe { SendInput(inputs, INPUT_STRUCT_SIZE) };

        debug!(insert_count, "SendInput() called.");

        insert_count
    }
}

/// Attempts to type the input text wherever the user's cursor is.
///
/// `input` must be a vector of utf-16 encoded characters to insert.
/// `keyboard_shortcut` must be a vector of Strings, where valid shortcut keys: Control, Alt, Super,
/// Shift, letters a - Z
///
/// https://learn.microsoft.com/en-in/windows/win32/api/winuser/nf-winuser-sendinput
pub(super) fn type_input(input: Vec<u16>, keyboard_shortcut: Vec<String>) -> Result<()> {
    // the length of this vec is always shortcut keys to release + (2x length of input chars)
    let mut keyboard_inputs: Vec<INPUT> =
        Vec::with_capacity(keyboard_shortcut.len() + (input.len() * 2));

    debug!(?keyboard_shortcut, "Converting keyboard shortcut to input.");

    // Add key "up" inputs for the shortcut
    for key in keyboard_shortcut {
        keyboard_inputs.push(convert_shortcut_key_to_up_input(key)?);
    }

    add_input(&input, &mut keyboard_inputs);

    send_input::<Win32InputOperations, Win32ErrorOperations>(keyboard_inputs)
}

// Add key "down" and "up" inputs for the input
// (currently in this form: {username}/t{password})
fn add_input(input: &[u16], keyboard_inputs: &mut Vec<INPUT>) {
    const TAB_KEY: u8 = 9;

    for i in input {
        let next_down_input = if *i == TAB_KEY.into() {
            build_virtual_key_input(InputKeyPress::Down, *i as u8)
        } else {
            build_unicode_input(InputKeyPress::Down, *i)
        };
        let next_up_input = if *i == TAB_KEY.into() {
            build_virtual_key_input(InputKeyPress::Up, *i as u8)
        } else {
            build_unicode_input(InputKeyPress::Up, *i)
        };

        keyboard_inputs.push(next_down_input);
        keyboard_inputs.push(next_up_input);
    }
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

    let c = c as u16;

    debug!(c, letter, "Got alphabetic hotkey.");

    Ok(c)
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

fn send_input<I, E>(inputs: Vec<INPUT>) -> Result<()>
where
    I: InputOperations,
    E: ErrorOperations,
{
    let insert_count = I::send_input(&inputs);

    if insert_count == 0 {
        let last_err = E::get_last_error().to_hresult().message();
        error!(GetLastError = %last_err, "SendInput sent 0 inputs. Input was blocked by another thread.");

        return Err(anyhow!("SendInput sent 0 inputs. Input was blocked by another thread. GetLastError: {last_err}"));
    } else if insert_count != inputs.len() as u32 {
        let last_err = E::get_last_error().to_hresult().message();
        error!(sent = %insert_count, expected = inputs.len(), GetLastError = %last_err,
            "SendInput sent does not match expected."
        );
        return Err(anyhow!(
            "SendInput does not match expected. sent: {insert_count}, expected: {}",
            inputs.len()
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    //! For the mocking of the traits that are static methods, we need to use the `serial_test`
    //! crate in order to mock those, since the mock expectations set have to be global in
    //! absence of a `self`. More info: https://docs.rs/mockall/latest/mockall/#static-methods

    use serial_test::serial;
    use windows::Win32::Foundation::WIN32_ERROR;

    use super::*;
    use crate::windowing::MockErrorOperations;

    #[test]
    fn get_alphabetic_hot_key_succeeds() {
        for c in ('a'..='z').chain('A'..='Z') {
            let letter = c.to_string();
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

    #[test]
    #[serial]
    fn send_input_succeeds() {
        let ctxi = MockInputOperations::send_input_context();
        ctxi.expect().returning(|_| 1);

        send_input::<MockInputOperations, MockErrorOperations>(vec![build_unicode_input(
            InputKeyPress::Up,
            0,
        )])
        .unwrap();
    }

    #[test]
    #[serial]
    #[should_panic(
        expected = "SendInput sent 0 inputs. Input was blocked by another thread. GetLastError:"
    )]
    fn send_input_fails_sent_zero() {
        let ctxi = MockInputOperations::send_input_context();
        ctxi.expect().returning(|_| 0);

        let ctxge = MockErrorOperations::get_last_error_context();
        ctxge.expect().returning(|| WIN32_ERROR(1));

        send_input::<MockInputOperations, MockErrorOperations>(vec![build_unicode_input(
            InputKeyPress::Up,
            0,
        )])
        .unwrap();
    }

    #[test]
    #[serial]
    #[should_panic(expected = "SendInput does not match expected. sent: 2, expected: 1")]
    fn send_input_fails_sent_mismatch() {
        let ctxi = MockInputOperations::send_input_context();
        ctxi.expect().returning(|_| 2);

        let ctxge = MockErrorOperations::get_last_error_context();
        ctxge.expect().returning(|| WIN32_ERROR(1));

        send_input::<MockInputOperations, MockErrorOperations>(vec![build_unicode_input(
            InputKeyPress::Up,
            0,
        )])
        .unwrap();
    }
}
