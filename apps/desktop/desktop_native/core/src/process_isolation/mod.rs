//! This module implements process isolation, which aims to protect
//! a process from dumping memory to disk when crashing, and from
//! userspace memory access.
//!
//! On Windows, by default most userspace apps can read the memory of all
//! other apps, and attach debuggers. On Mac, this is not possible, and only
//! after granting developer permissions can an app attach to processes via
//! ptrace / read memory. On Linux, this depends on the distro / configuration of yama
//! https://linux-audit.com/protect-ptrace-processes-kernel-yama-ptrace_scope/
//! For instance, ubuntu prevents ptrace of other processes by default.
//! On Fedora, there are change proposals but ptracing is still possible unless
//! otherwise configured.

#[allow(clippy::module_inception)]
#[cfg_attr(target_os = "linux", path = "linux.rs")]
#[cfg_attr(target_os = "windows", path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
mod process_isolation;
pub use process_isolation::*;
