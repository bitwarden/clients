#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use windows_core::*;

mod pa;

pub fn register() -> i32 {
    8
}

pub fn get_version_number() -> u64 {
    unsafe { pa::WebAuthNGetApiVersionNumber() }.into()
}

pub fn add_authenticator() {
    unimplemented!();
}

#[interface("7bfb04b4-e89c-4b1d-8188-89c734e3a9eb")]
unsafe trait EXPERIMENTAL_IPluginAuthenticator: IUnknown {
    fn EXPERIMENTAL_PluginMakeCredential(&self) -> HRESULT;
    fn EXPERIMENTAL_PluginGetAssertion(&self) -> HRESULT;
    fn EXPERIMENTAL_PluginCancelOperation(&self) -> HRESULT;
}

#[implement(EXPERIMENTAL_IPluginAuthenticator)]
struct COMObject(i32);

impl EXPERIMENTAL_IPluginAuthenticator_Impl for COMObject_Impl {
    unsafe fn EXPERIMENTAL_PluginMakeCredential(&self) -> HRESULT {
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_PluginGetAssertion(&self) -> HRESULT {
        HRESULT(0)
    }

    unsafe fn EXPERIMENTAL_PluginCancelOperation(&self) -> HRESULT {
        HRESULT(0)
    }
}

/*

The COM object to provide:

interface EXPERIMENTAL_IPluginAuthenticator : IUnknown
{
    HRESULT EXPERIMENTAL_PluginMakeCredential(
        [in] EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST request,
        [out] EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE* response);

    HRESULT EXPERIMENTAL_PluginGetAssertion(
        [in] EXPERIMENTAL_PCWEBAUTHN_PLUGIN_OPERATION_REQUEST request,
        [out] EXPERIMENTAL_PWEBAUTHN_PLUGIN_OPERATION_RESPONSE* response);

    HRESULT EXPERIMENTAL_PluginCancelOperation(
        [in] EXPERIMENTAL_PCWEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST request);
}

*/
