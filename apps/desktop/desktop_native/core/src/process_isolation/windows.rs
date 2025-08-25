use anyhow::{bail, Result};

pub fn disable_coredumps() -> Result<()> {
    bail!("Not implemented on Windows")
}

pub fn is_core_dumping_disabled() -> Result<bool> {
    bail!("Not implemented on Windows")
}

pub fn disable_memory_access() -> Result<()> {
    let pid: u32 = std::process::id();
    println!("Isolating Process {}", pid);
    if let Err(e) = secmem_proc::harden_process() {
        println!("ERROR: could not harden process, exiting");
        println!("ERROR: {}", e);
        return Ok(());
    }
    return Ok(());
}
