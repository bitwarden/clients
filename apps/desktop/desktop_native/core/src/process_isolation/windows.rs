use anyhow::{bail, Result};
use tracing::info;

pub fn disable_coredumps() -> Result<()> {
    bail!("Not implemented on Windows")
}

pub fn is_core_dumping_disabled() -> Result<bool> {
    bail!("Not implemented on Windows")
}

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
