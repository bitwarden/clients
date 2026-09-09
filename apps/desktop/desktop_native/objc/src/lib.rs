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
        pub unsafe fn appGroupId() -> ObjCString;
        pub unsafe fn appGroupContainerPath(group_id: *const c_char) -> ObjCString;
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

/// Returns the App Group identifier declared in this bundle's Info.plist, or `None`
/// when the key is absent (e.g. an unsigned dev build). The identifier is stamped per
/// build variant so a single native binary serves both production and beta.
pub fn app_group_id() -> Option<String> {
    // SAFETY: `appGroupId` returns a freshly allocated ObjCString whose Drop frees it;
    // it reads only process-global bundle state.
    let objc_string = unsafe { objc::appGroupId() };
    let id = String::try_from(objc_string).ok()?;
    (!id.is_empty()).then_some(id)
}

/// Returns the filesystem path to the shared App Group container for `group_id`, or
/// `None` when it cannot be resolved (e.g. the process is not entitled to the group).
pub fn app_group_container_path(group_id: &str) -> Option<String> {
    let c_group_id = CString::new(group_id).ok()?;
    // SAFETY: `appGroupContainerPath` borrows the C string only for the duration of the
    // call and returns a freshly allocated ObjCString whose Drop frees it.
    let objc_string = unsafe { objc::appGroupContainerPath(c_group_id.as_ptr()) };
    let path = String::try_from(objc_string).ok()?;
    (!path.is_empty()).then_some(path)
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
