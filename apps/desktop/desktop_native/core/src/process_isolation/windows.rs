use anyhow::{bail, Result};
use tracing::info;

#[allow(missing_docs)]
pub fn disable_coredumps() -> Result<()> {
    bail!("Not implemented on Windows")
}

#[allow(missing_docs)]
pub fn is_core_dumping_disabled() -> Result<bool> {
    bail!("Not implemented on Windows")
}

/// Prevents other processes from accessing this process's memory by hardening the
/// process using DACL (Discretionary Access Control List).
pub fn isolate_process() -> Result<()> {
    let pid: u32 = std::process::id();
    info!(pid, "Isolating main process via DACL.");

    secmem_proc::harden_process().map_err(|e| {
        anyhow::anyhow!(
            "failed to isolate process, memory may be accessible by other processes {}",
            e
        )
    })
}
