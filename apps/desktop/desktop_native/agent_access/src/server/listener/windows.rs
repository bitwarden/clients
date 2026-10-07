//! Named pipe transport: per-user name, user-only DACL, first instance only, local clients only.

use std::{ffi::c_void, mem, os::windows::io::AsRawHandle};

use anyhow::{anyhow, bail, Result};
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
use tracing::{info, warn};
use windows::{
    core::{HSTRING, PWSTR},
    Win32::{
        Foundation::{CloseHandle, LocalFree, HANDLE, HLOCAL},
        Security::{
            Authorization::{
                ConvertSidToStringSidW, ConvertStringSecurityDescriptorToSecurityDescriptorW,
                SDDL_REVISION_1,
            },
            GetTokenInformation, TokenUser, PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES, TOKEN_QUERY,
            TOKEN_USER,
        },
        System::{
            Pipes::{GetNamedPipeClientProcessId, GetNamedPipeServerProcessId},
            Threading::{
                GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
            },
        },
    },
};

use super::{Connection, Listener};

/// The pipe namespace is machine-wide, so the name carries the user's SID.
pub fn pipe_name() -> Result<String> {
    Ok(pipe_name_for(&current_user_sid()?))
}

fn pipe_name_for(sid: &str) -> String {
    format!(r"\\.\pipe\bitwarden-access-{sid}")
}

/// Refuses a pipe served by another user, such as one that squatted the name first.
pub fn verify_pipe_server(pipe: &impl AsRawHandle) -> Result<()> {
    let mut pid = 0u32;
    // SAFETY: the handle is valid while `pipe` is alive; `pid` is a local out-param.
    unsafe { GetNamedPipeServerProcessId(HANDLE(pipe.as_raw_handle().cast()), &raw mut pid) }?;
    // SAFETY: closed below.
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }?;
    let owner = process_user_sid(process);
    // SAFETY: opened above.
    let _ = unsafe { CloseHandle(process) };
    if owner? != current_user_sid()? {
        bail!("the agent pipe is served by another user");
    }
    Ok(())
}

pub(crate) struct WindowsListener {
    inner: NamedPipeServer,
    name: String,
    /// Grants the user, not `OW`: an elevated creator's owner is Administrators.
    sddl: HSTRING,
}

impl WindowsListener {
    pub(crate) fn new() -> Result<Self> {
        let sid = current_user_sid()?;
        let name = pipe_name_for(&sid);
        let sddl = HSTRING::from(format!("D:P(A;;GA;;;{sid})"));
        let inner = create_instance(&name, &sddl, true)?;
        info!(pipe_name = name, "agent pipe ready");
        Ok(Self { inner, name, sddl })
    }
}

#[async_trait::async_trait]
impl Listener for WindowsListener {
    type Stream = NamedPipeServer;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        let connected = self.inner.connect().await;
        // Replaced even when connect failed, since a failed instance never connects again.
        // Created first, so the name never lapses.
        let next = create_instance(&self.name, &self.sddl, false)?;
        let stream = mem::replace(&mut self.inner, next);
        connected?;
        let peer_pid = client_pid(&stream);
        Ok(Connection { stream, peer_pid })
    }
}

fn create_instance(name: &str, sddl: &HSTRING, first: bool) -> Result<NamedPipeServer> {
    let mut descriptor = PSECURITY_DESCRIPTOR::default();
    // SAFETY: `sddl` is NUL-terminated and `descriptor` is a valid out-pointer.
    unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl,
            SDDL_REVISION_1,
            &mut descriptor,
            None,
        )
    }
    .map_err(|e| anyhow!("Unable to build the pipe security descriptor: {e}"))?;

    let mut attributes = SECURITY_ATTRIBUTES {
        nLength: mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: descriptor.0,
        bInheritHandle: false.into(),
    };
    // SAFETY: `attributes` and the descriptor it points to outlive the call.
    let server = unsafe {
        ServerOptions::new()
            .first_pipe_instance(first)
            .reject_remote_clients(true)
            .create_with_security_attributes_raw(name, (&raw mut attributes).cast::<c_void>())
    };
    // SAFETY: `descriptor` was allocated by ConvertStringSecurityDescriptorToSecurityDescriptorW.
    unsafe { LocalFree(Some(HLOCAL(descriptor.0))) };

    server.map_err(|e| anyhow!("Unable to create named pipe {name}: {e}"))
}

fn current_user_sid() -> Result<String> {
    // SAFETY: a pseudo-handle; needs no closing.
    process_user_sid(unsafe { GetCurrentProcess() })
}

/// `S-1-5-21-…` of the user `process` runs as.
fn process_user_sid(process: HANDLE) -> Result<String> {
    let mut token = HANDLE::default();
    // SAFETY: `token` is a valid out-pointer; closed below.
    unsafe { OpenProcessToken(process, TOKEN_QUERY, &raw mut token) }?;
    let sid = token_user_sid(token);
    // SAFETY: opened above.
    let _ = unsafe { CloseHandle(token) };
    sid
}

fn token_user_sid(token: HANDLE) -> Result<String> {
    let mut len = 0u32;
    // SAFETY: a size query; it fails with ERROR_INSUFFICIENT_BUFFER after setting `len`.
    let _ = unsafe { GetTokenInformation(token, TokenUser, None, 0, &raw mut len) };
    // u64 words keep TOKEN_USER aligned.
    let mut buffer = vec![0u64; (len as usize).div_ceil(8)];
    // SAFETY: `buffer` holds at least `len` bytes.
    unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            Some(buffer.as_mut_ptr().cast()),
            len,
            &raw mut len,
        )
    }?;
    // SAFETY: GetTokenInformation(TokenUser) wrote a TOKEN_USER at the start of `buffer`.
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    let mut string = PWSTR::null();
    // SAFETY: the SID lives in `buffer`; `string` is freed below.
    unsafe { ConvertSidToStringSidW(user.User.Sid, &raw mut string) }?;
    // SAFETY: NUL-terminated by ConvertSidToStringSidW.
    let sid = unsafe { string.to_string() };
    // SAFETY: allocated by ConvertSidToStringSidW.
    unsafe { LocalFree(Some(HLOCAL(string.0.cast()))) };
    Ok(sid?)
}

fn client_pid(server: &NamedPipeServer) -> Option<u32> {
    let mut pid: u32 = 0;
    let handle = HANDLE(server.as_raw_handle().cast());
    // SAFETY: `handle` is valid while `server` is alive; `pid` is a local out-param.
    match unsafe { GetNamedPipeClientProcessId(handle, &raw mut pid) } {
        Ok(()) => Some(pid),
        Err(error) => {
            warn!(%error, "failed to get the pipe client's pid");
            None
        }
    }
}
