pub mod autofill;
pub mod autostart;
pub mod biometric;
pub mod clipboard;
pub mod crypto;
pub mod error;
pub mod ipc;
pub mod password;
pub mod powermonitor;
pub mod process_isolation;
pub mod ssh_agent;

use zeroizing_alloc::ZeroAlloc;

#[global_allocator]
static ALLOC: ZeroAlloc<std::alloc::System> = ZeroAlloc(std::alloc::System);

#[cfg(test)]
mod tests {
    use swift_rs::swift;

    #[test]
    fn swift() {
        swift!(fn hello_world());
        unsafe { hello_world() }
    }
}
