//! Step 1: replaces a process's DACL so the user can no longer read its memory.
//!
//! A process's default DACL grants its user `PROCESS_ALL_ACCESS`, including
//! `PROCESS_VM_READ`. `RestrictedDacl::apply` replaces it with a protected DACL that grants
//! the user only `USER_RIGHTS` (wait, terminate, basic query) and SYSTEM full access.
//! "Protected" stops ACEs inherited from a parent from being merged in.

use anyhow::Result;
use windows::Win32::{
    Security::{
        Authorization::{TRUSTEE_IS_USER, TRUSTEE_IS_WELL_KNOWN_GROUP},
        WinLocalSystemSid,
    },
    System::Threading::PROCESS_ALL_ACCESS,
};

use super::{
    super::process::Process,
    acl::{grant, replace},
    sid::Sid,
    USER_RIGHTS,
};

/// The hardened DACL: user gets `USER_RIGHTS`, SYSTEM full access, nobody else anything.
///
/// "Nobody else" relies on rights no ACE grants being denied.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/secauthz/how-dacls-control-access-to-an-object>
pub(super) struct RestrictedDacl {
    user: Sid,
    system: Sid,
}

impl RestrictedDacl {
    pub(super) fn new() -> Result<Self> {
        Ok(Self {
            user: Sid::current_user()?,
            system: Sid::well_known(WinLocalSystemSid)?,
        })
    }

    /// Replaces the DACL of `process`, which must be open with `WRITE_DAC`.
    pub(super) fn apply(&self, process: &Process) -> Result<()> {
        let entries = [
            // User: only what other processes of the user need, nothing that reads or
            // controls memory. Chromium is unaffected: it manages its children through
            // the handles CreateProcess returned, opened before this DACL existed.
            // - TERMINATE: Task Manager "End task", taskkill.
            // - SYNCHRONIZE: waiting for the process to exit, e.g. an installer.
            // - QUERY_LIMITED_INFORMATION: name, path and times in Task Manager; polling's
            //   creation time and the hardener's identity check on hardened children.
            // Dropped vs. the default full access: VM_READ/WRITE (memory dumps),
            // CREATE_THREAD and DUP_HANDLE (code injection, handle theft).
            // TRUSTEE_IS_USER: the SID is a user account.
            grant(&self.user, USER_RIGHTS, TRUSTEE_IS_USER),
            // SYSTEM: full access, as in the default DACL. OS services and security
            // software running as SYSTEM may rely on it, and withholding it protects
            // nothing: SYSTEM holds SeDebugPrivilege, which skips the DACL.
            // TRUSTEE_IS_WELL_KNOWN_GROUP: SYSTEM is a well-known SID, not an account.
            grant(
                &self.system,
                PROCESS_ALL_ACCESS,
                TRUSTEE_IS_WELL_KNOWN_GROUP,
            ),
        ];
        replace(process, &entries)
    }
}
