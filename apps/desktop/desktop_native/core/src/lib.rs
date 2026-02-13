//! Desktop native core functionality for Bitwarden.
//!
//! Provides native platform integrations including biometric authentication,
//! clipboard management, SSH agent functionality, and secure storage.

#![warn(missing_docs)]

#[allow(missing_docs)]
pub mod autofill;
#[allow(missing_docs)]
pub mod autostart;
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
#[allow(missing_docs)]
pub mod ssh_agent;

use zeroizing_alloc::ZeroAlloc;

#[global_allocator]
static ALLOC: ZeroAlloc<std::alloc::System> = ZeroAlloc(std::alloc::System);
