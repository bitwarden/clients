use anyhow::{bail, Result};
use windows::{
    core::{HSTRING, PCWSTR},
    Win32::System::Registry::{self, HKEY},
};

fn convert_key(key: &str) -> Result<HKEY> {
    Ok(match key.to_uppercase().as_str() {
        "HKEY_CURRENT_USER" | "HKCU" => Registry::HKEY_CURRENT_USER,
        "HKEY_LOCAL_MACHINE" | "HKLM" => Registry::HKEY_LOCAL_MACHINE,
        "HKEY_CLASSES_ROOT" | "HKCR" => Registry::HKEY_CLASSES_ROOT,
        _ => bail!("Invalid key"),
    })
}

pub fn create_key(key: &str, subkey: &str, value: &str) -> Result<()> {
    let key = convert_key(key)?;
    let subkey = create_subkey(key, subkey)?;
    const DEFAULT: &str = "";
    set_value(subkey, DEFAULT, value)?;

    Ok(())
}

pub fn delete_key(key: &str, subkey: &str) -> Result<()> {
    let key = convert_key(key)?;

    let hsubkey = HSTRING::from(subkey);
    let psubkey = PCWSTR(hsubkey.as_ptr());

    unsafe { Registry::RegDeleteKeyExW(key, psubkey, 0, 0).ok()? }

    Ok(())
}

fn create_subkey(hkey: HKEY, path: &str) -> Result<HKEY> {
    let mut new_hkey: HKEY = HKEY(0);

    let hpath = HSTRING::from(path);
    let ppath = PCWSTR(hpath.as_ptr());

    unsafe {
        Registry::RegCreateKeyExW(
            hkey,
            ppath,
            0,
            None,
            Registry::REG_OPTION_NON_VOLATILE,
            Registry::KEY_ALL_ACCESS,
            None,
            &mut new_hkey,
            None,
        )
        .ok()?;
    }

    Ok(new_hkey)
}

fn set_value(key: HKEY, name: &str, value: &str) -> Result<()> {
    let hname = HSTRING::from(name);
    let pname = PCWSTR(hname.as_ptr());

    let hvalue = HSTRING::from(value);
    let pvalue = PCWSTR(hvalue.as_ptr());

    unsafe {
        // PCWSTR is a zero terminated utf16 string,
        let pvalue_bytes = std::slice::from_raw_parts(
            pvalue.as_ptr() as *const u8,
            (pvalue.as_wide().len() + 1) * 2,
        );

        Registry::RegSetValueExW(key, pname, 0, Registry::REG_SZ, Some(pvalue_bytes)).ok()?;
    }

    Ok(())
}
