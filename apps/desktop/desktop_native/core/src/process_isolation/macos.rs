use anyhow::{bail, Result};

pub fn disable_coredumps() -> Result<()> {
    bail!("Not implemented on Mac")
}

pub fn is_core_dumping_disabled() -> Result<bool> {
    bail!("Not implemented on Mac")
}

pub fn isolate_process() -> Result<()> {
    let pid: u32 = std::process::id();
    println!(
        "[Process Isolation] Disabling ptrace on main process ({}) via PT_DENY_ATTACH",
        pid
    );

    secmem_proc::harden_process().map_err(|e| {
        anyhow::anyhow!(
            "failed to disable memory dumping, memory may be accessible by other processes {}",
            e
        )
    })
}
