//! A cancellable operation started in Objective-C.

use std::{ffi::c_void, ptr::NonNull, sync::Arc};

/// An Objective-C operation, released when dropped.
pub(crate) struct Operation {
    ptr: NonNull<c_void>,
    cancel: unsafe extern "C" fn(*mut c_void),
    release: unsafe extern "C" fn(*mut c_void),
}

// SAFETY: The Objective-C operations may be cancelled and released from any thread.
unsafe impl Send for Operation {}
unsafe impl Sync for Operation {}

impl Operation {
    /// # Safety
    /// `ptr` must be an operation that `cancel` accepts until it is released with `release`, which
    /// takes ownership of it. Both must be callable from any thread.
    pub(crate) unsafe fn new(
        ptr: NonNull<c_void>,
        cancel: unsafe extern "C" fn(*mut c_void),
        release: unsafe extern "C" fn(*mut c_void),
    ) -> Self {
        Self {
            ptr,
            cancel,
            release,
        }
    }
}

impl Drop for Operation {
    fn drop(&mut self) {
        // SAFETY: The operation is released only once, as required by `new`.
        unsafe { (self.release)(self.ptr.as_ptr()) };
    }
}

/// Cancels an operation from any thread.
#[derive(Clone)]
pub struct OperationCanceller(Arc<Operation>);

impl OperationCanceller {
    pub(crate) fn new(operation: Operation) -> Self {
        Self(Arc::new(operation))
    }

    /// Closes the operation's UI, if it is still open. The operation fails with a cancellation
    /// error.
    pub fn cancel(&self) {
        // SAFETY: The operation is valid until it is released in Operation's Drop.
        unsafe { (self.0.cancel)(self.0.ptr.as_ptr()) };
    }
}
