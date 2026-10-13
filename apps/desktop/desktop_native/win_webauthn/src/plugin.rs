//! Types useful for implementing a Windows passkey plugin authenticator.
pub use crate::api::plugin::{
    AuthenticatorState, Clsid, PluginAddAuthenticatorOptions, PluginAddAuthenticatorResponse,
    PluginAuthenticator, PluginCancelOperationRequest, PluginCredentialDetails, PluginError,
    PluginGetAssertionRequest, PluginLockStatus, PluginMakeCredentialRequest,
    PluginMakeCredentialResponse, PluginUserVerificationRequest, PluginUserVerificationResponse,
    WebAuthnPlugin,
};
