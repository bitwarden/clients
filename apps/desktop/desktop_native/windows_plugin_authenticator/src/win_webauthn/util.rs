use windows::{
    core::s,
    Win32::{
        Foundation::{FreeLibrary, HMODULE},
        System::LibraryLoader::{LoadLibraryExA, LOAD_LIBRARY_SEARCH_SYSTEM32},
    },
};

use crate::win_webauthn::{ErrorKind, WinWebAuthnError};

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
