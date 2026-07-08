use base64::engine::{general_purpose::STANDARD, Engine as _};
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

pub fn create_context_string(transaction_id: GUID, request_hash: &[u8]) -> String {
    let context = &[&transaction_id.to_u128().to_le_bytes(), request_hash].concat();
    STANDARD.encode(context)
}

#[cfg(test)]
mod tests {
    use base64::engine::{general_purpose::STANDARD, Engine as _};
    use windows::core::GUID;

    use super::create_context_string;

    #[test]
    fn context_string_guid_round_trips() {
        let guid1 = GUID {
            data1: 1,
            data2: 2,
            data3: 3,
            data4: [4; 8],
        };
        let hash1 = b"abcd";
        let result = create_context_string(guid1, hash1);

        let decoded = STANDARD.decode(&result).unwrap();
        let (guid_bytes, hash2) = decoded.split_at(16);
        let guid2 = GUID::from_u128(u128::from_le_bytes(guid_bytes.try_into().unwrap()));

        assert_eq!(guid1, guid2);
        assert_eq!(hash1, hash2);
    }
}
