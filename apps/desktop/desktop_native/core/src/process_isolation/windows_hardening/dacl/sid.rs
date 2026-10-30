//! Security identifiers (SIDs): who an ACE applies to.
//!
//! The DACL names three principals: the current user (from this process's token),
//! SYSTEM (`S-1-5-18`) and OWNER RIGHTS (`S-1-3-4`, see `ace`). The last two are
//! well-known SIDs, identical on every machine.
//!
//! # What a SID is
//!
//! A SID uniquely identifies a user, group or special principal, e.g.
//! `S-1-5-21-…-1001` for a user or `S-1-5-18` for SYSTEM. Windows checks access by SID,
//! never by name. Every process carries an access token listing its user SID and group
//! SIDs; an ACE applies to a caller if the ACE's SID is in the caller's token.

use anyhow::Result;
use windows::{
    core::Owned,
    Win32::{
        Foundation::HANDLE,
        Security::{
            CreateWellKnownSid, GetLengthSid, GetTokenInformation, TokenUser, PSID,
            SECURITY_MAX_SID_SIZE, TOKEN_QUERY, TOKEN_USER, WELL_KNOWN_SID_TYPE,
        },
        System::Threading::OpenProcessToken,
    },
};

use super::super::process::Process;

/// `TOKEN_USER` header plus the largest SID, in `u64` words to keep it aligned.
const TOKEN_USER_WORDS: usize =
    (size_of::<TOKEN_USER>() + SECURITY_MAX_SID_SIZE as usize).div_ceil(size_of::<u64>());

/// An owned SID, stored as its raw bytes.
pub(super) struct Sid(Vec<u8>);

impl Sid {
    /// SID of the user running this process, read from its access token.
    /// Ref: <https://learn.microsoft.com/en-us/windows/win32/secauthz/access-tokens>
    pub(super) fn current_user() -> Result<Self> {
        let mut raw = HANDLE::default();
        // SAFETY: The pseudo handle is always valid and `raw` is a valid out pointer.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-openprocesstoken
        unsafe { OpenProcessToken(Process::current().handle(), TOKEN_QUERY, &mut raw)? };
        // SAFETY: `raw` is a fresh, valid token handle owned by nobody else.
        // The token must be closed with CloseHandle; dropping `Owned` does that on every
        // return path.
        let token = unsafe { Owned::new(raw) };

        let mut buf = [0u64; TOKEN_USER_WORDS];
        let mut len = 0u32;
        // SAFETY: `buf` is writable for the length passed and `len` is a valid out pointer.
        // `token` was opened with TOKEN_QUERY above; without it the call only fails.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-gettokeninformation
        unsafe {
            GetTokenInformation(
                *token,
                TokenUser,
                Some(buf.as_mut_ptr().cast()),
                size_of_val(&buf) as u32,
                &mut len,
            )?
        };

        // SAFETY: GetTokenInformation succeeded, so `buf` starts with an initialized,
        // u64-aligned TOKEN_USER.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-token_user
        let sid = unsafe { (*buf.as_ptr().cast::<TOKEN_USER>()).User.Sid };
        // SAFETY: `sid` points to a valid SID inside `buf`, which is still alive.
        let sid_len = unsafe { GetLengthSid(sid) } as usize;
        // SAFETY: The SID occupies `sid_len` initialized bytes inside `buf`; copied before
        // `buf` goes out of scope.
        let bytes = unsafe { std::slice::from_raw_parts(sid.0.cast::<u8>(), sid_len) };

        Ok(Self(bytes.to_vec()))
    }

    /// A SID that is the same on every machine, e.g. SYSTEM or OWNER RIGHTS.
    /// Ref: <https://learn.microsoft.com/en-us/windows/win32/secauthz/well-known-sids>
    pub(super) fn well_known(kind: WELL_KNOWN_SID_TYPE) -> Result<Self> {
        let mut sid = vec![0u8; SECURITY_MAX_SID_SIZE as usize];
        let mut len = SECURITY_MAX_SID_SIZE;
        // SAFETY: `sid` is writable for `len` bytes, the maximum size of any SID.
        // Ref: https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-createwellknownsid
        unsafe { CreateWellKnownSid(kind, None, Some(PSID(sid.as_mut_ptr().cast())), &mut len)? };
        sid.truncate(len as usize);

        Ok(Self(sid))
    }

    /// Pointer to the SID bytes, valid while `self` lives.
    pub(super) fn as_ptr(&self) -> *const u8 {
        self.0.as_ptr()
    }
}
