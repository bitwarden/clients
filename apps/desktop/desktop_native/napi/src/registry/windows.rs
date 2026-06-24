use std::collections::HashMap;

use anyhow::{bail, Result};

fn convert_key(key: &str) -> Result<&'static windows_registry::Key> {
    Ok(match key.to_uppercase().as_str() {
        "HKEY_CURRENT_USER" | "HKCU" => windows_registry::CURRENT_USER,
        "HKEY_LOCAL_MACHINE" | "HKLM" => windows_registry::LOCAL_MACHINE,
        "HKEY_CLASSES_ROOT" | "HKCR" => windows_registry::CLASSES_ROOT,
        _ => bail!("Invalid key"),
    })
}

pub fn create_key(key: &str, subkey: &str, value: &str) -> Result<()> {
    let key = convert_key(key)?;

    let subkey = key.create(subkey)?;

    const DEFAULT: &str = "";
    subkey.set_string(DEFAULT, value)?;

    Ok(())
}

pub fn delete_key(key: &str, subkey: &str) -> Result<()> {
    let key = convert_key(key)?;

    key.remove_tree(subkey)?;

    Ok(())
}

pub fn read_values(key: &str, subkey: &str) -> Result<HashMap<String, String>> {
    let root = convert_key(key)?;
    let opened = match root.open(subkey) {
        Ok(k) => k,
        // An absent policy key is the normal "no managed settings" case, not an error.
        Err(_) => return Ok(HashMap::new()),
    };

    let mut out = HashMap::new();
    for (name, value) in opened.values()? {
        // Only string values are part of the managed profile; ignore other types.
        if let Ok(s) = String::try_from(value) {
            out.insert(name, s);
        }
    }
    Ok(out)
}
