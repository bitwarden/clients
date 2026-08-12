//! Vendored peer-process resolution for the Agent Access local listener.
//!
//! This is a deliberate third copy alongside `ssh_agent::server::peer_info` and the deprecated
//! `desktop_core::ssh_agent::peerinfo::gather` — see agent-access-architecture.md's
//! "Attestation model" section for why a shared dependency wasn't the right call (both existing
//! copies are private to their crates, and `desktop_core` is deprecated and heavy). This copy
//! differs from both in two ways:
//!
//! - It retains the **full executable path**, not just the basename — W2a (code-signature
//!   verification, dialog copy) needs it, and dropping it here would mean re-adding it later.
//! - It does **not** carry a `uid` field. The legacy `desktop_core` copy's `PeerInfo::new` takes
//!   `(peer_pid, uid, name)` but every call site passes the pid twice (see
//!   `core/src/ssh_agent/peerinfo/gather.rs`) — `uid` is never actually the peer's uid. Rather
//!   than propagate that bug into a new crate, the field is simply omitted.
//!
//! Parent-chain walking and code-signature verification (W2a, `crate::attestation`) populate
//! [`LocalPeerInfo::parent`] / [`LocalPeerInfo::signature`] after this type is constructed —
//! both start `None` here and are filled in by `local_listener`'s per-connection attestation
//! step, never by this module.

use sysinfo::{Pid, System};

use crate::attestation::{ParentProcessInfo, SignatureInfo};

/// Best-effort identification of the process on the other end of a local listener connection.
///
/// `pid` is always populated — it's captured directly from OS-verified peer credentials
/// (`peer_cred()` on Unix, `GetNamedPipeClientProcessId` on Windows) *before* this type is ever
/// constructed, so it's never in question. `process_name` / `exe_path` are best-effort: process
/// resolution can fail independently (the peer has already exited, sandboxing, permissions), in
/// which case they're `None` rather than causing the whole lookup to fail — a connection with an
/// unresolved process name is still worth attesting on `pid` alone.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LocalPeerInfo {
    pub pid: u32,
    pub process_name: Option<String>,
    pub exe_path: Option<String>,
    /// Best-effort one-level parent-chain walk (W2a, `crate::attestation`). `None` until
    /// `local_listener` runs attestation; stays `None` if resolution failed or the peer was
    /// already reparented to `launchd`/`init` — see `attestation::resolve_parent`'s docs.
    pub parent: Option<ParentProcessInfo>,
    /// Code-signature facts about the attested process — the resolved `parent` if present,
    /// else this peer (W2a, `crate::attestation`). `None` until `local_listener` runs
    /// attestation, or if verification could not be attempted at all.
    pub signature: Option<SignatureInfo>,
}

impl LocalPeerInfo {
    /// Resolves process metadata for `pid`, trying the macOS `libproc` fast path first (works
    /// under sandboxed/MAS builds where the `sysinfo` path may not) and falling back to
    /// `sysinfo` on every platform. Always returns a value — `pid` alone is already useful, so
    /// resolution failure only clears `process_name` / `exe_path`, never the whole result.
    pub(crate) fn from_pid(pid: u32) -> Self {
        #[cfg(target_os = "macos")]
        if let Some(info) = Self::from_libproc(pid) {
            return info;
        }

        Self::from_sysinfo(pid).unwrap_or(Self {
            pid,
            process_name: None,
            exe_path: None,
            parent: None,
            signature: None,
        })
    }

    /// Alternative to the `sysinfo`-based lookup that is permissive within sandboxed runtimes
    /// such as Mac App Store builds.
    #[cfg(target_os = "macos")]
    fn from_libproc(pid: u32) -> Option<Self> {
        let pid_i32 = i32::try_from(pid).ok()?;
        let exe_path = pid_executable_path(pid_i32).ok()?;
        if exe_path.is_empty() {
            return None;
        }
        let process_name = basename(&exe_path);
        Some(Self {
            pid,
            process_name: (!process_name.is_empty()).then_some(process_name),
            exe_path: Some(exe_path),
            parent: None,
            signature: None,
        })
    }

    fn from_sysinfo(pid: u32) -> Option<Self> {
        let mut system = System::new();
        system.refresh_processes(
            sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
            true,
        );
        let process = system.process(Pid::from_u32(pid))?;
        let process_name = process.name().to_str().map(str::to_string);
        let exe_path = process.exe().and_then(|p| p.to_str()).map(str::to_string);
        Some(Self {
            pid,
            process_name,
            exe_path,
            parent: None,
            signature: None,
        })
    }
}

/// Safe wrapper over `proc_pidpath(2)`, declared in macOS's
/// [`<libproc.h>`][libproc-h]. Returns the absolute executable path of `pid`,
/// or an error string describing the failure.
///
/// [libproc-h]: https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/libproc/libproc.h
#[cfg(target_os = "macos")]
fn pid_executable_path(pid: i32) -> Result<String, String> {
    // PROC_PIDPATHINFO_MAXSIZE from <sys/proc_info.h> is 4 * PATH_MAX.
    let mut buf = vec![0u8; 4 * (libc::PATH_MAX as usize)];
    // SAFETY: `proc_pidpath` writes at most `buf.len()` bytes into `buf` and
    // returns the number of bytes written (0 on failure).
    let written = unsafe {
        libc::proc_pidpath(
            pid,
            buf.as_mut_ptr().cast::<libc::c_void>(),
            buf.len() as u32,
        )
    };
    if written <= 0 {
        return Err(format!(
            "proc_pidpath({pid}) failed: {}",
            std::io::Error::last_os_error()
        ));
    }
    let written = written as usize;
    if written > buf.len() {
        return Err(format!(
            "proc_pidpath({pid}) overran buffer: wrote {written} bytes into a {}-byte buffer",
            buf.len()
        ));
    }
    buf.truncate(written);
    // Some XNU versions historically counted the trailing NUL in the returned length; trim at
    // the first NUL so the resolved path is clean regardless of the kernel's terminator
    // convention (paths never contain an interior NUL).
    if let Some(nul) = buf.iter().position(|&b| b == 0) {
        buf.truncate(nul);
    }
    String::from_utf8(buf).map_err(|e| format!("proc_pidpath({pid}) returned non-UTF-8: {e}"))
}

/// Extract the basename from a path string, falling back to the original input when no
/// separator is present or when `Path::file_name()` returns `None` (e.g. `"/"`, `"."`, or
/// `"foo/.."`). Any trailing or embedded NUL bytes are trimmed defensively before basename
/// extraction so a C-string terminator never propagates into `process_name`.
#[cfg(target_os = "macos")]
fn basename(path: &str) -> String {
    let trimmed = path.split('\0').next().unwrap_or("");
    std::path::Path::new(trimmed)
        .file_name()
        .and_then(|s| s.to_str())
        .map(str::to_string)
        .unwrap_or_else(|| trimmed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn from_pid_resolves_current_process() {
        let info = LocalPeerInfo::from_pid(std::process::id());
        assert_eq!(info.pid, std::process::id());
        assert!(info.process_name.is_some());
    }

    #[test]
    fn from_pid_nonexistent_still_returns_pid_only() {
        // u32::MAX far exceeds the maximum PID on any supported platform, so resolution fails —
        // but `pid` was already known from OS peer credentials, so it's still returned.
        let info = LocalPeerInfo::from_pid(u32::MAX);
        assert_eq!(info.pid, u32::MAX);
        assert!(info.process_name.is_none());
        assert!(info.exe_path.is_none());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn from_pid_macos_retains_full_exe_path() {
        let info = LocalPeerInfo::from_pid(std::process::id());
        let exe_path = info
            .exe_path
            .expect("libproc should resolve self pid on macOS");
        assert!(
            exe_path.contains('/'),
            "expected a full path, got: {exe_path}"
        );
        let process_name = info.process_name.expect("process name should resolve");
        assert!(
            !process_name.contains('/'),
            "expected a basename, got: {process_name}"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_normal_extracts_basename() {
        assert_eq!(basename("/Applications/Foo.app/Contents/MacOS/Foo"), "Foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn basename_strips_nul_bytes() {
        assert_eq!(
            basename("/Applications/Foo.app/Contents/MacOS/Foo\0"),
            "Foo"
        );
    }
}
