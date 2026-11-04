//! WebAuthn assertions with the platform and security key passkey providers of
//! `ASAuthorizationController`. See `src/native/webauthn/platform_passkeys.m`.

use std::{
    ffi::{c_char, c_void, CStr, CString},
    ptr::{self, NonNull},
    slice,
    sync::mpsc,
};

use crate::operation::{Operation, OperationCanceller};

/// A request for an assertion.
pub struct AssertionRequest<'a> {
    pub rp_id: &'a str,
    pub challenge: &'a [u8],
    /// Credentials that may be used. If empty, any discoverable credential for the RP may be used.
    pub allow_credentials: &'a [CredentialDescriptor<'a>],
    pub user_verification: UserVerification,
    /// PRF extension `eval` inputs. The system hashes them into salts. PRF needs macOS 15 for
    /// platform credentials and macOS 26.4 for security keys; it is not requested on older
    /// versions.
    pub prf: Option<PrfValues<'a>>,
    /// The U2F app ID from the `appid` extension. It is only used for security keys, and needs
    /// macOS 14.5; it is not requested on older versions.
    pub app_id: Option<&'a str>,
}

pub struct CredentialDescriptor<'a> {
    pub id: &'a [u8],
    /// How to reach the credential if it is on a security key.
    pub transports: SecurityKeyTransports,
}

/// A set of transports for reaching a security key.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct SecurityKeyTransports(u32);

impl SecurityKeyTransports {
    pub const USB: Self = Self(1 << 0);
    pub const NFC: Self = Self(1 << 1);
    pub const BLE: Self = Self(1 << 2);
    /// Every transport the device supports.
    pub const ALL_SUPPORTED: Self = Self(1 << 31);
}

impl std::ops::BitOr for SecurityKeyTransports {
    type Output = Self;

    fn bitor(self, rhs: Self) -> Self {
        Self(self.0 | rhs.0)
    }
}

impl std::ops::BitOrAssign for SecurityKeyTransports {
    fn bitor_assign(&mut self, rhs: Self) {
        self.0 |= rhs.0;
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UserVerification {
    Required = 0,
    Preferred = 1,
    Discouraged = 2,
}

/// PRF extension inputs. These are secrets and must not be logged.
pub struct PrfValues<'a> {
    pub first: &'a [u8],
    pub second: Option<&'a [u8]>,
}

/// An assertion returned by the system.
pub struct AssertionResponse {
    pub credential_id: Vec<u8>,
    /// The client data that Apple created and that was signed.
    pub client_data_json: Vec<u8>,
    pub authenticator_data: Vec<u8>,
    pub signature: Vec<u8>,
    pub user_handle: Option<Vec<u8>>,
    pub attachment: Option<Attachment>,
    /// PRF outputs. These are secrets and must not be logged.
    pub prf: Option<PrfOutputs>,
    /// Whether the U2F app ID was used, if one was requested.
    pub app_id_used: Option<bool>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Attachment {
    Platform,
    CrossPlatform,
}

pub struct PrfOutputs {
    pub first: Vec<u8>,
    pub second: Option<Vec<u8>>,
}

#[derive(Debug)]
pub enum AssertionError {
    /// This version of macOS does not support passkeys.
    NotSupported(String),
    /// The request could not be made.
    InvalidRequest(String),
    /// The system failed the request, including when the user cancelled it.
    Authorization {
        domain: String,
        code: i64,
        message: String,
    },
}

/// The `ASAuthorizationErrorDomain` error domain.
pub const AS_AUTHORIZATION_ERROR_DOMAIN: &str =
    "com.apple.AuthenticationServices.AuthorizationError";

/// `ASAuthorizationError` codes.
pub mod as_authorization_error {
    pub const CANCELED: i64 = 1001;
    pub const FAILED: i64 = 1004;
}

/// An assertion in progress.
pub struct PendingAssertion {
    canceller: OperationCanceller,
    rx: mpsc::Receiver<Result<AssertionResponse, AssertionError>>,
}

impl PendingAssertion {
    /// Returns a handle that cancels the assertion from any thread. The assertion fails with
    /// [as_authorization_error::CANCELED].
    pub fn canceller(&self) -> OperationCanceller {
        self.canceller.clone()
    }

    /// Blocks until the assertion completes. This must not be called on the main thread, which
    /// runs the system's prompt.
    pub fn wait(self) -> Result<AssertionResponse, AssertionError> {
        self.rx.recv().unwrap_or_else(|_| {
            Err(AssertionError::InvalidRequest(
                "The assertion completed without a result".to_string(),
            ))
        })
    }
}

type ResultSender = mpsc::Sender<Result<AssertionResponse, AssertionError>>;

/// Starts an assertion, showing the system's passkey prompt modal to the window containing
/// `view`. The prompt runs on the main thread's run loop.
///
/// # Safety
/// `view` must point to an `NSView` that is alive for the duration of this call, such as the
/// handle from Electron's `getNativeWindowHandle()` for an open window.
pub unsafe fn get_assertion(
    view: NonNull<c_void>,
    request: &AssertionRequest<'_>,
) -> Result<PendingAssertion, AssertionError> {
    let invalid =
        |name: &str| AssertionError::InvalidRequest(format!("{name} contains a NUL byte"));
    let rp_id = CString::new(request.rp_id).map_err(|_| invalid("rpId"))?;
    let app_id = request
        .app_id
        .map(CString::new)
        .transpose()
        .map_err(|_| invalid("appid"))?;
    let allow_credentials: Vec<_> = request
        .allow_credentials
        .iter()
        .map(|c| ffi::CredentialDescriptor {
            id: c.id.into(),
            transports: c.transports.0,
        })
        .collect();

    let ffi_request = ffi::AssertionRequest {
        rp_id: rp_id.as_ptr(),
        challenge: request.challenge.into(),
        allow_credentials: allow_credentials.as_ptr(),
        allow_credentials_len: allow_credentials.len(),
        user_verification: request.user_verification as i32,
        has_prf: request.prf.is_some(),
        prf_first: request
            .prf
            .as_ref()
            .map(|p| p.first)
            .unwrap_or_default()
            .into(),
        has_prf_second: request.prf.as_ref().is_some_and(|p| p.second.is_some()),
        prf_second: request
            .prf
            .as_ref()
            .and_then(|p| p.second)
            .unwrap_or_default()
            .into(),
        app_id: app_id.as_ref().map_or(ptr::null(), |a| a.as_ptr()),
    };

    let (tx, rx) = mpsc::channel();
    let context = Box::into_raw(Box::new(tx)).cast::<c_void>();
    // SAFETY: The request and everything it points to are alive for this call, which copies them.
    // The callback takes ownership of `context` exactly once.
    let operation = unsafe {
        ffi::webauthnGetAssertion(view.as_ptr(), &ffi_request, context, assertion_complete)
    };
    let operation = NonNull::new(operation).ok_or_else(|| {
        AssertionError::InvalidRequest("Failed to start the assertion".to_string())
    })?;

    Ok(PendingAssertion {
        // SAFETY: webauthnCancelOperation and webauthnReleaseOperation accept the operation from
        // any thread until it is released.
        canceller: OperationCanceller::new(unsafe {
            Operation::new(
                operation,
                ffi::webauthnCancelOperation,
                ffi::webauthnReleaseOperation,
            )
        }),
        rx,
    })
}

extern "C" fn assertion_complete(context: *mut c_void, result: *const ffi::AssertionResult) {
    // SAFETY: `context` is the sender boxed in get_assertion, and this is called exactly once.
    let tx = unsafe { Box::from_raw(context.cast::<ResultSender>()) };
    // SAFETY: The result and everything it points to are valid during this callback.
    let result = unsafe { &*result };
    // The receiver is gone if the caller stopped waiting, so the result is not needed.
    let _ = tx.send(unsafe { result.to_rust() });
}

mod ffi {
    use super::*;

    /// Mirrors `struct WebAuthnBytes`.
    #[repr(C)]
    pub struct Bytes {
        data: *const u8,
        len: usize,
    }

    impl From<&[u8]> for Bytes {
        fn from(bytes: &[u8]) -> Self {
            Self {
                data: bytes.as_ptr(),
                len: bytes.len(),
            }
        }
    }

    impl Bytes {
        /// # Safety
        /// `data` must point to `len` bytes, or `len` must be 0.
        unsafe fn to_vec(&self) -> Vec<u8> {
            if self.len == 0 || self.data.is_null() {
                return Vec::new();
            }
            unsafe { slice::from_raw_parts(self.data, self.len) }.to_vec()
        }
    }

    /// Mirrors `struct WebAuthnCredentialDescriptor`.
    #[repr(C)]
    pub struct CredentialDescriptor {
        pub id: Bytes,
        pub transports: u32,
    }

    /// Mirrors `struct WebAuthnAssertionRequest`.
    #[repr(C)]
    pub struct AssertionRequest {
        pub rp_id: *const c_char,
        pub challenge: Bytes,
        pub allow_credentials: *const CredentialDescriptor,
        pub allow_credentials_len: usize,
        pub user_verification: i32,
        pub has_prf: bool,
        pub prf_first: Bytes,
        pub has_prf_second: bool,
        pub prf_second: Bytes,
        pub app_id: *const c_char,
    }

    const STATUS_SUCCESS: i32 = 0;
    const STATUS_NOT_SUPPORTED: i32 = 1;
    const STATUS_INVALID_REQUEST: i32 = 2;

    const ATTACHMENT_PLATFORM: i32 = 1;
    const ATTACHMENT_CROSS_PLATFORM: i32 = 2;

    const APP_ID_NOT_USED: i32 = 0;
    const APP_ID_USED: i32 = 1;

    /// Mirrors `struct WebAuthnAssertionResult`.
    #[repr(C)]
    pub struct AssertionResult {
        status: i32,
        error_message: *const c_char,
        error_domain: *const c_char,
        error_code: i64,
        credential_id: Bytes,
        client_data_json: Bytes,
        authenticator_data: Bytes,
        signature: Bytes,
        user_handle: Bytes,
        attachment: i32,
        has_prf: bool,
        prf_first: Bytes,
        has_prf_second: bool,
        prf_second: Bytes,
        app_id_used: i32,
    }

    impl AssertionResult {
        /// # Safety
        /// Must be called during the callback that received the result.
        pub unsafe fn to_rust(&self) -> Result<AssertionResponse, AssertionError> {
            let string = |s: *const c_char| {
                if s.is_null() {
                    String::new()
                } else {
                    unsafe { CStr::from_ptr(s) }.to_string_lossy().into_owned()
                }
            };
            match self.status {
                STATUS_SUCCESS => {}
                STATUS_NOT_SUPPORTED => {
                    return Err(AssertionError::NotSupported(string(self.error_message)))
                }
                STATUS_INVALID_REQUEST => {
                    return Err(AssertionError::InvalidRequest(string(self.error_message)))
                }
                _ => {
                    return Err(AssertionError::Authorization {
                        domain: string(self.error_domain),
                        code: self.error_code,
                        message: string(self.error_message),
                    })
                }
            }

            // SAFETY: The caller guarantees that the buffers are valid.
            unsafe {
                // Security keys may return an empty user handle when the allow list is used.
                let user_handle = self.user_handle.to_vec();
                Ok(AssertionResponse {
                    credential_id: self.credential_id.to_vec(),
                    client_data_json: self.client_data_json.to_vec(),
                    authenticator_data: self.authenticator_data.to_vec(),
                    signature: self.signature.to_vec(),
                    user_handle: (!user_handle.is_empty()).then_some(user_handle),
                    attachment: match self.attachment {
                        ATTACHMENT_PLATFORM => Some(Attachment::Platform),
                        ATTACHMENT_CROSS_PLATFORM => Some(Attachment::CrossPlatform),
                        _ => None,
                    },
                    prf: self.has_prf.then(|| PrfOutputs {
                        first: self.prf_first.to_vec(),
                        second: self.has_prf_second.then(|| self.prf_second.to_vec()),
                    }),
                    app_id_used: match self.app_id_used {
                        APP_ID_NOT_USED => Some(false),
                        APP_ID_USED => Some(true),
                        _ => None,
                    },
                })
            }
        }
    }

    pub type AssertionCallback = extern "C" fn(*mut c_void, *const AssertionResult);

    unsafe extern "C" {
        pub unsafe fn webauthnGetAssertion(
            view: *mut c_void,
            request: *const AssertionRequest,
            context: *mut c_void,
            callback: AssertionCallback,
        ) -> *mut c_void;
        pub unsafe fn webauthnCancelOperation(operation: *mut c_void);
        pub unsafe fn webauthnReleaseOperation(operation: *mut c_void);
    }
}
