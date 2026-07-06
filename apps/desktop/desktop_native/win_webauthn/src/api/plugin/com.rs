//! Functions for the plugin authenticator to interact with Windows COM.
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::{
    alloc,
    mem::{size_of, ManuallyDrop, MaybeUninit},
    ops::DerefMut,
    ptr::{self, NonNull},
    sync::{Arc, Mutex, OnceLock},
};

use windows::{
    core::{implement, interface, ComObjectInterface, IUnknown, GUID, HRESULT},
    Win32::{
        Foundation::{E_FAIL, E_INVALIDARG, S_FALSE, S_OK},
        System::{
            Com::{CoTaskMemAlloc, CoTaskMemFree, *},
            Threading::GetCurrentThreadId,
        },
    },
};
use windows_core::{IInspectable, Interface};

use super::{
    crypto::OwnedRequestHash, get_operation_signing_public_key, OperationRequest,
    OperationResponse, PluginAuthenticator, PluginLockStatus,
};
use crate::{
    api::{
        plugin::{crypto::RequestHash, get_request_hash, SignedRequest},
        sys::plugin::{
            WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST, WEBAUTHN_PLUGIN_OPERATION_REQUEST,
            WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
        },
    },
    plugin::{
        Clsid, PluginCancelOperationRequest, PluginGetAssertionRequest, PluginMakeCredentialRequest,
    },
    ErrorKind, WinWebAuthnError,
};

#[repr(transparent)]
pub(super) struct ComBuffer(NonNull<MaybeUninit<u8>>);

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
            let layout = alloc::Layout::from_size_align(size, align_of::<u8>())
                .expect("size of u8 to always be aligned");
            alloc::handle_alloc_error(layout)
        });

        if for_slice {
            // Initialize the buffer so it can later be treated as `&mut [u8]`.
            // SAFETY: The pointer is valid and we are using a valid value for a byte-wise
            // allocation.
            unsafe { ptr.write_bytes(0, size) };
        }

        Self(ptr.cast())
    }

    pub(crate) fn as_ptr<T>(&self) -> *const T {
        self.0.cast().as_ptr()
    }

    pub(crate) fn as_mut_ptr<T>(&self) -> *mut T {
        self.0.cast().as_ptr()
    }

    pub fn into_raw<T>(self) -> *mut T {
        let this = ManuallyDrop::new(self);
        this.0.cast().as_ptr()
    }
}

impl Drop for ComBuffer {
    fn drop(&mut self) {
        let ptr = self.0.cast().as_ptr();
        unsafe {
            CoTaskMemFree(Some(ptr));
        }
    }
}

pub(super) trait ComBufferExt {
    fn to_com_buffer(&self) -> ComBuffer;
}

impl ComBufferExt for Vec<u8> {
    fn to_com_buffer(&self) -> ComBuffer {
        ComBuffer::from(&self)
    }
}

impl ComBufferExt for &[u8] {
    fn to_com_buffer(&self) -> ComBuffer {
        ComBuffer::from(self)
    }
}

impl ComBufferExt for Vec<u16> {
    fn to_com_buffer(&self) -> ComBuffer {
        self.as_slice().to_com_buffer()
    }
}

impl ComBufferExt for &[u16] {
    fn to_com_buffer(&self) -> ComBuffer {
        let byte_len = std::mem::size_of_val(*self);
        let com_buffer = ComBuffer::alloc(byte_len, false);
        // SAFETY: com_buffer.0 points to a valid COM allocation of byte_len bytes.
        // We write every byte before the buffer is read.
        unsafe {
            let dst: *mut u8 = com_buffer.0.cast().as_ptr();
            for (i, &word) in self.iter().enumerate() {
                dst.add(i * size_of::<u16>())
                    .copy_from_nonoverlapping(word.to_le_bytes().as_ptr(), size_of::<u16>());
            }
        }
        com_buffer
    }
}

impl<T: AsRef<[u8]>> From<T> for ComBuffer {
    fn from(value: T) -> Self {
        let slice = value.as_ref();
        let len = slice.len();
        let com_buffer = Self::alloc(len, true);
        // SAFETY: `ptr` points to a valid allocation that `len` matches, and we made sure
        // the bytes were initialized. Additionally, bytes have no alignment requirements.
        unsafe {
            NonNull::slice_from_raw_parts(com_buffer.0.cast::<u8>(), len)
                .as_mut()
                .copy_from_slice(slice);
        }
        com_buffer
    }
}

struct ComThreadState {
    clsid: GUID,
    handler: Arc<dyn PluginAuthenticator + Send + Sync + 'static>,
    in_flight_request: Arc<Mutex<Option<RequestContext>>>,
}

static HANDLER: OnceLock<ComThreadState> = OnceLock::new();

#[implement(IClassFactory)]
pub struct Factory;

impl IClassFactory_Impl for Factory_Impl {
    fn CreateInstance(
        &self,
        _outer: windows::core::Ref<IUnknown>,
        iid: *const windows::core::GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> windows::core::Result<()> {
        let thread_id = unsafe { GetCurrentThreadId() };
        let (clsid, handler, in_flight_request) = match HANDLER.get().map(|s| {
            (
                s.clsid,
                Arc::clone(&s.handler),
                Arc::clone(&s.in_flight_request),
            )
        }) {
            Some(fields) => fields,
            None => {
                tracing::error!(%thread_id, "Cannot create COM class object instance because the handler is not initialized. register_server() must be called before starting the COM server.");
                return Err(E_FAIL.into());
            }
        };
        let unknown: IInspectable = PluginAuthenticatorComObject {
            clsid,
            handler,
            in_flight_request,
        }
        .into();
        unsafe { unknown.query(iid, object).ok() }
    }

    fn LockServer(&self, _lock: windows::core::BOOL) -> windows::core::Result<()> {
        // TODO: Implement lock server
        Ok(())
    }
}

// IPluginAuthenticator interface
#[interface("d26bcf6f-b54c-43ff-9f06-d5bf148625f7")]
pub unsafe trait IPluginAuthenticator: windows::core::IUnknown {
    fn MakeCredential(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT;
    fn GetAssertion(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT;
    fn CancelOperation(&self, request: *const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST) -> HRESULT;
    fn GetLockStatus(&self, lock_status: *mut PluginLockStatus) -> HRESULT;
}

#[implement(IPluginAuthenticator)]
struct PluginAuthenticatorComObject {
    clsid: GUID,
    handler: Arc<dyn PluginAuthenticator + Send + Sync + 'static>,
    in_flight_request: Arc<Mutex<Option<RequestContext>>>,
}

impl PluginAuthenticatorComObject {
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest<'_>,
    ) -> windows::core::Result<()> {
        let transaction_id = request.transaction_id;
        let response = self.handler.make_credential(request);

        // log response errors before any early returns.
        if let Err(err) = &response {
            tracing::error!(%err, "MakeCredential failed");
        }

        // clean up the request regardless of response.
        self.complete_request(transaction_id, response.as_deref().ok())
            .map_err(|err| {
                tracing::error!(%err, "Failed to complete request");
                windows::core::Error::from_hresult(E_FAIL)
            })?;

        match response {
            Ok(_) => {
                tracing::debug!("MakeCredential completed successfully");
                Ok(())
            }
            Err(_) => Err(E_FAIL.into()),
        }
    }

    fn get_assertion(&self, request: PluginGetAssertionRequest<'_>) -> windows::core::Result<()> {
        let transaction_id = request.transaction_id;
        let response = self.handler.get_assertion(request);

        // log response errors before any early returns.
        if let Err(err) = &response {
            tracing::error!(%err, "GetAssertion failed");
        }

        // clean up the request regardless of response.
        self.complete_request(transaction_id, response.as_deref().ok())
            .map_err(|err| {
                tracing::error!(%err, "Failed to complete request");
                windows::core::Error::from_hresult(E_FAIL)
            })?;

        match response {
            Ok(_) => {
                tracing::debug!("GetAssertion completed successfully");
                Ok(())
            }
            Err(_) => Err(E_FAIL.into()),
        }
    }

    fn cancel_operation(
        &self,
        ctx: &mut Option<RequestContext>,
        request: PluginCancelOperationRequest,
    ) -> windows::core::Result<()> {
        match ctx.as_ref() {
            Some(ctx) => {
                let incoming_id = request.transaction_id();
                if ctx.transaction_id != incoming_id {
                    tracing::warn!(
                        "Attempting to cancel operation with mismatched transaction ID. Expected {:?}, received {:?}",
                        ctx.transaction_id,
                        incoming_id
                    );
                    return Err(E_FAIL.into());
                }
            }
            None => {
                tracing::warn!(
                    "Received a request to cancel an operation, but no context was found"
                );
                return Err(E_FAIL.into());
            }
        }

        // Clean up request context here; regardless of whether the handler
        // succeeds or fails, we're ready for the next request.
        _ = ctx.take();

        // Pass to handler
        self.handler.cancel_operation(request).map_err(|err| {
            tracing::error!("CancelOperation failed: {err}");
            E_FAIL
        })?;

        tracing::debug!("CancelOperation completed successfully");
        Ok(())
    }

    /// Validates the incoming request and stores the context for completing the request with
    /// [Self::complete_request].
    ///
    /// - Checks that the request struct and response buffer is non-null.
    /// - Verifies the signature request.
    /// - Stores the response buffer.
    ///
    /// Returns the parsed request for processing.
    ///
    /// # Safety
    /// The caller must ensure that the request:
    /// - `request.pbEncodedRequest` points to a valid non-null byte string of length
    ///   `request.cbEncodedRequest`.
    /// - `request.pbRequestSignature` points to a valid non-null byte string of length
    ///   `request.cbRequestSignature`.
    unsafe fn initialize_request<'a, T: OperationRequest<'a>>(
        &self,
        request_ptr: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response_ptr: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> Result<T, WinWebAuthnError> {
        // Check that the request and response buffers are valid
        let response = {
            if !response_ptr.is_aligned() {
                return Err(WinWebAuthnError::new(
                    ErrorKind::WindowsInternal,
                    "Method called with unaligned response pointer from Windows. Aborting request.",
                ));
            }
            let ptr = NonNull::new(response_ptr).ok_or(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Method called with null response pointer from Windows. Aborting request.",
            ))?;
            // SAFETY: we checked that the pointer is aligned. We need to trust
            // that the pointers to the buffers are valid.
            unsafe { OperationResponse::new(ptr)? }
        };

        if !request_ptr.is_aligned() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Method called with unaligned request pointer from Windows. Aborting request.",
            ));
        }
        let request = request_ptr.as_ref().ok_or(WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "Method called with null request pointer from Windows. Aborting request.",
        ))?;

        // SAFETY: WEBAUTHN_PLUGIN_OPERATION_REQUEST::request_hash() has the same safety
        // requirements as this function: the encoded request must be valid.
        let request_hash = unsafe { get_request_hash(request)? };
        self.verify_request_signature(&request, (&request_hash).into())?;

        // SAFETY: We verified the request came from the operating system, so
        // trust that it is well-formed.
        let request: T =
            unsafe { OperationRequest::try_from_operation_request(request, request_hash.clone())? };

        // Store the response buffer to complete later.
        // Windows sends WebAuthn requests serially, so we just replace the
        // request context without checking.
        // The request context will be used for completing or cancelling the request.
        let ctx = RequestContext {
            transaction_id: request.transaction_id(),
            request_hash,
            response_buffer: response,
        };
        let mut guard = self.in_flight_request.lock().expect("not poisoned");
        if guard.is_some() {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                "Received a new request while another was in-flight",
            ));
        }
        *guard = Some(ctx);

        let transaction_id = request.transaction_id();
        tracing::debug!(?transaction_id, "Successfully initialized request");

        Ok(request)
    }

    /// Reads a pointer as a cancel operation request and verifies its signature
    /// as coming from the OS.
    ///
    /// # Safety: The `request_ptr` must be convertible to a reference.
    unsafe fn initialize_cancel_request<'a>(
        &self,
        ctx: Option<&RequestContext>,
        request_ptr: *const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> Result<PluginCancelOperationRequest<'a>, WinWebAuthnError> {
        if !request_ptr.is_aligned() {
            return Err(WinWebAuthnError::new(
                ErrorKind::InvalidArguments,
                "cancel request pointer is unaligned",
            ));
        }

        let request = unsafe { request_ptr.as_ref() }.ok_or(WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "CancelOperation called with null request pointer from Windows. Aborting request.",
        ))?;

        let ctx = ctx.ok_or(WinWebAuthnError::new(
            ErrorKind::WindowsInternal,
            "No in-flight request found to cancel.",
        ))?;

        let request_hash = ctx.request_hash.clone();

        self.verify_request_signature(&request, (&request_hash).into())?;

        Ok(PluginCancelOperationRequest::from_ref(
            request,
            request_hash,
        ))
    }

    /// Verifies a request signature.
    fn verify_request_signature<T: SignedRequest>(
        &self,
        request: &T,
        request_hash: RequestHash<'_>,
    ) -> Result<(), WinWebAuthnError> {
        // SAFETY: We're about to verify the signature, which will implicitly validate the length.
        let signature = unsafe { request.get_request_signature()? };
        tracing::debug!("Retrieving signing key");
        let op_pub_key = get_operation_signing_public_key(&self.clsid).map_err(|err| {
            WinWebAuthnError::with_cause(
                ErrorKind::WindowsInternal,
                "Failed to get signing key for operation",
                err,
            )
        })?;
        tracing::debug!("Verifying signature");
        op_pub_key.verify_signature(request_hash, signature)?;
        Ok(())
    }
    fn complete_request(
        &self,
        request_transaction_id: GUID,
        data: Option<&[u8]>,
    ) -> Result<(), WinWebAuthnError> {
        let mut ctx = self
            .in_flight_request
            .lock()
            .expect("not poisoned")
            .take()
            .ok_or(WinWebAuthnError::new(
                ErrorKind::Other,
                "Attempted to complete request, but no response buffer was found",
            ))?;
        // Verify that we're talking about the same request.
        // If this is not true, then this is an internal library error.
        if request_transaction_id != ctx.transaction_id {
            return Err(WinWebAuthnError::new(
                ErrorKind::WindowsInternal,
                &format!("Request transaction ID {:?} does not match the transaction ID for the response {:?}.", request_transaction_id, ctx.transaction_id),
            ));
        }

        if let Some(data) = data {
            ctx.response_buffer.write(data)?
        };
        Ok(())
    }
}

pub(super) struct RequestContext {
    transaction_id: GUID,
    request_hash: OwnedRequestHash,
    response_buffer: OperationResponse,
}

impl IPluginAuthenticator_Impl for PluginAuthenticatorComObject_Impl {
    unsafe fn MakeCredential(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        tracing::debug!("MakeCredential called");

        // We cannot guarantee that this is safe; we have to trust the request
        // and response structs and inner buffers are valid.
        let init_result = unsafe { self.initialize_request(request, response) };

        let request: PluginMakeCredentialRequest<'_> = match init_result {
            Ok(request) => request,
            Err(err) => {
                tracing::error!(%err, "Invalid request passed to MakeCredential");
                return E_INVALIDARG;
            }
        };

        let result = self.make_credential(request);
        result.into()
    }

    unsafe fn GetAssertion(
        &self,
        request: *const WEBAUTHN_PLUGIN_OPERATION_REQUEST,
        response: *mut WEBAUTHN_PLUGIN_OPERATION_RESPONSE,
    ) -> HRESULT {
        tracing::debug!("GetAssertion called");

        // We cannot guarantee that this is safe; we have to trust the request
        // and response structs and inner buffers are valid.
        let init_result = unsafe { self.initialize_request(request, response) };

        let request: PluginGetAssertionRequest = match init_result {
            Ok(request) => request,
            Err(err) => {
                tracing::error!(%err, "Invalid request passed to GetAssertion");
                return E_INVALIDARG;
            }
        };

        let result = self.get_assertion(request);
        result.into()
    }

    unsafe fn CancelOperation(
        &self,
        request_ptr: *const WEBAUTHN_PLUGIN_CANCEL_OPERATION_REQUEST,
    ) -> HRESULT {
        tracing::debug!("CancelOperation called");
        let mut ctx = self.in_flight_request.lock().expect("not poisoned");
        // SAFETY: We assume that the request from the OS is convertible to a
        // reference. The method will verify that the request comes from the OS.
        let init_result = unsafe { self.initialize_cancel_request(ctx.as_ref(), request_ptr) };
        let request = match init_result {
            Ok(request) => request,
            Err(err) => {
                tracing::error!(%err, "Invalid request passed to CancelOperation");
                return E_INVALIDARG;
            }
        };

        let result = self.cancel_operation(ctx.deref_mut(), request);
        result.into()
    }

    unsafe fn GetLockStatus(&self, lock_status: *mut PluginLockStatus) -> HRESULT {
        tracing::debug!(
            "GetLockStatus() called <PID {}, Thread {:?}>",
            std::process::id(),
            std::thread::current().id()
        );
        if lock_status.is_null() {
            return E_INVALIDARG;
        }

        match self.handler.lock_status() {
            Ok(status) => {
                tracing::debug!("GetLockStatus received {status:?}");
                *lock_status = status;
                S_OK
            }
            Err(err) => {
                tracing::error!("GetLockStatus failed: {err}");
                E_FAIL
            }
        }
    }
}

/// Registers the plugin authenticator COM library with Windows.
pub(crate) fn register_server<T>(clsid: Clsid, handler: T) -> Result<u32, windows::core::Error>
where
    T: PluginAuthenticator + Send + Sync + 'static,
{
    let com_thread_id = unsafe { GetCurrentThreadId() };
    let span = tracing::info_span!("plugin_com_thread_register", thread_id = com_thread_id);
    let _span_guard = span.enter();
    tracing::debug!(thread_id = com_thread_id, "Initializing COM server");
    if HANDLER.get().is_some() {
        return Err(windows::core::Error::new(
            E_FAIL,
            "server can only be registered one time per process",
        ));
    }
    unsafe {
        // Initialize COM on this thread.
        let com_init_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        match com_init_result {
            // COM successfully initialized, and should be uninitialized with CoUninitialize later.
            S_OK | S_FALSE => {}
            code => {
                return Err(windows::core::Error::new(
                    code,
                    "Could not initialize the COM library",
                ));
            }
        }
        tracing::debug!("CoInitializeEx successful");

        // If this call fails, some library in this process may have already set
        // it. We will ignore any failures.
        if let Err(err) = CoInitializeSecurity(
            None,
            -1,
            None,
            None,
            RPC_C_AUTHN_LEVEL_DEFAULT,
            RPC_C_IMP_LEVEL_IMPERSONATE,
            None,
            EOAC_NONE,
            None,
        ) {
            tracing::warn!("Could not initialize COM security: {err}",);
        };
    }

    HANDLER
        .set(ComThreadState {
            clsid: clsid.0,
            handler: Arc::new(handler),
            in_flight_request: Arc::new(Mutex::new(None)),
        })
        .map_err(|_| {
            windows::core::Error::new(E_FAIL, "server can only be registered one time per process")
        })?;
    tracing::debug!("ComThreadState initialized successfully");

    // Register the COM class object so that Windows RPC knows how to start it.
    static FACTORY: windows::core::StaticComObject<Factory> = Factory.into_static();
    unsafe {
        CoRegisterClassObject(
            ptr::from_ref(&clsid.0),
            FACTORY.as_interface_ref(),
            CLSCTX_LOCAL_SERVER,
            REGCLS_MULTIPLEUSE,
        )?
    };
    tracing::debug!("COM class object factory registered successfully");
    Ok(com_thread_id)
}

/// Uninitializes the COM library. Must be called on the COM thread after the message loop exits.
pub(crate) fn uninitialize_com() {
    unsafe { CoUninitialize() };
}
