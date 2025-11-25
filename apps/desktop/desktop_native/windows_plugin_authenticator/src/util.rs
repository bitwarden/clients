use base64::engine::{general_purpose::STANDARD, Engine as _};
use windows::{
    core::GUID,
    Win32::{
        Foundation::*,
        UI::{HiDpi::GetDpiForWindow, WindowsAndMessaging::GetWindowRect},
    },
};

const BASE_DPI: u32 = 96;

pub trait HwndExt {
    fn center_position(&self) -> windows::core::Result<(i32, i32)>;
}

impl HwndExt for HWND {
    fn center_position(&self) -> windows::core::Result<(i32, i32)> {
        let mut window: RECT = RECT::default();
        unsafe {
            GetWindowRect(*self, &mut window)?;

            // Calculate center in physical pixels
            let center = (
                (window.right + window.left) / 2,
                (window.bottom + window.top) / 2,
            );

            // Convert from physical to logical pixels
            let dpi = GetDpiForWindow(*self);
            if dpi == BASE_DPI {
                return Ok(center);
            }
            let scaling_factor: f64 = dpi as f64 / 96.0;
            let scaled_center = (
                center.0 as f64 / scaling_factor,
                center.1 as f64 / scaling_factor,
            );

            Ok((scaled_center.0 as i32, scaled_center.1 as i32))
        }
    }
}

pub fn create_context_string(transaction_id: GUID) -> String {
    STANDARD.encode(transaction_id.to_u128().to_le_bytes().to_vec())
}
