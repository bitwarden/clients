use windows::{
    core::s,
    Win32::{
        Foundation::{FreeLibrary, HMODULE},
        System::LibraryLoader::{LoadLibraryExA, LOAD_LIBRARY_SEARCH_SYSTEM32},
    },
};

use crate::{ErrorKind, WinWebAuthnError};

/// Defines a Rust function to call a webauthn.dll function over FFI based on
/// the name of the function. Documentation comments will be captured, and the
/// return type will be wrapped in a WinWebAuthnError that will be returned if
/// the function cannot be loaded from webauthn.dll.
///
/// # Examples
///
/// ```ignore
/// use crate::api::sys::util::webauthn_call;
///
/// webauthn_call!("WebAuthNFreeDecodedMakeCredentialRequest" as
/// /// Frees a decoded make credential request from [webauthn_free_decoded_make_credential_request].
/// ///
/// /// # Arguments
/// /// - `pMakeCredentialRequest`: An pointer to a [WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST] to be freed.
/// fn webauthn_free_decoded_make_credential_request(
///     pMakeCredentialRequest: *mut WEBAUTHN_CTAPCBOR_MAKE_CREDENTIAL_REQUEST
/// ) -> ());
/// ```
macro_rules! webauthn_call {
    ($symbol:literal as $(#[$attr:meta])* fn $fn_name:ident($($arg:ident: $arg_type:ty),+ $(,)?) -> $result_type:ty) => (
        $(#[$attr])*
        pub(in crate::api) unsafe fn $fn_name($($arg: $arg_type),*) -> Result<$result_type, crate::WinWebAuthnError> {
            let library = crate::api::sys::util::load_webauthn_lib()?;
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
            crate::api::sys::util::free_webauthn_lib(library)?;
            Ok(response)
        }
    )
}

pub(super) use webauthn_call;

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
