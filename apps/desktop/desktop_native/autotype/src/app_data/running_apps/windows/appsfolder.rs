//! Enumerate the Windows shell **AppsFolder** — the authoritative set of registered,
//! launchable applications (Store/packaged apps, registered desktop apps, and
//! browser-installed PWAs) — into a lookup keyed by AppUserModelID (AUMID).
//!
//! This is the principled backbone for identifying a window. We resolve the AUMID against this
//! registry to obtain the app's true identity and real display name.

use std::ffi::c_void;

use windows::core::{Interface, GUID, PWSTR};
use windows::Win32::System::Com::CoTaskMemFree;
use windows::Win32::UI::Shell::{
    IEnumShellItems, IShellItem, IShellItem2, SHGetKnownFolderItem, KF_FLAG_DEFAULT,
    SIGDN_NORMALDISPLAY,
};

use super::{AppRegistration, AppRegistry};

/// `FOLDERID_AppsFolder` `{1e87508d-89c2-42f0-8a7e-645a0f50ca58}` — documented KNOWNFOLDERID
/// for the virtual "Applications" folder. Defined by hand; the crate does not reliably
/// project every KNOWNFOLDERID constant.
///
/// <https://learn.microsoft.com/en-us/windows/win32/shell/knownfolderid>
const FOLDERID_APPS_FOLDER: GUID = GUID::from_u128(0x1e87508d_89c2_42f0_8a7e_645a0f50ca58);

/// `BHID_EnumItems` `{94f60519-2850-4924-aa5a-d15e84868039}` — bind handler that yields a
/// folder's item enumerator. Defined by hand for the same reason.
///
/// <https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ishellitem-bindtohandler>
const BHID_ENUM_ITEMS: GUID = GUID::from_u128(0x94f60519_2850_4924_aa5a_d15e84868039);

/// Load the AppsFolder registry.
///
/// # Safety
/// COM initialized by caller
pub(super) fn load() -> AppRegistry {
    let mut map = AppRegistry::new();
    let _ = load_into(&mut map);
    map
}

fn load_into(map: &mut AppRegistry) -> windows::core::Result<()> {
    // SAFETY: COM is initialized by the caller; every call operates on shell objects obtained
    // here, and `buf`/`fetched` outlive the enumeration.
    unsafe {
        let folder: IShellItem =
            SHGetKnownFolderItem(&FOLDERID_APPS_FOLDER, KF_FLAG_DEFAULT, None)?;
        let items: IEnumShellItems = folder.BindToHandler(None, &BHID_ENUM_ITEMS)?;

        let mut buf: [Option<IShellItem>; 1] = [None];
        let mut fetched: u32 = 0;
        loop {
            items.Next(&mut buf, Some(&mut fetched))?;
            if fetched == 0 {
                break;
            }
            if let Some(item) = buf[0].take() {
                if let Some((aumid, name)) = read_entry(&item) {
                    map.entry(aumid.to_ascii_lowercase())
                        .or_insert(AppRegistration { display_name: name });
                }
            }
        }
        Ok(())
    }
}

/// Read an item's AUMID (the identity key) and display name. Skips items without an AUMID; the
/// display name is `None` when the shell reports none or an empty string (`pwstr_into_string`
/// already maps empty to `None`), so an empty name never masquerades as a real one downstream.
fn read_entry(item: &IShellItem) -> Option<(String, Option<String>)> {
    let item2: IShellItem2 = item.cast().ok()?;
    // SAFETY: `item`/`item2` are valid; each shell `Get*` returns a caller-owned PWSTR that
    // `pwstr_into_string` frees.
    unsafe {
        let aumid = pwstr_into_string(item2.GetString(&super::PKEY_APP_USER_MODEL_ID).ok()?)?;
        let name = item
            .GetDisplayName(SIGDN_NORMALDISPLAY)
            .ok()
            .and_then(|p| pwstr_into_string(p));
        Some((aumid, name))
    }
}

/// Convert a shell-allocated `PWSTR` to an owned `String` and free it with `CoTaskMemFree`
/// (shell `Get*` methods allocate the buffer for the caller to release).
///
/// # Safety
///
/// `p` must be null or a valid, NUL-terminated wide string allocated by the shell such that it
/// is sound to release with `CoTaskMemFree` (i.e. the return of a shell `Get*` call).
unsafe fn pwstr_into_string(p: PWSTR) -> Option<String> {
    if p.is_null() {
        return None;
    }
    let s = p.to_string().ok();
    CoTaskMemFree(Some(p.0 as *const c_void));
    s.filter(|s| !s.is_empty())
}
