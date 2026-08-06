use windows::Win32::{Foundation::*, UI::WindowsAndMessaging::GetWindowRect};

pub trait HwndExt {
    fn center_position(&self) -> windows::core::Result<(i32, i32)>;
}

impl HwndExt for HWND {
    fn center_position(&self) -> windows::core::Result<(i32, i32)> {
        let mut window: RECT = RECT::default();
        unsafe {
            GetWindowRect(*self, &mut window)?;

            // when running as a separate process, we're not DPI aware, so the pixels are logical
            // pixels and we can return them directly.
            let center = (
                (window.right + window.left) / 2,
                (window.bottom + window.top) / 2,
            );

            tracing::debug!("Coordinates for {:?}: {center:?}", *self);
            Ok(center)
        }
    }
}
