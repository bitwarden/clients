#[cfg(target_env = "gnu")]
use libc::c_uint;
use libc::{self, c_int};

/// RLIMIT_CORE is the maximum size of a core dump file. Setting both to 0 disables core dumps, on crashes
/// https://github.com/torvalds/linux/blob/1613e604df0cd359cf2a7fbd9be7a0bcfacfabd0/include/uapi/asm-generic/resource.h#L20
#[cfg(target_env = "musl")]
const RLIMIT_CORE: c_int = 4;
#[cfg(target_env = "gnu")]
const RLIMIT_CORE: c_uint = 4;

/// PR_SET_DUMPABLE makes it so no other running process (root or same user) can dump the memory of this process
/// or attach a debugger to it.
/// https://github.com/torvalds/linux/blob/a38297e3fb012ddfa7ce0321a7e5a8daeb1872b6/include/uapi/linux/prctl.h#L14
const PR_SET_DUMPABLE: c_int = 4;

/// Prevents a process crash from creating a coredump on disk
pub(crate) fn disable_coredumps() -> () {
    let rlimit = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };

    if unsafe { libc::setrlimit(RLIMIT_CORE, &rlimit) } != 0 {
        let e = std::io::Error::last_os_error();
        eprintln!("[Process Isolation] Failed to disable core dumping: {}", e);
    }
}

/// Prevents other process from accessing env, memory, attaching debugger
pub(crate) fn isolate_process() -> () {
    if unsafe { libc::prctl(PR_SET_DUMPABLE, 0) } != 0 {
        let e = std::io::Error::last_os_error();
        eprintln!(
            "[Process Isolation] Failed to disable memory dumping: {}",
            e
        );
    }
}
