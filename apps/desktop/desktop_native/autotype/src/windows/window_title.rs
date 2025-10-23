use std::{ffi::OsString, os::windows::ffi::OsStringExt};

use anyhow::{anyhow, Result};
use tracing::{debug, error, warn};
use windows::Win32::{
    Foundation::HWND,
    UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW},
};

use super::{ErrorOperations, Win32ErrorOperations, WIN32_SUCCESS};

#[cfg_attr(test, mockall::automock)]
trait WindowHandleOperations {
    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextlengthw
    fn get_window_text_length_w(&self) -> Result<i32>;

    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowtextw
    fn get_window_text_w(&self, buffer: &mut Vec<u16>) -> Result<i32>;
}

/// `WindowHandle` provides a light wrapper over the `HWND` (which is just a void *).
/// The raw pointer can become invalid during runtime so it's validity must be checked
/// before usage.
struct WindowHandle {
    handle: HWND,
}

impl WindowHandle {
    /// Create a new `WindowHandle`
    fn new(handle: HWND) -> Self {
        Self { handle }
    }

    /// Assert that the raw pointer is valid.
    fn validate(&self) -> Result<()> {
        if self.handle.is_invalid() {
            error!("Window handle is invalid.");
            return Err(anyhow!("Window handle is invalid."));
        }
        Ok(())
    }
}

impl WindowHandleOperations for WindowHandle {
    fn get_window_text_length_w(&self) -> Result<i32> {
        self.validate()?;
        let length = unsafe { GetWindowTextLengthW(self.handle) };
        Ok(length)
    }

    fn get_window_text_w(&self, buffer: &mut Vec<u16>) -> Result<i32> {
        self.validate()?;
        let len_written = unsafe { GetWindowTextW(self.handle, buffer) };
        Ok(len_written)
    }
}

/// Gets the title bar string for the foreground window.
pub(super) fn get_foreground_window_title() -> Result<String> {
    let window_handle = get_foreground_window_handle()?;

    let expected_window_title_length =
        get_window_title_length::<WindowHandle, Win32ErrorOperations>(&window_handle)?;

    get_window_title::<WindowHandle, Win32ErrorOperations>(
        &window_handle,
        expected_window_title_length,
    )
}

/// Retrieves the foreground window handle and validates it.
fn get_foreground_window_handle() -> Result<WindowHandle> {
    // https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getforegroundwindow
    let handle = unsafe { GetForegroundWindow() };

    debug!("GetForegroundWindow() called.");

    let window_handle = WindowHandle::new(handle);
    window_handle.validate()?;

    Ok(window_handle)
}

/// # Returns
///
/// The length of the window title.
///
/// # Errors
///
/// - If the length zero and GetLastError() != 0, return the GetLastError() message.
fn get_window_title_length<H, E>(window_handle: &H) -> Result<usize>
where
    H: WindowHandleOperations,
    E: ErrorOperations,
{
    // GetWindowTextLengthW does not itself clear the last error so we must do it ourselves.
    E::set_last_error(0);

    let length = window_handle.get_window_text_length_w()?;

    let length = usize::try_from(length)?;

    debug!(length, "window text length retrieved from handle.");

    if length == 0 {
        // attempt to retreive win32 error
        let last_err = E::get_last_error();
        if last_err != WIN32_SUCCESS {
            let last_err = last_err.to_hresult().message();
            error!(last_err, "Error getting window text length.");
            return Err(anyhow!("Error getting window text length: {last_err}"));
        }
    }

    Ok(length)
}

/// Gets the window title bar title using the expected length to determine size of buffer
/// to store it.
///
/// # Returns
///
/// If the `expected_title_length` is zero, return an Ok result containing empty string. It
/// Isn't considered an error by the Win32 API.
///
/// Otherwise, return the retrieved window title string.
///
/// # Errors
///
/// - If the actual window title length (what the win32 API declares was written into the
///   buffer), is length zero and GetLastError() != 0 , return the GetLastError() message.
fn get_window_title<H, E>(window_handle: &H, expected_title_length: usize) -> Result<String>
where
    H: WindowHandleOperations,
    E: ErrorOperations,
{
    if expected_title_length == 0 {
        // This isn't considered an error by the windows API, but in practice it means we can't
        // match against the title so we'll stop here.
        // The upstream will make a contains comparison on what we return, so an empty string
        // will not result on a match.
        warn!("Window title length is zero.");
        return Ok(String::from(""));
    }

    let mut buffer: Vec<u16> = vec![0; expected_title_length + 1]; // add extra space for the null character

    let actual_window_title_length = window_handle.get_window_text_w(&mut buffer)?;

    debug!(actual_window_title_length, "window title retrieved.");

    if actual_window_title_length == 0 {
        // attempt to retreive win32 error
        let last_err = E::get_last_error();
        if last_err != WIN32_SUCCESS {
            let last_err = last_err.to_hresult().message();
            error!(last_err, "Error retrieving window title.");
            return Err(anyhow!("Error retrieving window title: {last_err}"));
        }
        // in practice, we should not get to the below code, since we asserted the len > 0
        // above. but it is an extra protection in case the windows API didn't set an error.
        warn!(expected_title_length, "No window title retrieved.");
    }

    let window_title = OsString::from_wide(&buffer);

    Ok(window_title.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    //! For the mocking of the traits that are static methods, we need to use the `serial_test` crate
    //! in order to mock those, since the mock expectations set have to be global in absence of a `self`.
    //! More info: https://docs.rs/mockall/latest/mockall/#static-methods

    use super::*;

    use crate::windowing::MockErrorOperations;
    use mockall::predicate;
    use serial_test::serial;
    use windows::Win32::Foundation::WIN32_ERROR;

    #[test]
    #[serial]
    fn get_window_title_length_can_be_zero() {
        let mut mock_handle = MockWindowHandleOperations::new();

        let ctxse = MockErrorOperations::set_last_error_context();
        ctxse
            .expect()
            .once()
            .with(predicate::eq(0))
            .returning(|_| {});

        mock_handle
            .expect_get_window_text_length_w()
            .once()
            .returning(|| Ok(0));

        let ctxge = MockErrorOperations::get_last_error_context();
        ctxge.expect().returning(|| WIN32_ERROR(0));

        let len = get_window_title_length::<MockWindowHandleOperations, MockErrorOperations>(
            &mock_handle,
        )
        .unwrap();

        assert_eq!(len, 0);
    }

    #[test]
    #[serial]
    #[should_panic(expected = "Error getting window text length:")]
    fn get_window_title_length_fails() {
        let mut mock_handle = MockWindowHandleOperations::new();

        let ctxse = MockErrorOperations::set_last_error_context();
        ctxse.expect().with(predicate::eq(0)).returning(|_| {});

        mock_handle
            .expect_get_window_text_length_w()
            .once()
            .returning(|| Ok(0));

        let ctxge = MockErrorOperations::get_last_error_context();
        ctxge.expect().returning(|| WIN32_ERROR(1));

        get_window_title_length::<MockWindowHandleOperations, MockErrorOperations>(&mock_handle)
            .unwrap();
    }

    #[test]
    fn get_window_title_succeeds() {
        let mut mock_handle = MockWindowHandleOperations::new();

        mock_handle
            .expect_get_window_text_w()
            .once()
            .returning(|buffer| {
                buffer.fill_with(|| 42); // because why not
                Ok(42)
            });

        let title =
            get_window_title::<MockWindowHandleOperations, MockErrorOperations>(&mock_handle, 42)
                .unwrap();

        assert_eq!(title.len(), 43); // That extra slot in the buffer for null char

        assert_eq!(title, "*******************************************");
    }

    #[test]
    fn get_window_title_returns_empty_string() {
        let mock_handle = MockWindowHandleOperations::new();

        let title =
            get_window_title::<MockWindowHandleOperations, MockErrorOperations>(&mock_handle, 0)
                .unwrap();

        assert_eq!(title, "");
    }

    #[test]
    #[serial]
    #[should_panic(expected = "Error retrieving window title:")]
    fn get_window_title_fails_with_last_error() {
        let mut mock_handle = MockWindowHandleOperations::new();

        mock_handle
            .expect_get_window_text_w()
            .once()
            .returning(|_| Ok(0));

        let ctxge = MockErrorOperations::get_last_error_context();
        ctxge.expect().returning(|| WIN32_ERROR(1));

        get_window_title::<MockWindowHandleOperations, MockErrorOperations>(&mock_handle, 42)
            .unwrap();
    }

    #[test]
    #[serial]
    fn get_window_title_doesnt_fail_but_reads_zero() {
        let mut mock_handle = MockWindowHandleOperations::new();

        mock_handle
            .expect_get_window_text_w()
            .once()
            .returning(|_| Ok(0));

        let ctxge = MockErrorOperations::get_last_error_context();
        ctxge.expect().returning(|| WIN32_ERROR(0));

        get_window_title::<MockWindowHandleOperations, MockErrorOperations>(&mock_handle, 42)
            .unwrap();
    }
}
