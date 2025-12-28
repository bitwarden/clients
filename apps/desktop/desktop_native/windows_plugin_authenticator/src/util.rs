use base64::engine::{general_purpose::STANDARD, Engine as _};
use serde::{de::Visitor, Deserializer};
use windows::{
    core::GUID,
    Win32::{Foundation::*, UI::WindowsAndMessaging::GetWindowRect},
};

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

            tracing::debug!("Coordinates for {:?}: {center:?}", *self);
            // when running as a separate process, we're not DPI aware, so the pixels are logical pixels
            return Ok(center);
            /*
            // Convert from physical to logical pixels
            tracing::debug!("Getting DPI for {:?}", *self);
            let dpi = GetDpiForWindow(*self);
            tracing::debug!("DPI: {dpi}");
            if dpi == BASE_DPI {
                return Ok(center);
            }
            let scaling_factor: f64 = dpi as f64 / 96.0;
            let scaled_center = (
                center.0 as f64 / scaling_factor,
                center.1 as f64 / scaling_factor,
            );

            Ok((scaled_center.0 as i32, scaled_center.1 as i32))
            */
        }
    }
}

pub fn create_context_string(transaction_id: GUID, request_hash: &[u8]) -> String {
    let context = [&transaction_id.to_u128().to_le_bytes(), request_hash].concat();
    STANDARD.encode(context)
}

pub fn deserialize_b64<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Vec<u8>, D::Error> {
    deserializer.deserialize_str(Base64Visitor {})
}

struct Base64Visitor;
impl<'de> Visitor<'de> for Base64Visitor {
    type Value = Vec<u8>;

    fn expecting(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.write_str("A valid base64 string")
    }

    fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        use base64::{engine::general_purpose::STANDARD, Engine as _};
        STANDARD.decode(v).map_err(|err| E::custom(err))
    }
}
