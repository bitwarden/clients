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
