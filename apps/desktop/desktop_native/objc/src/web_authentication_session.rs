//! Web pages opened in an `ASWebAuthenticationSession`, which return a result by navigating to a
//! callback URL. See `src/native/webauthn/web_authentication_session.m`.

use std::{
    ffi::{c_char, c_void, CStr, CString},
    ptr::NonNull,
    sync::mpsc,
};

use crate::{
    operation::{Operation, OperationCanceller},
    ObjCString,
};

/// The `ASWebAuthenticationSessionErrorDomain` error domain.
pub const AS_WEB_AUTHENTICATION_SESSION_ERROR_DOMAIN: &str =
    "com.apple.AuthenticationServices.WebAuthenticationSession";

/// `ASWebAuthenticationSessionErrorCodeCanceledLogin`.
pub const CANCELED_LOGIN: i64 = 1;

#[derive(Debug)]
pub enum SessionError {
    /// The session could not be started.
    InvalidRequest(String),
    /// The session failed, including when the user cancelled it.
    Session {
        domain: String,
        code: i64,
        message: String,
    },
}

/// A session in progress.
pub struct PendingSession {
    canceller: OperationCanceller,
    rx: mpsc::Receiver<Result<String, SessionError>>,
}

impl PendingSession {
    /// Returns a handle that closes the session from any thread. The session fails with
    /// [CANCELED_LOGIN].
    pub fn canceller(&self) -> OperationCanceller {
        self.canceller.clone()
    }

    /// Blocks until the page navigates to the callback URL, which is returned. This must not be
    /// called on the main thread, which runs the session.
    pub fn wait(self) -> Result<String, SessionError> {
        self.rx.recv().unwrap_or_else(|_| {
            Err(SessionError::InvalidRequest(
                "The session completed without a result".to_string(),
            ))
        })
    }
}

type ResultSender = mpsc::Sender<Result<String, SessionError>>;

/// Opens `url` in an `ASWebAuthenticationSession`, presented from the window containing `view`.
/// The session completes when the page navigates to a URL with `callback_scheme`, which is
/// returned to this caller only, rather than to the app's URL scheme handler.
///
/// An ephemeral session does not share cookies or other browsing data with the user's browser.
///
/// # Safety
/// `view` must point to an `NSView` that is alive for the duration of this call, such as the
/// handle from Electron's `getNativeWindowHandle()` for an open window.
pub unsafe fn start(
    view: NonNull<c_void>,
    url: &str,
    callback_scheme: &str,
    ephemeral: bool,
) -> Result<PendingSession, SessionError> {
    let invalid = |name: &str| SessionError::InvalidRequest(format!("{name} contains a NUL byte"));
    let url = CString::new(url).map_err(|_| invalid("URL"))?;
    let callback_scheme = CString::new(callback_scheme).map_err(|_| invalid("callback scheme"))?;

    let (tx, rx) = mpsc::channel();
    let context = Box::into_raw(Box::new(tx)).cast::<c_void>();
    // SAFETY: The strings are alive for this call, which copies them. The callback takes
    // ownership of `context` exactly once.
    let operation = unsafe {
        ffi::webAuthenticationSessionStart(
            view.as_ptr(),
            url.as_ptr(),
            callback_scheme.as_ptr(),
            ephemeral,
            context,
            session_complete,
        )
    };
    let operation = NonNull::new(operation)
        .ok_or_else(|| SessionError::InvalidRequest("Failed to start the session".to_string()))?;

    Ok(PendingSession {
        // SAFETY: webAuthenticationSessionCancel and webAuthenticationSessionRelease accept the
        // operation from any thread until it is released.
        canceller: OperationCanceller::new(unsafe {
            Operation::new(
                operation,
                ffi::webAuthenticationSessionCancel,
                ffi::webAuthenticationSessionRelease,
            )
        }),
        rx,
    })
}

/// Returns the domains of this app's `webcredentials:` associated domains entitlement, e.g.
/// `example.com` or `*.example.com`, possibly with a `?mode=` suffix. The system only allows the
/// platform passkey APIs for relying parties in these domains.
pub fn web_credentials_associated_domains() -> Vec<String> {
    // SAFETY: Returns a freshly allocated ObjCString whose Drop frees it.
    let domains = unsafe { ffi::webCredentialsAssociatedDomains() };
    String::try_from(domains)
        .map(|domains| {
            domains
                .lines()
                .filter(|d| !d.is_empty())
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

extern "C" fn session_complete(context: *mut c_void, result: *const ffi::SessionResult) {
    // SAFETY: `context` is the sender boxed in start, and this is called exactly once.
    let tx = unsafe { Box::from_raw(context.cast::<ResultSender>()) };
    // SAFETY: The result and everything it points to are valid during this callback.
    let result = unsafe { &*result };
    // The receiver is gone if the caller stopped waiting, so the result is not needed.
    let _ = tx.send(unsafe { result.to_rust() });
}

mod ffi {
    use super::*;

    const STATUS_SUCCESS: i32 = 0;
    const STATUS_INVALID_REQUEST: i32 = 1;

    /// Mirrors `struct WebAuthenticationSessionResult`.
    #[repr(C)]
    pub struct SessionResult {
        status: i32,
        callback_url: *const c_char,
        error_message: *const c_char,
        error_domain: *const c_char,
        error_code: i64,
    }

    impl SessionResult {
        /// # Safety
        /// Must be called during the callback that received the result.
        pub unsafe fn to_rust(&self) -> Result<String, SessionError> {
            let string = |s: *const c_char| {
                if s.is_null() {
                    String::new()
                } else {
                    unsafe { CStr::from_ptr(s) }.to_string_lossy().into_owned()
                }
            };
            match self.status {
                STATUS_SUCCESS => Ok(string(self.callback_url)),
                STATUS_INVALID_REQUEST => {
                    Err(SessionError::InvalidRequest(string(self.error_message)))
                }
                _ => Err(SessionError::Session {
                    domain: string(self.error_domain),
                    code: self.error_code,
                    message: string(self.error_message),
                }),
            }
        }
    }

    pub type SessionCallback = extern "C" fn(*mut c_void, *const SessionResult);

    unsafe extern "C" {
        pub unsafe fn webAuthenticationSessionStart(
            view: *mut c_void,
            url: *const c_char,
            callback_scheme: *const c_char,
            ephemeral: bool,
            context: *mut c_void,
            callback: SessionCallback,
        ) -> *mut c_void;
        pub unsafe fn webAuthenticationSessionCancel(operation: *mut c_void);
        pub unsafe fn webAuthenticationSessionRelease(operation: *mut c_void);
        pub unsafe fn webCredentialsAssociatedDomains() -> ObjCString;
    }
}
