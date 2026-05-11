//! Types useful for implementing a Windows passkey plugin authenticator.
pub use crate::api::plugin::{
    Clsid, PluginAddAuthenticatorOptions, PluginAddAuthenticatorResponse, PluginAuthenticator,
    PluginCancelOperationRequest, PluginCredentialDetails, PluginGetAssertionRequest,
    PluginLockStatus, PluginMakeCredentialRequest, PluginMakeCredentialResponse,
    PluginUserVerificationRequest, PluginUserVerificationResponse, WebAuthnPlugin,
};
