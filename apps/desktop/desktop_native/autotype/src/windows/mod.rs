use anyhow::Result;
use itertools::Itertools;
use tracing::debug;
use windows::Win32::{
    Foundation::{GetLastError, SetLastError, HWND, WIN32_ERROR},
    UI::{
        Input::KeyboardAndMouse::INPUT,
        WindowsAndMessaging::{SetForegroundWindow, SwitchToThisWindow},
    },
};

mod type_input;
mod window_title;

/// The error code from Win32 API that represents a non-error.
const WIN32_SUCCESS: WIN32_ERROR = WIN32_ERROR(0);

/// `ErrorOperations` provides an interface to the Win32 API for dealing with
/// win32 errors.
#[cfg_attr(test, mockall::automock)]
trait ErrorOperations {
    /// <https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-setlasterror>
    fn set_last_error(err: u32) {
        debug!(err, "Calling SetLastError");
        unsafe {
            SetLastError(WIN32_ERROR(err));
        }
    }

    /// <https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror>
    fn get_last_error() -> WIN32_ERROR {
        let last_err = unsafe { GetLastError() };
        debug!("GetLastError(): {}", last_err.to_hresult().message());
        last_err
    }
}

/// Default implementation for Win32 API errors.
struct Win32ErrorOperations;
impl ErrorOperations for Win32ErrorOperations {}

pub fn get_foreground_window_title() -> Result<String> {
    window_title::get_foreground_window_title()
}

/// Returns the raw bytes of the foreground window handle (HWND).
pub fn get_foreground_window_handle() -> Result<Vec<u8>> {
    window_title::get_foreground_window_handle_raw()
}

/// Restores focus to the window identified by the given HWND bytes.
///
/// `settle` — if true, sleeps 50ms after restoring focus to give the window manager
/// time to process the focus change before `SendInput` fires.
pub fn focus_window(hwnd: Vec<u8>, settle: bool) -> Result<()> {
    use anyhow::anyhow;

    let bytes: [u8; 8] = hwnd
        .try_into()
        .map_err(|_| anyhow!("Invalid HWND: expected 8 bytes"))?;
    let ptr = usize::from_ne_bytes(bytes);
    let hwnd = HWND(ptr as *mut core::ffi::c_void);

    unsafe {
        let _ = SetForegroundWindow(hwnd);
        SwitchToThisWindow(hwnd, true);
    }

    if settle {
        std::thread::sleep(std::time::Duration::from_millis(50));
    }

    Ok(())
}

/// `KeyboardShortcutInput` is an `INPUT` of one of the valid shortcut keys:
///     - Control
///     - Alt
///     - Super
///     - \[a-z\]\[A-Z\]
struct KeyboardShortcutInput(INPUT);

pub fn type_input(input: &[u16], keyboard_shortcut: &[String]) -> Result<()> {
    debug!(?keyboard_shortcut, "type_input() called.");

    // convert the raw string input to Windows input and error
    // if any key is not a valid keyboard shortcut input
    let keyboard_shortcut: Vec<KeyboardShortcutInput> = keyboard_shortcut
        .iter()
        .map(|s| KeyboardShortcutInput::try_from(s.as_str()))
        .try_collect()?;

    type_input::type_input(input, &keyboard_shortcut)
}
