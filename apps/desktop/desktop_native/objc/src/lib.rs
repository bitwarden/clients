#![cfg(target_os = "macos")]

use std::{
    ffi::{c_char, CStr, CString},
    os::raw::c_void,
};

use anyhow::{Context, Result};

#[repr(C)]
pub struct ObjCString {
    value: *const c_char,
    size: usize,
}

#[repr(C)]
pub struct CommandContext {
    tx: Option<tokio::sync::oneshot::Sender<String>>,
}

impl CommandContext {
    pub fn new() -> (Self, tokio::sync::oneshot::Receiver<String>) {
        let (tx, rx) = tokio::sync::oneshot::channel::<String>();

        (CommandContext { tx: Some(tx) }, rx)
    }

    pub fn send(&mut self, value: String) -> Result<()> {
        let tx = self.tx.take().context(
            "Failed to take Sender from CommandContext. Has this context already returned once?",
        )?;

        tx.send(value).map_err(|_| {
            anyhow::anyhow!("Failed to send ObjCString from CommandContext to Rust code")
        })?;

        Ok(())
    }

    pub fn as_ptr(&mut self) -> *mut c_void {
        self as *mut Self as *mut c_void
    }
}

impl TryFrom<ObjCString> for String {
    type Error = anyhow::Error;

    fn try_from(value: ObjCString) -> Result<Self> {
        let c_str = unsafe { CStr::from_ptr(value.value) };
        let str = c_str
            .to_str()
            .context("Failed to convert ObjC output string to &str for use in Rust")?;

        Ok(str.to_owned())
    }
}

impl Drop for ObjCString {
    fn drop(&mut self) {
        unsafe {
            objc::freeObjCString(self);
        }
    }
}

mod objc {
    use std::os::raw::c_void;

    use tracing::error;

    use super::*;

    unsafe extern "C" {
        pub unsafe fn runCommand(context: *mut c_void, value: *const c_char);
        pub unsafe fn freeObjCString(value: &ObjCString);
    }

    /// This function is called from the ObjC code to return the output of the command
    #[unsafe(no_mangle)]
    pub extern "C" fn commandReturn(context: &mut CommandContext, value: ObjCString) -> bool {
        let value: String = match value.try_into() {
            Ok(value) => value,
            Err(e) => {
                error!(
                    error = %e,
                    "Error: Failed to convert ObjCString to Rust string during commandReturn"
                );

                return false;
            }
        };

        match context.send(value) {
            Ok(_) => 0,
            Err(e) => {
                error!(
                    error = %e,
                    "Error: Failed to return ObjCString from ObjC code to Rust code");

                return false;
            }
        };

        true
    }
}

pub async fn run_command(input: String) -> Result<String> {
    // Convert input to type that can be passed to ObjC code
    let c_input = CString::new(input)
        .context("Failed to convert Rust input string to a CString for use in call to ObjC code")?;

    let (mut context, rx) = CommandContext::new();

    // Call ObjC code
    unsafe { objc::runCommand(context.as_ptr(), c_input.as_ptr()) };

    // Convert output from ObjC code to Rust string
    let objc_output = rx.await?;

    // Convert output from ObjC code to Rust string
    // let objc_output = output.try_into()?;

    Ok(objc_output)
}

/// Turns a Safari request's bytes into the response bytes. Runs synchronously on the XPC listener's
/// dispatch queue.
pub type SafariXpcHandler = Box<dyn Fn(&[u8]) -> Vec<u8> + Send + Sync>;

/// An app-group XPC listener vended to the Safari web extension.
///
/// The desktop app (when sandboxed) registers a Mach service whose name is prefixed with the shared
/// application-group identifier; the sandboxed Safari extension connects to it to send messages and
/// poll for buffered ones. The actual request handling lives in the supplied closure, which runs
/// synchronously on a private serial dispatch queue for every incoming request.
pub struct SafariXpcListener {
    /// Retained `xpc_connection_t` listener handle owned by the Objective-C side.
    handle: *mut c_void,
    /// Boxed handler context kept alive for the listener's lifetime. The Objective-C side holds a
    /// raw pointer into this box, so it must not move or drop until the listener is cancelled.
    _ctx: Box<safari_xpc::HandlerCtx>,
}

// SAFETY: `handle` is only touched on construction and drop, and the boxed handler is `Send +
// Sync`.
unsafe impl Send for SafariXpcListener {}
unsafe impl Sync for SafariXpcListener {}

impl SafariXpcListener {
    /// Start a listener on the given app-group Mach service name. The handler converts request
    /// bytes into response bytes.
    pub fn start(service_name: &str, handler: SafariXpcHandler) -> Result<Self> {
        let ctx = Box::new(safari_xpc::HandlerCtx { handler });
        let c_name = CString::new(service_name)
            .context("Failed to convert Safari XPC service name to a CString")?;

        // The ObjC side stores this pointer and calls back into it for every request; it stays
        // valid because `ctx` is moved into the returned struct and only freed after the listener
        // is cancelled in `Drop`.
        let ctx_ptr = (&*ctx as *const safari_xpc::HandlerCtx) as *mut c_void;
        let handle = unsafe { safari_xpc::bw_safari_xpc_start(c_name.as_ptr(), ctx_ptr) };
        if handle.is_null() {
            anyhow::bail!("Failed to create Safari XPC listener for service: {service_name}");
        }

        Ok(SafariXpcListener { handle, _ctx: ctx })
    }
}

impl Drop for SafariXpcListener {
    fn drop(&mut self) {
        // Cancel the listener before `_ctx` is dropped so no further callbacks can reference it.
        // Cancellation is synchronous on the serial queue.
        unsafe { safari_xpc::bw_safari_xpc_stop(self.handle) };
    }
}

mod safari_xpc {
    use std::os::raw::{c_char, c_void};

    /// Boxed request handler shared with the Objective-C listener via a raw pointer.
    pub(super) struct HandlerCtx {
        pub(super) handler: super::SafariXpcHandler,
    }

    unsafe extern "C" {
        pub(super) unsafe fn bw_safari_xpc_start(
            service_name: *const c_char,
            ctx: *mut c_void,
        ) -> *mut c_void;
        pub(super) unsafe fn bw_safari_xpc_stop(handle: *mut c_void);
    }

    /// Called from the Objective-C listener for each incoming request. Runs the stored handler and
    /// returns the response bytes through the out-params. The buffer is freed by
    /// [`bw_safari_xpc_free`] once the shim has copied it into the XPC reply.
    #[unsafe(no_mangle)]
    pub extern "C" fn bw_safari_handle_request(
        ctx: *mut c_void,
        req: *const u8,
        req_len: usize,
        out: *mut *mut u8,
        out_len: *mut usize,
    ) {
        let ctx = unsafe { &*(ctx as *const HandlerCtx) };
        let bytes: &[u8] = if req.is_null() {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(req, req_len) }
        };

        // `into_boxed_slice` guarantees capacity == length, so the round-trip in
        // `bw_safari_xpc_free` is sound.
        let response = (ctx.handler)(bytes).into_boxed_slice();
        let len = response.len();
        unsafe {
            *out = Box::into_raw(response) as *mut u8;
            *out_len = len;
        }
    }

    /// Called from the Objective-C listener to free a buffer produced by
    /// [`bw_safari_handle_request`].
    #[unsafe(no_mangle)]
    pub extern "C" fn bw_safari_xpc_free(ptr: *mut u8, len: usize) {
        if !ptr.is_null() {
            unsafe { drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len))) };
        }
    }
}
