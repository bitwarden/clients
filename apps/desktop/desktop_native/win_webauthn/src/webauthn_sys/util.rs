use windows::{
    core::s,
    Win32::{
        Foundation::{FreeLibrary, HMODULE},
        System::LibraryLoader::{LoadLibraryExA, LOAD_LIBRARY_SEARCH_SYSTEM32},
    },
};

use crate::{ErrorKind, WinWebAuthnError};

macro_rules! webauthn_call {
    ($symbol:literal as $(#[$attr:meta])* fn $fn_name:ident($($arg:ident: $arg_type:ty),+ $(,)?) -> $result_type:ty) => (
        $(#[$attr])*
        pub(crate) unsafe fn $fn_name($($arg: $arg_type),*) -> Result<$result_type, crate::WinWebAuthnError> {
            let library = crate::webauthn_sys::util::load_webauthn_lib()?;
            let response = unsafe {
                let address = windows::Win32::System::LibraryLoader::GetProcAddress(library, windows::core::s!($symbol)).ok_or(
                    crate::WinWebAuthnError::new(
                        crate::ErrorKind::DllLoad,
                        &format!(
                            "Failed to load function {}",
                            $symbol
                        ),
                    ),
                )?;

                let function: unsafe extern "C" fn(
                    $($arg: $arg_type),*
                ) -> $result_type = std::mem::transmute_copy(&address);
                function($($arg),*)
            };
            crate::webauthn_sys::util::free_webauthn_lib(library)?;
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
