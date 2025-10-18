use anyhow::Result;
use tracing::debug;
use windows::Win32::Foundation::{GetLastError, SetLastError, WIN32_ERROR};

mod type_input;
mod window_title;

/// The error code from Win32 API that represents a non-error.
const WIN32_SUCCESS: WIN32_ERROR = WIN32_ERROR(0);

/// `ErrorOperations` provides an interface to the Win32 API for dealing with
/// win32 errors.
#[cfg_attr(test, mockall::automock)]
trait ErrorOperations {
    /// https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-setlasterror
    fn set_last_error(err: u32) {
        debug!(err, "Calling SetLastError");
        unsafe {
            SetLastError(WIN32_ERROR(err));
        }
    }

    /// https://learn.microsoft.com/en-us/windows/win32/api/errhandlingapi/nf-errhandlingapi-getlasterror
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

pub fn type_input(input: Vec<u16>, keyboard_shortcut: Vec<String>) -> Result<()> {
    type_input::type_input(input, keyboard_shortcut)
}
