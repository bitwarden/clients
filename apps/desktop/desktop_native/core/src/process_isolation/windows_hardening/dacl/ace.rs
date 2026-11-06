//! Step 2: adds the OWNER RIGHTS ACE to the DACL from step 1.
//!
//! Windows always grants an object's owner `READ_CONTROL | WRITE_DAC`, whatever the DACL
//! says, so an owner can never lock themselves out. A process's owner is its user, the
//! same user any malware runs as, so the DACL from step 1 alone can be undone:
//!
//! ```text
//! OpenProcess(WRITE_DAC) -> allowed (implicit owner right)
//! SetSecurityInfo(Allow me ALL_ACCESS)
//! OpenProcess(VM_READ)   -> allowed
//! ```
//!
//! If the DACL contains an ACE for the OWNER RIGHTS SID (S-1-3-4), Windows ignores the
//! implicit rights and grants the owner only what that ACE grants: here `USER_RIGHTS`,
//! without `WRITE_DAC`.
//!
//! # What an ACE is
//!
//! An ACE (access control entry) is one rule in a DACL: a type (allow or deny), a SID
//! (who it applies to), an access mask (which rights) and inheritance flags. ACEs are
//! evaluated in order; explicit deny ACEs come first by convention.

use anyhow::Result;
use windows::Win32::Security::{
    Authorization::TRUSTEE_IS_WELL_KNOWN_GROUP, WinCreatorOwnerRightsSid,
};

use super::{super::process::Process, acl, sid::Sid, USER_RIGHTS};

/// ACE granting the owner only `USER_RIGHTS`, without `READ_CONTROL | WRITE_DAC`.
///
/// Relies on Windows ignoring the owner's implicit rights once an OWNER RIGHTS ACE is
/// present.
/// Ref: <https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-security-identifiers>
pub(super) struct OwnerRightsAce {
    owner_rights: Sid,
}

impl OwnerRightsAce {
    pub(super) fn new() -> Result<Self> {
        Ok(Self {
            owner_rights: Sid::well_known(WinCreatorOwnerRightsSid)?,
        })
    }

    /// Adds the ACE to the DACL of `process`, which must be open with
    /// `READ_CONTROL | WRITE_DAC`. Run after `RestrictedDacl::apply`, which replaces the DACL.
    pub(super) fn apply(&self, process: &Process) -> Result<()> {
        let entry = acl::grant(&self.owner_rights, USER_RIGHTS, TRUSTEE_IS_WELL_KNOWN_GROUP);
        acl::add(process, &[entry])
    }
}
