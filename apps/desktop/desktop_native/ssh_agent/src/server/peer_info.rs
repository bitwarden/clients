//! Peer process information for SSH agent connections

use std::path::Path;

use sysinfo::{Pid, Process, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tracing::warn;

/// Stops the ancestry walk on deep or cyclic process trees.
const MAX_ANCESTRY_DEPTH: usize = 32;

/// Processes that only relay a request to the agent. They are skipped when looking for the app
/// that caused it, e.g. `ssh ← zsh ← claude` is attributed to `claude`.
const RELAY_PROCESSES: &[&str] = &[
    "bash",
    "cmd",
    "csh",
    "dash",
    "env",
    "fish",
    "git",
    "ksh",
    "login",
    "nu",
    "powershell",
    "pwsh",
    "sh",
    "ssh",
    "ssh-add",
    "ssh-keygen",
    "sudo",
    "tcsh",
    "zsh",
];

/// Processes that start a user's apps. The process right below one is the host app, e.g.
/// `iTerm2` in `ssh ← zsh ← login ← iTerm2 ← launchd`.
const SESSION_ROOTS: &[&str] = &[
    "explorer", "init", "launchd", "services", "systemd", "wininit",
];

/// Information about the connecting peer process
#[derive(Debug, Clone)]
pub(crate) struct PeerInfo {
    pid: u32,
    process_name: String,
    origin: PeerOrigin,
}

/// Where a peer's request comes from: its command line and the apps that started it.
#[derive(Debug, Clone, Default)]
struct PeerOrigin {
    /// The peer's command line, e.g. `ssh -t example.com`.
    command: Option<String>,
    /// The nearest ancestor that is not a relay process, e.g. `claude`.
    caller_app: Option<String>,
    /// The outermost ancestor below the session root, e.g. `iTerm2`.
    host_app: Option<String>,
}

impl PeerInfo {
    /// Looks up the process name for `pid`, trying the macOS fast path
    /// first and falling back to the cross-platform `sysinfo` path.
    /// Intermediate failures are logged; returns `None` only when both
    /// paths fail.
    pub(crate) fn from_pid(pid: u32) -> Option<Self> {
        let mut info = Self::name_from_pid(pid)?;
        info.origin = PeerOrigin::from_pid(pid);
        Some(info)
    }

    fn name_from_pid(pid: u32) -> Option<Self> {
        #[cfg(target_os = "macos")]
        match peer_info_from_libproc(pid) {
            Ok(info) => return Some(info),
            Err(e) => tracing::debug!(
                "libproc peer-info resolution failed for pid {pid}: {e}; falling back to sysinfo"
            ),
        }

        match peer_info_from_sysinfo(pid) {
            Ok(info) => Some(info),
            Err(e) => {
                warn!("failed to resolve peer process for pid {pid}: {e}");
                None
            }
        }
    }

    pub(crate) fn pid(&self) -> u32 {
        self.pid
    }

    pub(crate) fn process_name(&self) -> &str {
        &self.process_name
    }

    pub(crate) fn command(&self) -> Option<&str> {
        self.origin.command.as_deref()
    }

    pub(crate) fn caller_app(&self) -> Option<&str> {
        self.origin.caller_app.as_deref()
    }

    pub(crate) fn host_app(&self) -> Option<&str> {
        self.origin.host_app.as_deref()
    }
}

impl PeerOrigin {
    /// Reads the peer's command line and walks its parents up to the session root. Fields stay
    /// `None` where the OS refuses the lookup, e.g. in sandboxed Mac App Store builds.
    fn from_pid(pid: u32) -> Self {
        let mut system = System::new();
        let Some(peer) = refresh_process(&mut system, pid) else {
            return Self::default();
        };
        let command = command_line(peer.cmd());
        let parent = peer.parent();

        let ancestors = ancestor_names(&mut system, parent);

        Self {
            command,
            caller_app: caller_app(&ancestors),
            host_app: ancestors.last().cloned(),
        }
    }
}

/// Loads `pid`'s name, command line, executable and parent into `system`.
fn refresh_process(system: &mut System, pid: u32) -> Option<&Process> {
    let pid = Pid::from_u32(pid);
    let refresh = ProcessRefreshKind::nothing()
        .with_cmd(UpdateKind::Always)
        .with_exe(UpdateKind::Always);
    system.refresh_processes_specifics(ProcessesToUpdate::Some(&[pid]), true, refresh);
    system.process(pid)
}

/// Display names of `parent` and its ancestors, nearest first, stopping below the session root.
/// E.g. `[zsh, claude, zsh, login, iTerm2]`.
fn ancestor_names(system: &mut System, mut parent: Option<Pid>) -> Vec<String> {
    let mut names = Vec::new();

    while let Some(pid) = parent {
        if names.len() >= MAX_ANCESTRY_DEPTH {
            break;
        }

        let Some(process) = refresh_process(system, pid.as_u32()) else {
            break;
        };

        let name = display_name(process);
        if is_listed(&name, SESSION_ROOTS) {
            break;
        }

        // A process that is its own parent (pid 0 on some platforms) ends the walk.
        let next = process.parent().filter(|&next| next != pid);
        names.push(name);
        parent = next;
    }

    names
}

/// The nearest ancestor that is not a relay process.
fn caller_app(ancestors: &[String]) -> Option<String> {
    ancestors
        .iter()
        .find(|name| !is_listed(name, RELAY_PROCESSES))
        .cloned()
}

/// The name `ps` shows: argv[0]'s file name, e.g. `claude` for a binary installed as
/// `~/.local/share/claude/versions/2.0.0`. Falls back to the executable's name.
fn display_name(process: &Process) -> String {
    let argv0 = process
        .cmd()
        .first()
        .and_then(|arg| Path::new(arg).file_name())
        .and_then(|name| name.to_str())
        // Login shells prefix argv[0] with a dash, e.g. `-zsh`.
        .map(|name| name.trim_start_matches('-'))
        .filter(|name| !name.is_empty());

    match argv0 {
        Some(name) => name.to_string(),
        None => process.name().to_string_lossy().into_owned(),
    }
}

/// Whether `name` is in `list`, ignoring case and a Windows `.exe` suffix.
fn is_listed(name: &str, list: &[&str]) -> bool {
    let name = name.to_ascii_lowercase();
    let name = name.strip_suffix(".exe").unwrap_or(&name);
    list.contains(&name)
}

/// Joins `args` into one line, quoting arguments that contain whitespace.
/// E.g. `["ssh", "-t", "host", "ls -l"]` becomes `ssh -t host 'ls -l'`.
fn command_line(args: &[std::ffi::OsString]) -> Option<String> {
    if args.is_empty() {
        return None;
    }

    let quoted: Vec<String> = args
        .iter()
        .map(|arg| {
            let arg = arg.to_string_lossy();
            if arg.chars().any(char::is_whitespace) {
                format!("'{arg}'")
            } else {
                arg.into_owned()
            }
        })
        .collect();

    Some(quoted.join(" "))
}

/// Alternative to the `sysinfo`-based lookup that is permissive within
/// sandboxed runtimes such as Mac App Store builds.
#[cfg(target_os = "macos")]
fn peer_info_from_libproc(pid: u32) -> Result<PeerInfo, String> {
    let pid_i32 = i32::try_from(pid).map_err(|_| format!("peer pid {pid} exceeds i32 range"))?;
    let path = pid_executable_path(pid_i32)?;
    let process_name = basename_or_path(&path);
    if process_name.is_empty() {
        return Err("Process name is empty".to_string());
    }
    Ok(PeerInfo {
        pid,
        process_name,
        origin: PeerOrigin::default(),
    })
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
    // Some XNU versions historically counted the trailing NUL in the returned
    // length; trim at the first NUL so the resolved path is clean regardless of
    // the kernel's terminator convention (paths never contain an interior NUL).
    if let Some(nul) = buf.iter().position(|&b| b == 0) {
        buf.truncate(nul);
    }
    String::from_utf8(buf).map_err(|e| format!("proc_pidpath({pid}) returned non-UTF-8: {e}"))
}

fn peer_info_from_sysinfo(pid: u32) -> Result<PeerInfo, String> {
    let mut system = System::new();
    system.refresh_processes(
        sysinfo::ProcessesToUpdate::Some(&[Pid::from_u32(pid)]),
        true,
    );
    let process = system
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("sysinfo: process {pid} not found"))?;
    let process_name = process
        .name()
        .to_str()
        .ok_or_else(|| format!("sysinfo: process {pid} name is not valid UTF-8"))?
        .to_string();
    Ok(PeerInfo {
        pid,
        process_name,
        origin: PeerOrigin::default(),
    })
}

/// Extract the basename from a path string, falling back to the original
/// input when no separator is present or when `Path::file_name()` returns
/// `None` (e.g. `"/"`, `"."`, or `"foo/.."`). Any trailing or embedded NUL
/// bytes are trimmed defensively before basename extraction so we never
/// propagate a C-string terminator into the UI.
#[cfg(target_os = "macos")]
fn basename_or_path(path: &str) -> String {
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
    fn test_from_pid_current_process() {
        let pid = std::process::id();
        let peer_info = PeerInfo::from_pid(pid).unwrap();
        assert_eq!(peer_info.pid(), pid);
        assert!(!peer_info.process_name().is_empty());
    }

    #[test]
    fn test_from_pid_current_process_resolves_origin() {
        let peer_info = PeerInfo::from_pid(std::process::id()).unwrap();

        // The test binary runs with arguments, under cargo or a shell.
        assert!(peer_info.command().is_some_and(|c| !c.is_empty()));
        assert!(peer_info.host_app().is_some());
    }

    #[test]
    fn test_caller_app_skips_relay_processes() {
        let ancestors = ["zsh", "claude", "zsh", "login", "iTerm2"].map(String::from);
        assert_eq!(caller_app(&ancestors).as_deref(), Some("claude"));
    }

    #[test]
    fn test_caller_app_relay_processes_only_returns_none() {
        let ancestors = ["git", "zsh", "login"].map(String::from);
        assert_eq!(caller_app(&ancestors), None);
    }

    #[test]
    fn test_is_listed_ignores_case_and_exe_suffix() {
        assert!(is_listed("PowerShell.exe", RELAY_PROCESSES));
        assert!(is_listed("explorer.exe", SESSION_ROOTS));
        assert!(!is_listed("WindowsTerminal.exe", RELAY_PROCESSES));
    }

    #[test]
    fn test_command_line_quotes_whitespace() {
        let args = ["ssh", "-t", "host", "ls -l"].map(std::ffi::OsString::from);
        assert_eq!(command_line(&args).as_deref(), Some("ssh -t host 'ls -l'"));
    }

    #[test]
    fn test_command_line_empty_returns_none() {
        assert_eq!(command_line(&[]), None);
    }

    #[test]
    fn test_from_pid_nonexistent_returns_none() {
        // u32::MAX = 4294967295 far exceeds the maximum PID on any supported platform
        assert!(PeerInfo::from_pid(u32::MAX).is_none());
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_peer_info_from_libproc_returns_basename() {
        let info = peer_info_from_libproc(std::process::id())
            .expect("libproc should resolve self pid on macOS");
        let name = info.process_name();
        assert!(!name.is_empty());
        assert!(!name.contains('/'), "expected basename, got: {name}");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_peer_info_from_libproc_propagates_error_for_dead_pid() {
        // u32::MAX far exceeds the macOS PID range, so libproc returns an
        // error. We must surface that error rather than collapse it.
        let err = peer_info_from_libproc(u32::MAX)
            .expect_err("dead pid should yield an Err with context");
        assert!(
            err.contains("exceeds i32 range") || err.contains("proc_pidpath"),
            "error should describe the failure mode: {err}"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_normal_extracts_basename() {
        assert_eq!(
            basename_or_path("/Applications/Foo.app/Contents/MacOS/Foo"),
            "Foo"
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_no_separator_returns_input() {
        assert_eq!(basename_or_path("foo"), "foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_root_falls_back_to_input() {
        // Path::new("/").file_name() returns None
        assert_eq!(basename_or_path("/"), "/");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_trailing_slash_returns_last_component() {
        assert_eq!(basename_or_path("/foo/"), "foo");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_empty_returns_empty() {
        assert_eq!(basename_or_path(""), "");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_single_dot_falls_back_to_input() {
        // Path::new(".").file_name() returns None
        assert_eq!(basename_or_path("."), ".");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_double_dot_returns_double_dot() {
        // Path::new("..").file_name() returns Some("..")
        assert_eq!(basename_or_path(".."), "..");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_basename_or_path_strips_nul_bytes() {
        // Defensive: a C-string-style terminator from any libproc bug must
        // not propagate to the UI. We trim everything from the first NUL.
        assert_eq!(basename_or_path("foo\0"), "foo");
        assert_eq!(
            basename_or_path("/Applications/Foo.app/Contents/MacOS/Foo\0"),
            "Foo"
        );
    }
}
