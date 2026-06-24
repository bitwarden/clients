use std::collections::HashMap;

use anyhow::{bail, Result};

pub fn create_key(_key: &str, _subkey: &str, _value: &str) -> Result<()> {
    bail!("Not implemented")
}

pub fn delete_key(_key: &str, _subkey: &str) -> Result<()> {
    bail!("Not implemented")
}

pub fn read_values(_key: &str, _subkey: &str) -> Result<HashMap<String, String>> {
    Ok(HashMap::new())
}
