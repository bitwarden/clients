use std::alloc;
use std::mem::{align_of, MaybeUninit};
use std::ptr::NonNull;
use windows::Win32::System::Com::CoTaskMemAlloc;

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
