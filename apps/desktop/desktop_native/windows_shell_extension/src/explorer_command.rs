//! IExplorerCommand implementation for the "Create Send" context menu entry.
//!
//! This COM object is loaded by explorer.exe to provide a "Create Send" item
//! in the Windows 11 modern context menu. It reads the Bitwarden executable
//! path from the registry and launches it with `--send-path "<file_path>"`.

use std::ffi::c_void;

use windows::Win32::{Foundation::*, System::Com::*, UI::Shell::*};
use windows_core::*;

use crate::CLSID_BITWARDEN_SHELL_EXTENSION;

/// Registry key where the Bitwarden install path is stored.
const INSTALL_PATH_KEY: &str = r"Software\Bitwarden";
const INSTALL_PATH_VALUE: &str = "InstallPath";

/// COM object implementing IExplorerCommand for the "Create Send" entry
/// in the Windows 11 modern context menu.
#[implement(IExplorerCommand)]
pub struct CreateSendCommand;

/// COM class factory that creates BitwardenExplorerCommand instances.
#[implement(IClassFactory)]
pub struct ClassFactory;

impl IExplorerCommand_Impl for CreateSendCommand_Impl {
    fn GetTitle(&self, _psiitemarray: Option<&IShellItemArray>) -> Result<PWSTR> {
        Ok(alloc_co_task_string("Create Send"))
    }

    fn GetIcon(&self, _psiitemarray: Option<&IShellItemArray>) -> Result<PWSTR> {
        match read_install_path() {
            Ok(exe_path) => Ok(alloc_co_task_string(&format!("{exe_path},0"))),
            Err(_) => Ok(PWSTR::null()),
        }
    }

    fn GetToolTip(&self, _psiitemarray: Option<&IShellItemArray>) -> Result<PWSTR> {
        Ok(alloc_co_task_string(
            "Share encrypted files through a secure, temporary link using the Bitwarden app.",
        ))
    }

    fn GetCanonicalName(&self) -> Result<GUID> {
        Ok(CLSID_BITWARDEN_SHELL_EXTENSION)
    }

    fn GetState(
        &self,
        _psiitemarray: Option<&IShellItemArray>,
        _foktobeslow: BOOL,
    ) -> Result<EXPCMDSTATE> {
        Ok(ECS_ENABLED)
    }

    fn Invoke(
        &self,
        psiitemarray: Option<&IShellItemArray>,
        _pbc: Option<&IBindCtx>,
    ) -> Result<()> {
        let items = psiitemarray.ok_or_else(|| Error::from(E_INVALIDARG))?;
        let count = unsafe { items.GetCount()? };

        // Read the exe path from registry
        let exe_path = read_install_path().map_err(|_| Error::from(E_FAIL))?;

        // Collect all selected file/folder paths
        let mut command = std::process::Command::new(&exe_path);
        for i in 0..count {
            let item: IShellItem = unsafe { items.GetItemAt(i)? };
            let path_pwstr = unsafe { item.GetDisplayName(SIGDN_FILESYSPATH)? };
            let file_path = unsafe { path_pwstr.to_string() };
            unsafe { CoTaskMemFree(Some(path_pwstr.0 as *const c_void)) };
            let file_path = file_path.map_err(|_| Error::from(E_FAIL))?;

            command.arg("--send-path").arg(&file_path);
        }

        // Launch a single app instance with all paths
        command.spawn().map_err(|_| Error::from(E_FAIL))?;

        Ok(())
    }

    fn GetFlags(&self) -> Result<EXPCMDFLAGS> {
        Ok(ECF_DEFAULT)
    }

    fn EnumSubCommands(&self) -> Result<IEnumExplorerCommand> {
        Err(Error::from(E_NOTIMPL))
    }
}

impl IClassFactory_Impl for ClassFactory_Impl {
    fn CreateInstance(
        &self,
        outer: Ref<IUnknown>,
        iid: *const GUID,
        object: *mut *mut core::ffi::c_void,
    ) -> Result<()> {
        if !outer.is_null() {
            return Err(Error::from(HRESULT(0x80040110_u32 as i32))); // CLASS_E_NOAGGREGATION
        }
        let command: IInspectable = CreateSendCommand.into();
        unsafe { command.query(iid, object).ok() }
    }

    fn LockServer(&self, _lock: BOOL) -> Result<()> {
        Ok(())
    }
}

/// Read the Bitwarden executable path from the registry.
fn read_install_path() -> std::result::Result<String, windows_registry::Error> {
    let key = windows_registry::CURRENT_USER.open(INSTALL_PATH_KEY)?;
    key.get_string(INSTALL_PATH_VALUE)
}

/// Allocate a wide string using CoTaskMemAlloc for COM interop.
/// The caller (COM runtime) is responsible for freeing the memory with
/// CoTaskMemFree.
fn alloc_co_task_string(s: &str) -> PWSTR {
    let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
    let byte_len = wide.len() * std::mem::size_of::<u16>();
    unsafe {
        let ptr = CoTaskMemAlloc(byte_len) as *mut u16;
        if !ptr.is_null() {
            std::ptr::copy_nonoverlapping(wide.as_ptr(), ptr, wide.len());
        }
        PWSTR(ptr)
    }
}
