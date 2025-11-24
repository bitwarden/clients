use windows::{
    core::s,
    Win32::{
        Foundation::{FreeLibrary, HMODULE},
        System::LibraryLoader::{LoadLibraryExA, LOAD_LIBRARY_SEARCH_SYSTEM32},
    },
};

use crate::{
    // com::ComBuffer,
    ErrorKind,
    WinWebAuthnError,
};

macro_rules! webauthn_call {
    ($symbol:literal as fn $fn_name:ident($($arg:ident: $arg_type:ty),+) -> $result_type:ty) => (
        pub(super) fn $fn_name($($arg: $arg_type),*) -> Result<$result_type, WinWebAuthnError> {
            let library = crate::util::load_webauthn_lib()?;
            let response = unsafe {
                let address = GetProcAddress(library, s!($symbol)).ok_or(
                    WinWebAuthnError::new(
                        ErrorKind::DllLoad,
                        &format!(
                            "Failed to load function {}",
                            $symbol
                        ),
                    ),
                )?;

                let function: unsafe extern "cdecl" fn(
                    $($arg: $arg_type),*
                ) -> $result_type = std::mem::transmute_copy(&address);
                function($($arg),*)
            };
            crate::util::free_webauthn_lib(library)?;
            Ok(response)
        }
    )
}

pub(crate) use webauthn_call;

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
pub(super) trait WindowsString {
    fn to_utf16(&self) -> Vec<u16>;
}

impl WindowsString for str {
    fn to_utf16(&self) -> Vec<u16> {
        // null-terminated UTF-16
        self.encode_utf16().chain(std::iter::once(0)).collect()
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
