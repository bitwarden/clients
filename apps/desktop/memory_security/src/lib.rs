//! This library compiles to a pre-loadable shared object. When preloaded, it
//! immediately isolates the process using the methods available on the platform.
//! On Linux, this is PR_SET_DUMPABLE to prevent debuggers from attaching, the env
//! from being read and the memory from being stolen.

use std::ffi::{c_char, c_void};

mod isolate;

#[link(name = "dl")]
unsafe extern "C" {
    unsafe fn dlsym(handle: *const c_void, symbol: *const c_char) -> *const c_void;
}

/// Hooks unsetenv to fix a bug in zypak-wrapper.
/// Zypak unsets the env in Flatpak as a side-effect, which means that only the top level
/// processes would be hooked. With this work-around all processes in the tree are hooked
#[unsafe(no_mangle)]
unsafe extern "C" fn unsetenv(name: *const c_char) -> i32 {
    unsafe {
        let name_str = std::ffi::CStr::from_ptr(name).to_str().unwrap();
        let original_unsetenv: unsafe extern "C" fn(*const c_char) -> i32 =
            std::mem::transmute(dlsym(libc::RTLD_NEXT, c"unsetenv".as_ptr()));

        if name_str == "LD_PRELOAD" {
            // This env variable is provided by the flatpak configuration
            let ld_preload = std::env::var("MEMORY_SECURITY_LD_PRELOAD").unwrap_or_default();
            std::env::set_var("LD_PRELOAD", ld_preload);
            return 0;
        }

        original_unsetenv(name)
    }
}

// Hooks the shared object being loaded into the process
#[ctor::ctor]
fn preload_init() {
    let pid = unsafe { libc::getpid() };
    unsafe {
        println!("[memory-security] Enabling memory security for process {pid}");
        isolate::isolate_process();
        isolate::disable_coredumps();
    }
}
