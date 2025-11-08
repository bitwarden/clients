use std::alloc;
use std::mem::{align_of, MaybeUninit};
use std::ptr::NonNull;

use anyhow::{anyhow, Result};
use base64::engine::{general_purpose::URL_SAFE_NO_PAD, Engine};
use windows::core::s;
use windows::Win32::Foundation::FreeLibrary;
use windows::{
    core::{GUID, HRESULT, PCSTR},
    Win32::System::{Com::CoTaskMemAlloc, LibraryLoader::*},
};

use crate::autofill::{
    CommandResponse, RunCommand, RunCommandRequest, StatusResponse, StatusState, StatusSupport,
    SyncCredential, SyncParameters, SyncResponse,
};

const PLUGIN_CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

#[allow(clippy::unused_async)]
pub async fn run_command(value: String) -> Result<String> {
    // this.logService.info("Passkey request received:", { error, event });

    let request: RunCommandRequest = serde_json::from_str(&value)
        .map_err(|e| anyhow!("Failed to deserialize passkey request: {e}"))?;

    if request.namespace != "autofill" {
        return Err(anyhow!("Unknown namespace: {}", request.namespace));
    }
    let response: CommandResponse = match request.command {
        RunCommand::Status => handle_status_request()?.try_into()?,
        RunCommand::Sync => {
            let params: SyncParameters = serde_json::from_value(request.params)
                .map_err(|e| anyhow!("Could not parse sync parameters: {e}"))?;
            handle_sync_request(params)?.try_into()?
        }
    };
    serde_json::to_string(&response).map_err(|e| anyhow!("Failed to serialize response: {e}"))

    /*
      try {
        const request = JSON.parse(event.requestJson);
        this.logService.info("Parsed passkey request:", { type: event.requestType, request });

        // Handle different request types based on the requestType field
        switch (event.requestType) {
          case "assertion":
            return await this.handleAssertionRequest(request);
          case "registration":
            return await this.handleRegistrationRequest(request);
          case "sync":
            return await this.handleSyncRequest(request);
          default:
            this.logService.error("Unknown passkey request type:", event.requestType);
            return JSON.stringify({
              type: "error",
              message: `Unknown request type: ${event.requestType}`,
            });
        }
      } catch (parseError) {
        this.logService.error("Failed to parse passkey request:", parseError);
        return JSON.stringify({
          type: "error",
          message: "Failed to parse request JSON",
        });
      }
    */
}

fn handle_sync_request(params: SyncParameters) -> Result<SyncResponse> {
    let credentials: Vec<SyncedCredential> = params
        .credentials
        .into_iter()
        .filter_map(|c| c.try_into().ok())
        .collect();
    let num_creds = credentials.len().try_into().unwrap_or(u32::MAX);
    sync_credentials_to_windows(credentials, PLUGIN_CLSID)
        .map_err(|e| anyhow!("Failed to sync credentials to Windows: {e}"))?;
    Ok(SyncResponse { added: num_creds })
    /*
      let mut log_file = std::fs::File::options()
          .append(true)
          .open("C:\\temp\\bitwarden_windows_core.log")
          .unwrap();
      log_file.write_all(b"Made it to sync!");
    */
}

fn handle_status_request() -> Result<StatusResponse> {
    Ok(StatusResponse {
        support: StatusSupport {
            fido2: true,
            password: false,
            incremental_updates: false,
        },
        state: StatusState { enabled: true },
    })
}

/*
async fn handleAssertionRequest(request: autofill.PasskeyAssertionRequest): Promise<string> {
    this.logService.info("Handling assertion request for rpId:", request.rpId);

    try {
      // Generate unique identifiers for tracking this request
      const clientId = Date.now();
      const sequenceNumber = Math.floor(Math.random() * 1000000);

      // Send request and wait for response
      const response = await this.sendAndOptionallyWait<autofill.PasskeyAssertionResponse>(
        "autofill.passkeyAssertion",
        {
          clientId,
          sequenceNumber,
          request: request,
        },
        { waitForResponse: true, timeout: 60000 },
      );

      if (response) {
        // Convert the response to the format expected by the NAPI bridge
        return JSON.stringify({
          type: "assertion_response",
          ...response,
        });
      } else {
        return JSON.stringify({
          type: "error",
          message: "No response received from renderer",
        });
      }
    } catch (error) {
      this.logService.error("Error in assertion request:", error);
      return JSON.stringify({
        type: "error",
        message: `Assertion request failed: ${error.message}`,
      });
    }
  }

  private async handleRegistrationRequest(
    request: autofill.PasskeyRegistrationRequest,
  ): Promise<string> {
    this.logService.info("Handling registration request for rpId:", request.rpId);

    try {
      // Generate unique identifiers for tracking this request
      const clientId = Date.now();
      const sequenceNumber = Math.floor(Math.random() * 1000000);

      // Send request and wait for response
      const response = await this.sendAndOptionallyWait<autofill.PasskeyRegistrationResponse>(
        "autofill.passkeyRegistration",
        {
          clientId,
          sequenceNumber,
          request: request,
        },
        { waitForResponse: true, timeout: 60000 },
      );

      this.logService.info("Received response for registration request:", response);

      if (response) {
        // Convert the response to the format expected by the NAPI bridge
        return JSON.stringify({
          type: "registration_response",
          ...response,
        });
      } else {
        return JSON.stringify({
          type: "error",
          message: "No response received from renderer",
        });
      }
    } catch (error) {
      this.logService.error("Error in registration request:", error);
      return JSON.stringify({
        type: "error",
        message: `Registration request failed: ${error.message}`,
      });
    }
  }

  private async handleSyncRequest(
    request: passkey_authenticator.PasskeySyncRequest,
  ): Promise<string> {
    this.logService.info("Handling sync request for rpId:", request.rpId);

    try {
      // Generate unique identifiers for tracking this request
      const clientId = Date.now();
      const sequenceNumber = Math.floor(Math.random() * 1000000);

      // Send sync request and wait for response
      const response = await this.sendAndOptionallyWait<passkey_authenticator.PasskeySyncResponse>(
        "autofill.passkeySync",
        {
          clientId,
          sequenceNumber,
          request: { rpId: request.rpId },
        },
        { waitForResponse: true, timeout: 60000 },
      );

      this.logService.info("Received response for sync request:", response);

      if (response && response.credentials) {
        // Convert the response to the format expected by the NAPI bridge
        return JSON.stringify({
          type: "sync_response",
          credentials: response.credentials,
        });
      } else {
        return JSON.stringify({
          type: "error",
          message: "No credentials received from renderer",
        });
      }
    } catch (error) {
      this.logService.error("Error in sync request:", error);
      return JSON.stringify({
        type: "error",
        message: `Sync request failed: ${error.message}`,
      });
    }
  }

*/

impl TryFrom<SyncCredential> for SyncedCredential {
    type Error = anyhow::Error;

    fn try_from(value: SyncCredential) -> Result<Self, anyhow::Error> {
        if let SyncCredential::Fido2 {
            rp_id,
            credential_id,
            user_name,
            user_handle,
            ..
        } = value
        {
            Ok(Self {
                credential_id: URL_SAFE_NO_PAD
                    .decode(credential_id)
                    .map_err(|e| anyhow!("Could not decode credential ID: {e}"))?,
                rp_id: rp_id,
                user_name: user_name,
                user_handle: URL_SAFE_NO_PAD
                    .decode(&user_handle)
                    .map_err(|e| anyhow!("Could not decode user handle: {e}"))?,
            })
        } else {
            Err(anyhow!("Only FIDO2 credentials are supported."))
        }
    }
}

/// Initiates credential sync from Electron to Windows - called when Electron wants to push credentials to Windows
fn sync_credentials_to_windows(
    credentials: Vec<SyncedCredential>,
    plugin_clsid: &str,
) -> Result<(), String> {
    tracing::debug!(
        "[SYNC_TO_WIN] sync_credentials_to_windows called with {} credentials for plugin CLSID: {}",
        credentials.len(),
        plugin_clsid
    );

    // Parse CLSID string to GUID
    let clsid_guid = parse_clsid_to_guid_str(plugin_clsid)
        .map_err(|e| format!("Failed to parse CLSID: {}", e))?;

    if credentials.is_empty() {
        tracing::debug!("[SYNC_TO_WIN] No credentials to sync, proceeding with empty sync");
    }

    // Convert Bitwarden credentials to Windows credential details
    let mut win_credentials = Vec::new();

    for (i, cred) in credentials.iter().enumerate() {
        tracing::debug!("[SYNC_TO_WIN] Converting credential {}: RP ID: {}, User: {}, Credential ID: {:?} ({} bytes), User ID: {:?} ({} bytes)",
            i + 1, cred.rp_id, cred.user_name, &cred.credential_id, cred.credential_id.len(), &cred.user_handle, cred.user_handle.len());

        let win_cred = WebAuthnPluginCredentialDetails::create_from_bytes(
            cred.credential_id.clone(), // Pass raw bytes
            cred.rp_id.clone(),
            cred.rp_id.clone(),       // Use RP ID as friendly name for now
            cred.user_handle.clone(), // Pass raw bytes
            cred.user_name.clone(),
            cred.user_name.clone(), // Use user name as display name for now
        );

        win_credentials.push(win_cred);
        tracing::debug!(
            "[SYNC_TO_WIN] Converted credential {} to Windows format",
            i + 1
        );
    }

    // First try to remove all existing credentials for this plugin
    tracing::debug!("Attempting to remove all existing credentials before sync...");
    match remove_all_credentials(clsid_guid) {
        Ok(()) => {
            tracing::debug!("Successfully removed existing credentials");
        }
        Err(e) if e.contains("can't be loaded") => {
            tracing::debug!("RemoveAllCredentials function not available - this is expected for some Windows versions");
            // This is fine, the function might not exist in all versions
        }
        Err(e) => {
            tracing::debug!("Warning: Failed to remove existing credentials: {}", e);
            // Continue anyway, as this might be the first sync or an older Windows version
        }
    }

    // Add the new credentials (only if we have any)
    if credentials.is_empty() {
        tracing::debug!("No credentials to add to Windows - sync completed successfully");
        Ok(())
    } else {
        tracing::debug!("Adding new credentials to Windows...");
        match add_credentials(clsid_guid, win_credentials) {
            Ok(()) => {
                tracing::debug!("Successfully synced credentials to Windows");
                Ok(())
            }
            Err(e) => {
                tracing::debug!("ERROR: Failed to add credentials to Windows: {}", e);
                Err(e)
            }
        }
    }
}

/// Credential data for sync operations
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncedCredential {
    pub credential_id: Vec<u8>,
    pub rp_id: String,
    pub user_name: String,
    pub user_handle: Vec<u8>,
}

/// Represents a credential.
/// Header File Name: _WEBAUTHN_PLUGIN_CREDENTIAL_DETAILS
/// Header File Usage: WebAuthNPluginAuthenticatorAddCredentials, etc.
#[repr(C)]
#[derive(Debug, Copy, Clone)]
struct WebAuthnPluginCredentialDetails {
    pub credential_id_byte_count: u32,
    pub credential_id_pointer: *const u8, // Changed to const in stable
    pub rpid: *const u16,                 // Changed to const (LPCWSTR)
    pub rp_friendly_name: *const u16,     // Changed to const (LPCWSTR)
    pub user_id_byte_count: u32,
    pub user_id_pointer: *const u8,    // Changed to const
    pub user_name: *const u16,         // Changed to const (LPCWSTR)
    pub user_display_name: *const u16, // Changed to const (LPCWSTR)
}

impl WebAuthnPluginCredentialDetails {
    pub fn create_from_bytes(
        credential_id: Vec<u8>,
        rpid: String,
        rp_friendly_name: String,
        user_id: Vec<u8>,
        user_name: String,
        user_display_name: String,
    ) -> Self {
        // Allocate credential_id bytes with COM
        let (credential_id_pointer, credential_id_byte_count) =
            ComBuffer::from_buffer(&credential_id);

        // Allocate user_id bytes with COM
        let (user_id_pointer, user_id_byte_count) = ComBuffer::from_buffer(&user_id);

        // Convert strings to null-terminated wide strings using trait methods
        let (rpid_ptr, _) = rpid.to_com_utf16();
        let (rp_friendly_name_ptr, _) = rp_friendly_name.to_com_utf16();
        let (user_name_ptr, _) = user_name.to_com_utf16();
        let (user_display_name_ptr, _) = user_display_name.to_com_utf16();

        Self {
            credential_id_byte_count,
            credential_id_pointer: credential_id_pointer as *const u8,
            rpid: rpid_ptr as *const u16,
            rp_friendly_name: rp_friendly_name_ptr as *const u16,
            user_id_byte_count,
            user_id_pointer: user_id_pointer as *const u8,
            user_name: user_name_ptr as *const u16,
            user_display_name: user_display_name_ptr as *const u16,
        }
    }
}

// Stable API function signatures - now use REFCLSID and flat arrays
type WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration = unsafe extern "cdecl" fn(
    rclsid: *const GUID, // Changed from string to GUID reference
    cCredentialDetails: u32,
    pCredentialDetails: *const WebAuthnPluginCredentialDetails, // Flat array, not list
) -> HRESULT;

/// Trait for converting strings to Windows-compatible wide strings using COM allocation
pub trait WindowsString {
    /// Converts to null-terminated UTF-16 using COM allocation
    fn to_com_utf16(&self) -> (*mut u16, u32);
    /// Converts to Vec<u16> for temporary use (caller must keep Vec alive)
    fn to_utf16(&self) -> Vec<u16>;
}

impl WindowsString for str {
    fn to_com_utf16(&self) -> (*mut u16, u32) {
        let mut wide_vec: Vec<u16> = self.encode_utf16().collect();
        wide_vec.push(0); // null terminator
        let wide_bytes: Vec<u8> = wide_vec.iter().flat_map(|&x| x.to_le_bytes()).collect();
        let (ptr, byte_count) = ComBuffer::from_buffer(&wide_bytes);
        (ptr as *mut u16, byte_count)
    }

    fn to_utf16(&self) -> Vec<u16> {
        let mut wide_vec: Vec<u16> = self.encode_utf16().collect();
        wide_vec.push(0); // null terminator
        wide_vec
    }
}

#[repr(transparent)]
pub struct ComBuffer(NonNull<MaybeUninit<u8>>);

impl ComBuffer {
    /// Returns an COM-allocated buffer of `size`.
    fn alloc(size: usize, for_slice: bool) -> Self {
        #[expect(clippy::as_conversions)]
        {
            assert!(size <= isize::MAX as usize, "requested bad object size");
        }

        // SAFETY: Any size is valid to pass to Windows, even `0`.
        let ptr = NonNull::new(unsafe { CoTaskMemAlloc(size) }).unwrap_or_else(|| {
            // XXX: This doesn't have to be correct, just close enough for an OK OOM error.
            let layout = alloc::Layout::from_size_align(size, align_of::<u8>()).unwrap();
            alloc::handle_alloc_error(layout)
        });

        if for_slice {
            // Ininitialize the buffer so it can later be treated as `&mut [u8]`.
            // SAFETY: The pointer is valid and we are using a valid value for a byte-wise allocation.
            unsafe { ptr.write_bytes(0, size) };
        }

        Self(ptr.cast())
    }

    fn into_ptr<T>(self) -> *mut T {
        self.0.cast().as_ptr()
    }

    /// Creates a new COM-allocated structure.
    ///
    /// Note that `T` must be [Copy] to avoid any possible memory leaks.
    pub fn with_object<T: Copy>(object: T) -> *mut T {
        // NB: Vendored from Rust's alloc code since we can't yet allocate `Box` with a custom allocator.
        const MIN_ALIGN: usize = if cfg!(target_pointer_width = "64") {
            16
        } else if cfg!(target_pointer_width = "32") {
            8
        } else {
            panic!("unsupported arch")
        };

        // SAFETY: Validate that our alignment works for a normal size-based allocation for soundness.
        let layout = const {
            let layout = alloc::Layout::new::<T>();
            assert!(layout.align() <= MIN_ALIGN);
            layout
        };

        let buffer = Self::alloc(layout.size(), false);
        // SAFETY: `ptr` is valid for writes of `T` because we correctly allocated the right sized buffer that
        // accounts for any alignment requirements.
        //
        // Additionally, we ensure the value is treated as moved by forgetting the source.
        unsafe { buffer.0.cast::<T>().write(object) };
        buffer.into_ptr()
    }

    pub fn from_buffer<T: AsRef<[u8]>>(buffer: T) -> (*mut u8, u32) {
        let buffer = buffer.as_ref();
        let len = buffer.len();
        let com_buffer = Self::alloc(len, true);

        // SAFETY: `ptr` points to a valid allocation that `len` matches, and we made sure
        // the bytes were initialized. Additionally, bytes have no alignment requirements.
        unsafe {
            NonNull::slice_from_raw_parts(com_buffer.0.cast::<u8>(), len)
                .as_mut()
                .copy_from_slice(buffer)
        }

        // Safety: The Windows API structures these buffers are placed into use `u32` (`DWORD`) to
        // represent length.
        #[expect(clippy::as_conversions)]
        (com_buffer.into_ptr(), len as u32)
    }
}

/// Converts a CLSID string to a GUID
pub(crate) fn parse_clsid_to_guid_str(clsid_str: &str) -> Result<GUID, String> {
    // Remove hyphens and parse as hex
    let clsid_clean = clsid_str.replace("-", "");
    if clsid_clean.len() != 32 {
        return Err("Invalid CLSID format".to_string());
    }

    // Convert to u128 and create GUID
    let clsid_u128 = u128::from_str_radix(&clsid_clean, 16)
        .map_err(|_| "Failed to parse CLSID as hex".to_string())?;

    Ok(GUID::from_u128(clsid_u128))
}

pub fn remove_all_credentials(clsid_guid: GUID) -> std::result::Result<(), String> {
    tracing::debug!("Loading WebAuthNPluginAuthenticatorRemoveAllCredentials function...");

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorRemoveAllCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorRemoveAllCredentials"),
        )
    };

    match result {
        Some(api) => {
            tracing::debug!("Function loaded successfully, calling API...");

            let result = unsafe { api(&clsid_guid) };

            if result.is_err() {
                let error_code = result.0;
                tracing::debug!("API call failed with HRESULT: 0x{:x}", error_code);

                return Err(format!(
                    "Error: Error response from WebAuthNPluginAuthenticatorRemoveAllCredentials()\nHRESULT: 0x{:x}\n{}",
                    error_code, result.message()
                ));
            }

            tracing::debug!("API call succeeded");
            Ok(())
        }
        None => {
            tracing::debug!("Failed to load WebAuthNPluginAuthenticatorRemoveAllCredentials function from webauthn.dll");
            Err(String::from("Error: Can't complete remove_all_credentials(), as the function WebAuthNPluginAuthenticatorRemoveAllCredentials can't be loaded."))
        }
    }
}

pub unsafe fn delay_load<T>(library: PCSTR, function: PCSTR) -> Option<T> {
    let library = LoadLibraryExA(library, None, LOAD_LIBRARY_SEARCH_DEFAULT_DIRS);

    let Ok(library) = library else {
        return None;
    };

    let address = GetProcAddress(library, function);

    if address.is_some() {
        return Some(std::mem::transmute_copy(&address));
    }

    _ = FreeLibrary(library);

    None
}

fn add_credentials(
    clsid_guid: GUID,
    credentials: Vec<WebAuthnPluginCredentialDetails>,
) -> std::result::Result<(), String> {
    tracing::debug!("Loading WebAuthNPluginAuthenticatorAddCredentials function...");

    let result = unsafe {
        delay_load::<WebAuthNPluginAuthenticatorAddCredentialsFnDeclaration>(
            s!("webauthn.dll"),
            s!("WebAuthNPluginAuthenticatorAddCredentials"),
        )
    };

    match result {
        Some(api) => {
            tracing::debug!("Function loaded successfully, calling API...");
            tracing::debug!("Adding {} credentials", credentials.len());

            let credential_count = credentials.len() as u32;
            let credentials_ptr = if credentials.is_empty() {
                std::ptr::null()
            } else {
                credentials.as_ptr()
            };

            let result = unsafe { api(&clsid_guid, credential_count, credentials_ptr) };

            if result.is_err() {
                let error_code = result.0;
                tracing::debug!("API call failed with HRESULT: 0x{:x}", error_code);
                return Err(format!(
                    "Error: Error response from WebAuthNPluginAuthenticatorAddCredentials()\nHRESULT: 0x{:x}\n{}",
                    error_code, result.message()
                ));
            }

            tracing::debug!("API call succeeded");
            Ok(())
        }
        None => {
            tracing::debug!("Failed to load WebAuthNPluginAuthenticatorAddCredentials function from webauthn.dll");
            Err(String::from("Error: Can't complete add_credentials(), as the function WebAuthNPluginAuthenticatorAddCredentials can't be loaded."))
        }
    }
}

type WebAuthNPluginAuthenticatorRemoveAllCredentialsFnDeclaration =
    unsafe extern "cdecl" fn(rclsid: *const GUID) -> HRESULT;
