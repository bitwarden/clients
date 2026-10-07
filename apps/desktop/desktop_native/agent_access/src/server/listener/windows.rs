//! Named pipe transport: owner-only DACL, first instance only, local clients only.

use std::{ffi::c_void, mem, os::windows::io::AsRawHandle};

use anyhow::{anyhow, Result};
use tokio::net::windows::named_pipe::{NamedPipeServer, ServerOptions};
use tracing::{info, warn};
use windows::{
    core::w,
    Win32::{
        Foundation::{LocalFree, HANDLE, HLOCAL},
        Security::{
            Authorization::{
                ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
            },
            PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES,
        },
        System::Pipes::GetNamedPipeClientProcessId,
    },
};

use super::{Connection, Listener};

pub(crate) const PIPE_NAME: &str = r"\\.\pipe\bitwarden-access";

pub(crate) struct WindowsListener {
    inner: NamedPipeServer,
}

impl WindowsListener {
    pub(crate) fn new() -> Result<Self> {
        let inner = create_instance(true)?;
        info!(pipe_name = PIPE_NAME, "agent pipe ready");
        Ok(Self { inner })
    }
}

#[async_trait::async_trait]
impl Listener for WindowsListener {
    type Stream = NamedPipeServer;

    async fn accept(&mut self) -> Result<Connection<Self::Stream>> {
        self.inner.connect().await?;

        // Create the next instance before handing this one off, so the name never lapses.
        let stream = mem::replace(&mut self.inner, create_instance(false)?);
        let peer_pid = client_pid(&stream);
        Ok(Connection { stream, peer_pid })
    }
}

fn create_instance(first: bool) -> Result<NamedPipeServer> {
    let mut descriptor = PSECURITY_DESCRIPTOR::default();
    // Protected DACL granting full access to the owner only.
    // SAFETY: the SDDL literal is NUL-terminated and `descriptor` is a valid out-pointer.
    unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            w!("D:P(A;;GA;;;OW)"),
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
            .create_with_security_attributes_raw(PIPE_NAME, (&raw mut attributes).cast::<c_void>())
    };
    // SAFETY: `descriptor` was allocated by ConvertStringSecurityDescriptorToSecurityDescriptorW.
    unsafe { LocalFree(Some(HLOCAL(descriptor.0))) };

    server.map_err(|e| anyhow!("Unable to create named pipe {PIPE_NAME}: {e}"))
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
