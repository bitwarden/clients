//! Desktop native core functionality for Bitwarden.
//!
//! Modules in this crate should fall into one of these categories:
//!  * infrastructure to interface with the Electron client
//!  * core functionality for the Desktop app that is not feature-specific
//!  * library code that is used internally by other desktop_native crates.

#![warn(missing_docs)]

#[allow(missing_docs)]
pub mod autofill;
#[allow(missing_docs)]
pub mod autostart;
#[allow(missing_docs)]
pub mod clipboard;
pub mod error;
pub mod ipc;
pub mod password;
#[allow(missing_docs)]
pub mod powermonitor;
pub mod process_isolation;
#[allow(missing_docs)] // staged to be removed
pub mod ssh_agent;

#[cfg(not(target_os = "windows"))]
use zeroizing_alloc::ZeroAlloc;

// On windows we import bitwarden-crypto which has a global allocator.
#[cfg(not(target_os = "windows"))]
#[global_allocator]
static ALLOC: ZeroAlloc<std::alloc::System> = ZeroAlloc(std::alloc::System);
