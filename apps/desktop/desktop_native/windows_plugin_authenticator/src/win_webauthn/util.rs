use windows::{
    core::s,
    Win32::{
        Foundation::{FreeLibrary, HMODULE, HWND, RECT},
        System::LibraryLoader::{LoadLibraryExA, LOAD_LIBRARY_SEARCH_SYSTEM32},
        UI::WindowsAndMessaging::GetWindowRect,
    },
};

use crate::win_webauthn::{com::ComBuffer, ErrorKind, WinWebAuthnError};

pub(super) fn load_webauthn_lib() -> Result<HMODULE, WinWebAuthnError> {
    unsafe {
        LoadLibraryExA(s!("webauthn.dll"), None, LOAD_LIBRARY_SEARCH_SYSTEM32).map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::DllLoad, "Failed to load webauthn.dll", err)
        })
    }
}

pub(super) fn free_webauthn_lib(library: HMODULE) -> Result<(), WinWebAuthnError> {
    unsafe {
        FreeLibrary(library).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to free webauthn.dll library",
                err,
            )
        })
    }
}
pub trait HwndExt {
    fn center_position(&self) -> windows::core::Result<(i32, i32)>;
}

impl HwndExt for HWND {
    fn center_position(&self) -> windows::core::Result<(i32, i32)> {
        let mut window: RECT = RECT::default();
        unsafe {
            GetWindowRect(*self, &mut window)?;
        }
        // TODO: We may need to adjust for scaling.
        let center_x = (window.right + window.left) / 2;
        let center_y = (window.bottom + window.top) / 2;
        Ok((center_x, center_y))
    }
}

pub(super) trait WindowsString {
    fn to_utf16(&self) -> Vec<u16>;

    // Copies a string to a buffer from the OLE allocator
    fn to_com_utf16(&self) -> (*mut u16, u32);
}

impl WindowsString for str {
    fn to_utf16(&self) -> Vec<u16> {
        // null-terminated UTF-16
        self.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn to_com_utf16(&self) -> (*mut u16, u32) {
        let wide_bytes: Vec<u8> = self
            .to_utf16()
            .into_iter()
            .flat_map(|x| x.to_le_bytes())
            .collect();
        let (ptr, byte_count) = ComBuffer::from_buffer(&wide_bytes);
        (ptr as *mut u16, byte_count)
    }
}

pub struct ArrayPointerIterator<'a, T> {
    pos: usize,
    list: Option<&'a [T]>,
}

impl<T> ArrayPointerIterator<'_, T> {
    /// Safety constraints: The caller must ensure that the pointer and length is
    /// valid. A null pointer returns an empty iterator.
    pub unsafe fn new(data: *const T, len: usize) -> Self {
        let slice = if !data.is_null() {
            Some(std::slice::from_raw_parts(data, len))
        } else {
            None
        };
        Self {
            pos: 0,
            list: slice,
        }
    }
}

impl<'a, T> Iterator for ArrayPointerIterator<'a, T> {
    type Item = &'a T;

    fn next(&mut self) -> Option<Self::Item> {
        let current = self.list?.get(self.pos);
        self.pos += 1;
        current
    }
}
