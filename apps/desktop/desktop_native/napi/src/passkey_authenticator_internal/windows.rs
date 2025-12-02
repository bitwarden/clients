use anyhow::{anyhow, Result};
use windows::Win32::{
    Foundation::HWND,
    UI::{Input::KeyboardAndMouse::SetFocus, WindowsAndMessaging::BringWindowToTop},
};

pub fn register() -> Result<()> {
    windows_plugin_authenticator::register().map_err(|e| anyhow!(e))?;

    Ok(())
}

pub fn transfer_focus(handle: Vec<u8>) -> Result<()> {
    unsafe {
        // SAFETY: We check to make sure that the vec is the expected size
        // before converting it. If the handle is invalid when passed to
        // Windows, the request will be rejected.
        if handle.len() != size_of::<HWND>() {
            return Err(anyhow!("Invalid window handle received: {:?}", handle));
        }

        let hwnd = *handle.as_ptr().cast();

        tracing::debug!("Transferring focus to {hwnd:?}");
        let result = SetFocus(Some(hwnd));
        tracing::debug!("SetFocus? {result:?}");

        let result = BringWindowToTop(hwnd);
        tracing::debug!("BringWindowToTop? {result:?}");
    }

    Ok(())
}
