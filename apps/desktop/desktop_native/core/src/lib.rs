pub mod autofill;
#[cfg(feature = "sys")]
pub mod biometric;
#[cfg(feature = "sys")]
pub mod clipboard;
pub mod crypto;
pub mod error;
pub mod ipc;
#[cfg(feature = "sys")]
pub mod password;
#[cfg(feature = "sys")]
pub mod powermonitor;
#[cfg(feature = "sys")]
pub mod process_isolation;
#[cfg(feature = "sys")]
pub mod ssh_agent;
#[cfg(feature = "sys")]
pub mod ephemeral_values;

pub use zeroizing_alloc::ZeroAlloc as ZeroizingAllocator;
#[global_allocator]
static ALLOC: ZeroizingAllocator<std::alloc::System> = ZeroizingAllocator(std::alloc::System);
