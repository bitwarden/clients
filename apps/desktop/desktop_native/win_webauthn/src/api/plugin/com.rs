//! Functions for the plugin authenticator to interact with Windows COM.
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

use std::{
    alloc,
    mem::{size_of, ManuallyDrop, MaybeUninit},
    ptr::{self, NonNull},
    sync::{Arc, Mutex, OnceLock},
};

use windows::Win32::System::Com::{CoTaskMemAlloc, CoTaskMemFree};

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
