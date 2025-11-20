mod com;
mod types;
mod util;

use std::{error::Error, fmt::Display, ptr::NonNull};

use windows::core::GUID;

pub use types::{
    AuthenticatorInfo, CtapTransport, CtapVersion, PluginAddAuthenticatorOptions,
    PluginCancelOperationRequest, PluginGetAssertionRequest, PluginLockStatus,
    PluginMakeCredentialRequest, PluginMakeCredentialResponse, PublicKeyCredentialParameters,
};

pub use com::PluginAuthenticator;
pub use util::HwndExt;

use crate::win_webauthn::{
    types::{
        webauthn_plugin_add_authenticator, PluginAddAuthenticatorResponse,
        WebAuthnPluginAddAuthenticatorResponse, WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS,
    },
    util::WindowsString,
};

#[derive(Clone, Copy)]
pub struct Clsid(GUID);

impl TryFrom<&str> for Clsid {
    type Error = WinWebAuthnError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        // Remove hyphens and parse as hex
        let clsid_clean = value.replace("-", "").replace("{", "").replace("}", "");
        if clsid_clean.len() != 32 {
            return Err(WinWebAuthnError::new(
                ErrorKind::Serialization,
                "Invalid CLSID format",
            ));
        }

        // Convert to u128 and create GUID
        let clsid_u128 = u128::from_str_radix(&clsid_clean, 16).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::Serialization,
                "Failed to parse CLSID as hex",
                err,
            )
        })?;

        let clsid = Clsid(GUID::from_u128(clsid_u128));
        Ok(clsid)
    }
}

pub struct WebAuthnPlugin {
    clsid: Clsid,
}

impl WebAuthnPlugin {
    pub fn new(clsid: Clsid) -> Self {
        WebAuthnPlugin { clsid }
    }

    /// Registers a COM server with Windows.
    ///
    /// The handler should be an instance of your type that implements PluginAuthenticator.
    /// The same instance will be shared across all COM calls.
    ///
    /// This only needs to be called on installation of your application.
    pub fn register_server<T>(&self, handler: T) -> Result<(), WinWebAuthnError>
    where
        T: PluginAuthenticator + Send + Sync + 'static,
    {
        com::register_server(&self.clsid.0, handler)
    }

    /// Initializes the COM library for use on the calling thread,
    /// and registers + sets the security values.
    pub fn initialize() -> Result<(), WinWebAuthnError> {
        com::initialize()
    }

    /// Adds this implementation as a Windows WebAuthn plugin.
    ///
    /// This only needs to be called on installation of your application.
    pub fn add_authenticator(
        options: PluginAddAuthenticatorOptions,
    ) -> Result<PluginAddAuthenticatorResponse, WinWebAuthnError> {
        let mut response_ptr: *mut WebAuthnPluginAddAuthenticatorResponse = std::ptr::null_mut();

        // We need to be careful to use .as_ref() to ensure that we're not
        // sending dangling pointers to API.
        let authenticator_name = options.authenticator_name.to_utf16();

        let rp_id = options.rp_id.as_ref().map(|rp_id| rp_id.to_utf16());
        let pwszPluginRpId = rp_id.as_ref().map_or(std::ptr::null(), |v| v.as_ptr());

        let light_logo_b64 = options.light_theme_logo_b64();
        let pwszLightThemeLogoSvg = light_logo_b64
            .as_ref()
            .map_or(std::ptr::null(), |v| v.as_ptr());
        let dark_logo_b64 = options.dark_theme_logo_b64();
        let pwszDarkThemeLogoSvg = dark_logo_b64
            .as_ref()
            .map_or(std::ptr::null(), |v| v.as_ptr());

        let authenticator_info = options.authenticator_info.as_ctap_bytes()?;

        let supported_rp_ids: Option<Vec<Vec<u16>>> = options
            .supported_rp_ids
            .map(|ids| ids.iter().map(|id| id.to_utf16()).collect());
        let supported_rp_id_ptrs: Option<Vec<*const u16>> = supported_rp_ids
            .as_ref()
            .map(|ids| ids.iter().map(Vec::as_ptr).collect());
        let pbSupportedRpIds = supported_rp_id_ptrs
            .as_ref()
            .map_or(std::ptr::null(), |v| v.as_ptr());

        let options_c = WEBAUTHN_PLUGIN_ADD_AUTHENTICATOR_OPTIONS {
            pwszAuthenticatorName: authenticator_name.as_ptr(),
            rclsid: &options.clsid.0,
            pwszPluginRpId,
            pwszLightThemeLogoSvg,
            pwszDarkThemeLogoSvg,
            cbAuthenticatorInfo: authenticator_info.len() as u32,
            pbAuthenticatorInfo: authenticator_info.as_ptr(),
            cSupportedRpIds: supported_rp_id_ptrs.map_or(0, |ids| ids.len() as u32),
            pbSupportedRpIds,
        };
        let result = webauthn_plugin_add_authenticator(&options_c, &mut response_ptr)?;
        result.ok().map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to add authenticator",
                err,
            )
        })?;

        if let Some(response) = NonNull::new(response_ptr) {
            Ok(response.into())
        } else {
            Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "WebAuthNPluginAddAuthenticatorResponse returned null",
            ))
        }
    }
}

#[derive(Debug)]
pub struct WinWebAuthnError {
    kind: ErrorKind,
    description: Option<String>,
    cause: Option<Box<dyn std::error::Error>>,
}

impl WinWebAuthnError {
    pub(crate) fn new(kind: ErrorKind, description: &str) -> Self {
        Self {
            kind,
            description: Some(description.to_string()),
            cause: None,
        }
    }

    pub(crate) fn with_cause<E: std::error::Error + 'static>(
        kind: ErrorKind,
        description: &str,
        cause: E,
    ) -> Self {
        let cause: Box<dyn std::error::Error> = Box::new(cause);
        Self {
            kind,
            description: Some(description.to_string()),
            cause: Some(cause),
        }
    }
}

#[derive(Debug)]
pub enum ErrorKind {
    DllLoad,
    Serialization,
    WindowsInternal,
}

impl Display for WinWebAuthnError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let msg = match self.kind {
            ErrorKind::Serialization => "Failed to serialize data",
            ErrorKind::DllLoad => "Failed to load function from DLL",
            ErrorKind::WindowsInternal => "A Windows error occurred",
        };
        f.write_str(msg)?;
        if let Some(d) = &self.description {
            write!(f, ": {d}")?;
        }
        if let Some(e) = &self.cause {
            write!(f, ". Caused by: {e}")?;
        }
        Ok(())
    }
}

impl Error for WinWebAuthnError {}

#[cfg(test)]
mod tests {
    use super::Clsid;

    const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

    #[test]
    fn test_parse_clsid_to_guid() {
        let result = Clsid::try_from(CLSID);
        assert!(result.is_ok(), "CLSID parsing should succeed");
    }
}
