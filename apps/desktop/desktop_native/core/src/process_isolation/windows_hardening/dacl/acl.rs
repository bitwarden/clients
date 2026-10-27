//! ACL primitives the hardening steps build on: build an entry, replace a DACL, add to one.
//!
//! A DACL (discretionary access control list) is the ordered list of ACEs in an object's
//! security descriptor. When a process opens the object, Windows walks the ACEs that match
//! the caller's SIDs until every requested right is granted or denied:
//!
//! - No DACL (NULL): everyone gets full access.
//! - Empty DACL: nobody gets access (except the owner's implicit rights, see `ace`).
//! - Any right no ACE grants is denied.

use std::marker::PhantomData;

use anyhow::{bail, Result};
use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{LocalFree, ERROR_SUCCESS, HLOCAL},
        Security::{
            Authorization::{
                GetSecurityInfo, SetEntriesInAclW, SetSecurityInfo, EXPLICIT_ACCESS_W,
                GRANT_ACCESS, SE_KERNEL_OBJECT, TRUSTEE_IS_SID, TRUSTEE_TYPE, TRUSTEE_W,
            },
            ACL, DACL_SECURITY_INFORMATION, NO_INHERITANCE, PROTECTED_DACL_SECURITY_INFORMATION,
            PSECURITY_DESCRIPTOR,
        },
        System::Threading::PROCESS_ACCESS_RIGHTS,
    },
};

use super::{super::process::Process, sid::Sid};

/// One allow entry for a DACL. Borrows its SID, so the raw SID pointer inside can't
/// outlive it.
pub(super) struct Grant<'a> {
    entry: EXPLICIT_ACCESS_W,
    _sid: PhantomData<&'a Sid>,
}

/// Replaces the DACL of `process` with one holding only `grants`. `process` must be open
/// with `WRITE_DAC`.
pub(super) fn replace(process: &Process, grants: &[Grant<'_>]) -> Result<()> {
    set(process, grants, None)
}

/// Adds `grants` to the current DACL of `process`, which must be open with
/// `READ_CONTROL | WRITE_DAC`.
pub(super) fn add(process: &Process, grants: &[Grant<'_>]) -> Result<()> {
    let mut current: *mut ACL = std::ptr::null_mut();
    let mut sd = PSECURITY_DESCRIPTOR::default();
    // SAFETY: `current` and `sd` are valid out pointers; `current` points into `sd`,
    // which is freed below after its last use. Missing READ_CONTROL only makes the
    // call fail.
    // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getsecurityinfo
    let err = unsafe {
        GetSecurityInfo(
            process.handle(),
            SE_KERNEL_OBJECT,
            DACL_SECURITY_INFORMATION,
            None,
            None,
            Some(&mut current),
            None,
            Some(&mut sd),
        )
    };
    if err != ERROR_SUCCESS {
        bail!("GetSecurityInfo failed: {err:?}");
    }

    let result = set(process, grants, Some(current));
    // SAFETY: `sd` was allocated by GetSecurityInfo with LocalAlloc and is no longer
    // used; `current` pointed into it and is dead too.
    // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-getsecurityinfo (free with LocalFree)
    unsafe { LocalFree(Some(HLOCAL(sd.0))) };
    result
}

/// Allow entry granting `rights` to `sid`.
/// Ref: <https://learn.microsoft.com/en-us/windows/win32/api/accctrl/ns-accctrl-explicit_access_w>
pub(super) fn grant(sid: &Sid, rights: PROCESS_ACCESS_RIGHTS, kind: TRUSTEE_TYPE) -> Grant<'_> {
    Grant {
        entry: EXPLICIT_ACCESS_W {
            grfAccessPermissions: rights.0,
            grfAccessMode: GRANT_ACCESS,
            grfInheritance: NO_INHERITANCE,
            Trustee: TRUSTEE_W {
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: kind,
                ptstrName: PWSTR(sid.as_ptr().cast_mut().cast()),
                ..Default::default()
            },
        },
        _sid: PhantomData,
    }
}

/// Merges `grants` into `base` (or an empty ACL) and sets it as the protected DACL of
/// `process`, which must be open with `WRITE_DAC`.
fn set(process: &Process, grants: &[Grant<'_>], base: Option<*const ACL>) -> Result<()> {
    let entries: Vec<EXPLICIT_ACCESS_W> = grants.iter().map(|grant| grant.entry).collect();
    let mut acl: *mut ACL = std::ptr::null_mut();
    // SAFETY: `entries` point to SIDs that `grants` borrow, so they outlive this call;
    // `base` is a valid ACL or None, and `acl` is a valid out pointer.
    // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setentriesinaclw
    let err = unsafe { SetEntriesInAclW(Some(&entries), base, &mut acl) };
    if err != ERROR_SUCCESS {
        bail!("SetEntriesInAclW failed: {err:?}");
    }

    let info = DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION;
    // SAFETY: `acl` is the valid ACL built above and lives until the LocalFree below.
    // Missing WRITE_DAC only makes the call fail.
    // PROTECTED_DACL_SECURITY_INFORMATION stops inherited ACEs from being merged in.
    // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setsecurityinfo
    let err = unsafe {
        SetSecurityInfo(
            process.handle(),
            SE_KERNEL_OBJECT,
            info,
            None,
            None,
            Some(acl),
            None,
        )
    };
    // SAFETY: `acl` was allocated by SetEntriesInAclW with LocalAlloc; Windows copies
    // the DACL into the object, so it is unused after SetSecurityInfo.
    // Ref: https://learn.microsoft.com/en-us/windows/win32/api/aclapi/nf-aclapi-setentriesinaclw (free with LocalFree)
    unsafe { LocalFree(Some(HLOCAL(acl.cast()))) };
    if err != ERROR_SUCCESS {
        bail!("SetSecurityInfo failed: {err:?}");
    }

    Ok(())
}
