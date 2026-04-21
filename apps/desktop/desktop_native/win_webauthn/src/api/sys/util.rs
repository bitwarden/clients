use std::sync::OnceLock;

use windows::{
    core::s,
    Win32::{
        Foundation::{FreeLibrary, HMODULE},
        System::LibraryLoader::{
            GetModuleHandleExA, LoadLibraryExA, GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS,
            GET_MODULE_HANDLE_EX_FLAG_PIN, LOAD_LIBRARY_SEARCH_SYSTEM32,
        },
    },
};
use windows_core::{PCSTR, PCWSTR};

use crate::{ErrorKind, WinWebAuthnError};

struct SafeModule(HMODULE);
impl SafeModule {
    unsafe fn new(mut module: HMODULE) -> windows::core::Result<Self> {
        unsafe {
            // Pin the module so that it cannot be unloaded.
            GetModuleHandleExA(
                GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS | GET_MODULE_HANDLE_EX_FLAG_PIN,
                PCSTR::from_raw(module.0.cast()),
                &mut module,
            )?;
        }
        Ok(Self(module))
    }
}
static WEBAUTHN_LIB: OnceLock<windows::core::Result<SafeModule>> = OnceLock::new();

unsafe impl Send for SafeModule {}
unsafe impl Sync for SafeModule {}

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
                let address = windows::Win32::System::LibraryLoader::GetProcAddress(*library, windows::core::s!($symbol)).ok_or(
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
            Ok(response)
        }
    )
}

pub(super) use webauthn_call;

pub(super) fn load_webauthn_lib() -> Result<&'static HMODULE, WinWebAuthnError> {
    WEBAUTHN_LIB
        .get_or_init(|| unsafe {
            LoadLibraryExA(s!("webauthn.dll"), None, LOAD_LIBRARY_SEARCH_SYSTEM32)
                .and_then(|library| SafeModule::new(library))
        })
        .as_ref()
        .map(|module| &module.0)
        .map_err(|err| {
            WinWebAuthnError::with_cause(ErrorKind::DllLoad, "Failed to load webauthn.dll", err)
        })
}
