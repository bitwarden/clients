pub mod autofill;
pub mod autostart;
pub mod biometric;
pub mod biometric_v2;
pub mod clipboard;
pub(crate) mod crypto;
pub mod error;
pub mod ipc;
pub mod password;
pub mod powermonitor;
pub mod process_isolation;
pub(crate) mod secure_memory;
pub mod ssh_agent;

use zeroizing_alloc::ZeroAlloc;

#[global_allocator]
static ALLOC: ZeroAlloc<std::alloc::System> = ZeroAlloc(std::alloc::System);
