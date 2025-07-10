use anyhow::{bail, Result};

pub fn disable_coredumps() -> Result<()> {
    bail!("Not implemented on Windows")
}

pub fn is_core_dumping_disabled() -> Result<bool> {
    bail!("Not implemented on Windows")
}

pub fn disable_memory_access() -> Result<()> {
    bail!("Not implemented on Windows")
}
