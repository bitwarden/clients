//! Windows-hello-based PRF derivation via KeyCredentialManager
//!
//! This module owns the interaction with Windows Hello: creating/opening the signing credential,
//! selecting a signing backend, and turning the resulting signature into a [`WindowsHelloPrf`]. The
//! cryptography that consumes the PRF lives in [`super::encryption`].

mod backend_legacy;

use anyhow::{anyhow, Result};
// Window-focus helpers used by `unlock` to restore focus to the previous window. They live
// with the legacy backend (which needs the focus hacks) and are surfaced to the parent module
// here.
pub(super) use backend_legacy::{get_active_window, restore_focus};
use tracing::debug;
use windows::{
    core::{h, Interface, HSTRING},
    Security::Credentials::{
        KeyCredential, KeyCredentialCreationOption,
        KeyCredentialManager as WindowsKeyCredentialManager, KeyCredentialOperationResult,
        KeyCredentialStatus,
    },
    Storage::Streams::IBuffer,
    Win32::System::WinRT::IBufferByteAccess,
};

use super::encryption::{Challenge, WindowsHelloPrf};

const CREDENTIAL_NAME: &HSTRING = h!("BitwardenBiometricsV2");

/// The Bitwarden abstraction over the Windows Hello `KeyCredentialManager` signing APIs.
pub(crate) struct KeyCredentialManager;

impl KeyCredentialManager {
    /// Derive a [`WindowsHelloPrf`] from a [`Challenge`] using the Windows Hello protected key
    /// store.
    pub(crate) async fn derive_prf(challenge: &Challenge) -> Result<WindowsHelloPrf> {
        debug!("[Windows Hello] Using legacy (manual focus) signing backend");
        backend_legacy::derive_prf(challenge).await
    }
}

/// Create the Bitwarden Biometrics signing key, or open it if it already exists.
async fn open_or_create_credential() -> Result<KeyCredential> {
    let key_credential_creation_result = WindowsKeyCredentialManager::RequestCreateAsync(
        CREDENTIAL_NAME,
        KeyCredentialCreationOption::FailIfExists,
    )?
    .await?;
    let result = match key_credential_creation_result.Status()? {
        KeyCredentialStatus::CredentialAlreadyExists => {
            WindowsKeyCredentialManager::OpenAsync(CREDENTIAL_NAME)?.await?
        }
        KeyCredentialStatus::Success => key_credential_creation_result,
        _ => return Err(anyhow!("Failed to create key credential")),
    };
    Ok(result.Credential()?)
}

/// Turn the result of a Windows Hello signing operation into a [`WindowsHelloPrf`] by extracting
/// the signature bytes and handing them to the crypto layer.
fn prf_from_signature(signature: KeyCredentialOperationResult) -> Result<WindowsHelloPrf> {
    if signature.Status()? != KeyCredentialStatus::Success {
        return Err(anyhow!("Failed to sign data"));
    }

    let mut signature_buffer = signature.Result()?;
    let signature_value = unsafe { as_mut_bytes(&mut signature_buffer)? };

    Ok(WindowsHelloPrf::derive_from_signature(signature_value))
}

unsafe fn as_mut_bytes(buffer: &mut IBuffer) -> Result<&mut [u8]> {
    let interop = buffer.cast::<IBufferByteAccess>()?;

    unsafe {
        let data = interop.Buffer()?;
        Ok(std::slice::from_raw_parts_mut(
            data,
            buffer.Length()? as usize,
        ))
    }
}
