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
#[allow(missing_docs)] // staged to be removed
pub mod biometric;
pub mod biometric_v2;
#[allow(missing_docs)]
pub mod clipboard;
pub(crate) mod crypto;
pub mod error;
pub mod ipc;
pub mod password;
#[allow(missing_docs)]
pub mod powermonitor;
pub mod process_isolation;
pub mod secure_memory;
#[allow(missing_docs)] // staged to be removed
pub mod ssh_agent;

use zeroizing_alloc::ZeroAlloc;

#[global_allocator]
static ALLOC: ZeroAlloc<std::alloc::System> = ZeroAlloc(std::alloc::System);
