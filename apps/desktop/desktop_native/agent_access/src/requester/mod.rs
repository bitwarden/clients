//! Names the app behind a request: walks up from the socket peer past shells and our own CLI to
//! the first valid Developer ID signer, since the peer is always `bw-access` under some shell.

#[cfg(target_os = "macos")]
mod macos;

use std::{fs, path::Path};

#[cfg(not(target_os = "macos"))]
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

const MAX_HOPS: usize = 8;
const BITWARDEN_TEAM_ID: &str = "LTZ2PFU5D6";
/// Walked past by name alone, without a signer lookup; nothing shows their signer.
const SHELLS: &str =
    "sh bash zsh fish dash ksh mksh tcsh csh nu pwsh powershell cmd env login sudo doas npx uvx";

/// Who is asking, as far as the OS can tell. Best effort: same-user processes can lie by racing
/// or injecting.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Requester {
    pub app: App,
    /// `chain[0]` is the socket peer, walking up.
    pub chain: Vec<Hop>,
    /// The peer is the `bw-access` shipped with this app, so its stated `purpose` holds.
    pub bundled_cli: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct App {
    pub name: String,
    pub pid: u32,
    pub exe: Option<String>,
    pub signer: Option<Signer>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hop {
    pub pid: u32,
    pub name: String,
    pub exe: Option<String>,
    pub signer: Option<Signer>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Signer {
    pub kind: SignerKind,
    /// Team id; the signing identifier for platform binaries; `None` for ad hoc.
    pub id: Option<String>,
    pub organization: Option<String>,
    pub valid: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignerKind {
    DeveloperId,
    Platform,
    AdHoc,
    Other,
}

pub(crate) struct ProcessEntry {
    pub ppid: Option<u32>,
    pub name: String,
    pub exe: Option<String>,
}

#[derive(Clone)]
pub(crate) struct SignerInfo {
    pub signer: Signer,
    pub identifier: Option<String>,
    /// Info.plist display name, sealed by the signature.
    pub bundle_name: Option<String>,
}

pub(crate) trait ProcessTable {
    fn process(&self, pid: u32) -> Option<ProcessEntry>;
    fn signer(&self, pid: u32, exe: Option<&str>) -> Option<SignerInfo>;
    /// `exe` is the `bw-access` installed next to this app.
    fn is_bundled_cli(&self, exe: &str) -> bool;
}

/// Blocking (process table + SecCode); call from spawn_blocking.
pub fn resolve(peer_pid: u32) -> Requester {
    walk(&OsTable, peer_pid)
}

fn walk(table: &impl ProcessTable, peer_pid: u32) -> Requester {
    let (mut chain, mut app, mut peer) = (Vec::new(), None, None);
    let mut pid = peer_pid;
    while chain.len() < MAX_HOPS && pid > 1 && chain.iter().all(|h: &Hop| h.pid != pid) {
        let Some(entry) = table.process(pid) else {
            break;
        };
        let name = entry
            .exe
            .as_deref()
            .and_then(|e| Path::new(e).file_name()?.to_str())
            .map_or(entry.name, str::to_string);
        let info = (!is_shell(&name))
            .then(|| table.signer(pid, entry.exe.as_deref()))
            .flatten();
        let hop = Hop {
            pid,
            name,
            exe: entry.exe,
            signer: info.as_ref().map(|i| i.signer.clone()),
        };
        let this = App {
            name: display_name(&hop, info.as_ref()),
            pid,
            exe: hop.exe.clone(),
            signer: hop.signer.clone(),
        };
        let candidate = !is_transparent(&hop);
        let signed = candidate && is_developer_id(&hop, |s| s.valid);
        chain.push(hop);
        if signed || (candidate && app.is_none()) {
            app = Some(this);
        } else if peer.is_none() {
            peer = Some(this);
        }
        match entry.ppid {
            Some(ppid) if !signed => pid = ppid,
            _ => break,
        }
    }
    let app = app.or(peer).unwrap_or_else(|| App {
        name: "unknown".to_string(),
        pid: peer_pid,
        exe: None,
        signer: None,
    });
    let bundled_cli = chain
        .first()
        .is_some_and(|peer| is_bundled_cli(table, peer));
    Requester {
        app,
        chain,
        bundled_cli,
    }
}

/// macOS: Bitwarden's Developer ID, since the bundle is user-writable. Elsewhere: the install path.
fn is_bundled_cli(table: &impl ProcessTable, peer: &Hop) -> bool {
    if cfg!(target_os = "macos") {
        peer.name == "bw-access"
            && is_developer_id(peer, |s| {
                s.valid && s.id.as_deref() == Some(BITWARDEN_TEAM_ID)
            })
    } else {
        peer.exe
            .as_deref()
            .is_some_and(|exe| table.is_bundled_cli(exe))
    }
}

fn is_developer_id(hop: &Hop, also: impl Fn(&Signer) -> bool) -> bool {
    hop.signer
        .as_ref()
        .is_some_and(|s| s.kind == SignerKind::DeveloperId && also(s))
}

fn is_transparent(hop: &Hop) -> bool {
    is_shell(&hop.name)
        || base_name(&hop.name) == "bw-access"
        || is_developer_id(hop, |s| s.id.as_deref() == Some(BITWARDEN_TEAM_ID))
}

fn is_shell(name: &str) -> bool {
    let name = base_name(name);
    SHELLS.split_whitespace().any(|shell| shell == name)
}

/// `-zsh` (login) and `ZSH.EXE` → `zsh`.
fn base_name(name: &str) -> String {
    let name = name.to_ascii_lowercase();
    let name = name.strip_prefix('-').unwrap_or(&name);
    name.strip_suffix(".exe").unwrap_or(name).to_string()
}

/// Only an Apple-anchored signature vouches for the bundle name; anyone can write an Info.plist.
fn display_name(hop: &Hop, info: Option<&SignerInfo>) -> String {
    let Some(info) = info.filter(|i| {
        i.signer.valid
            && matches!(
                i.signer.kind,
                SignerKind::DeveloperId | SignerKind::Platform
            )
    }) else {
        return hop.name.clone();
    };
    let humanized = || {
        let identifier = info.identifier.as_deref();
        humanize(identifier.filter(|_| info.signer.kind == SignerKind::DeveloperId)?)
    };
    info.bundle_name
        .clone()
        .or_else(humanized)
        .unwrap_or_else(|| hop.name.clone())
}

/// `com.anthropic.claude-code` → `Claude Code`.
fn humanize(identifier: &str) -> Option<String> {
    let words: Vec<String> = identifier
        .rsplit('.')
        .next()?
        .split(['-', '_'])
        .filter_map(|word| {
            let mut chars = word.chars();
            chars
                .next()
                .map(|c| c.to_uppercase().chain(chars).collect())
        })
        .collect();
    (!words.is_empty()).then(|| words.join(" "))
}

struct OsTable;

impl ProcessTable for OsTable {
    #[cfg(target_os = "macos")]
    fn process(&self, pid: u32) -> Option<ProcessEntry> {
        macos::process(pid)
    }

    #[cfg(not(target_os = "macos"))]
    fn process(&self, pid: u32) -> Option<ProcessEntry> {
        let pid = Pid::from_u32(pid);
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[pid]),
            true,
            ProcessRefreshKind::nothing().with_exe(UpdateKind::Always),
        );
        let process = system.process(pid)?;
        Some(ProcessEntry {
            ppid: process.parent().map(Pid::as_u32),
            name: process.name().to_string_lossy().into_owned(),
            exe: process.exe().and_then(Path::to_str).map(str::to_string),
        })
    }

    #[cfg(target_os = "macos")]
    fn signer(&self, pid: u32, _exe: Option<&str>) -> Option<SignerInfo> {
        macos::signer(pid)
    }

    #[cfg(not(target_os = "macos"))]
    fn signer(&self, _pid: u32, _exe: Option<&str>) -> Option<SignerInfo> {
        None
    }

    fn is_bundled_cli(&self, exe: &str) -> bool {
        let name = if cfg!(windows) {
            "bw-access.exe"
        } else {
            "bw-access"
        };
        let bundled = std::env::current_exe().map(|app| app.with_file_name(name));
        bundled
            .and_then(fs::canonicalize)
            .is_ok_and(|bundled| fs::canonicalize(exe).is_ok_and(|exe| exe == bundled))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// (pid, ppid, exe path or bare name, signer).
    struct Fake(Vec<(u32, u32, &'static str, Option<SignerInfo>)>);

    const BUNDLED: &str = "/opt/Bitwarden/bw-access";

    impl ProcessTable for Fake {
        fn process(&self, pid: u32) -> Option<ProcessEntry> {
            let (_, ppid, name, _) = self.0.iter().find(|r| r.0 == pid)?;
            let exe = name.contains('/').then(|| name.to_string());
            let name = name.rsplit('/').next().unwrap_or(name).to_string();
            Some(ProcessEntry {
                ppid: Some(*ppid),
                name,
                exe,
            })
        }
        fn signer(&self, pid: u32, _exe: Option<&str>) -> Option<SignerInfo> {
            self.0.iter().find(|r| r.0 == pid)?.3.clone()
        }
        fn is_bundled_cli(&self, exe: &str) -> bool {
            exe == BUNDLED
        }
    }

    fn info(kind: SignerKind, id: &str, org: &str, ident: &str) -> Option<SignerInfo> {
        let (id, organization) = (Some(id.to_string()), Some(org.to_string()));
        let signer = Signer {
            kind,
            id,
            organization,
            valid: true,
        };
        Some(SignerInfo {
            signer,
            identifier: Some(ident.to_string()),
            bundle_name: None,
        })
    }

    fn apple(ident: &str) -> Option<SignerInfo> {
        info(SignerKind::Platform, ident, "Apple", ident)
    }

    fn dev(team: &str, org: &str, ident: &str) -> Option<SignerInfo> {
        info(SignerKind::DeveloperId, team, org, ident)
    }

    fn claude() -> Option<SignerInfo> {
        dev("Q6L2SF6YDW", "Anthropic PBC", "com.anthropic.claude-code")
    }

    fn ghostty() -> Option<SignerInfo> {
        dev("24VZTF6M5V", "Mitchell Hashimoto", "com.mitchellh.ghostty")
    }

    fn names(r: &Requester) -> Vec<&str> {
        r.chain.iter().map(|h| h.name.as_str()).collect()
    }

    #[test]
    fn measured_claude_chain_names_claude_code() {
        let t = Fake(vec![
            (60, 50, "/opt/homebrew/bin/bw-access", None),
            (50, 40, "/bin/zsh", apple("com.apple.zsh")),
            (40, 30, "/Users/a/.local/bin/claude", claude()),
            (30, 20, "-zsh", apple("com.apple.zsh")),
            (20, 10, "/usr/bin/login", apple("com.apple.login")),
            (10, 1, "ghostty", ghostty()),
        ]);
        let r = walk(&t, 60);
        assert_eq!(r.app.name, "Claude Code");
        assert_eq!(r.app.pid, 40);
        let signer = r.app.signer.as_ref().expect("signer");
        assert_eq!(signer.organization.as_deref(), Some("Anthropic PBC"));
        assert_eq!(names(&r), ["bw-access", "zsh", "claude"]);
    }

    #[test]
    fn human_in_terminal_falls_back_to_terminal() {
        let t = Fake(vec![
            (60, 50, "bw-access", None),
            (50, 40, "-zsh", None),
            (40, 30, "login", apple("com.apple.login")),
            (30, 1, "Terminal", apple("com.apple.Terminal")),
            (1, 0, "launchd", apple("com.apple.xpc.launchd")),
        ]);
        let r = walk(&t, 60);
        assert_eq!((r.app.name.as_str(), r.app.pid), ("Terminal", 30));
        assert_eq!(names(&r), ["bw-access", "-zsh", "login", "Terminal"]);
    }

    #[test]
    fn unsigned_node_is_walked_past() {
        let t = Fake(vec![
            (60, 50, "bw-access", None),
            (50, 40, "zsh", None),
            (40, 30, "node", None),
            (30, 20, "claude", claude()),
            (20, 1, "ghostty", ghostty()),
        ]);
        let r = walk(&t, 60);
        assert_eq!((r.app.name.as_str(), r.app.pid), ("Claude Code", 30));
        assert_eq!(names(&r), ["bw-access", "zsh", "node", "claude"]);
    }

    #[test]
    fn all_transparent_names_the_peer() {
        let t = Fake(vec![(60, 50, "bw-access", None), (50, 1, "sh", None)]);
        let r = walk(&t, 60);
        assert_eq!((r.app.name.as_str(), r.app.pid), ("bw-access", 60));
        assert_eq!(r.chain.len(), 2);
    }

    #[test]
    fn unresolvable_peer_is_unknown() {
        let r = walk(&Fake(vec![]), 42);
        assert_eq!((r.app.name.as_str(), r.app.pid), ("unknown", 42));
        assert!(r.chain.is_empty());
    }

    #[test]
    fn walk_stops_at_eight_hops_and_on_cycles() {
        let long = Fake((100..120).map(|p| (p, p + 1, "zsh", None)).collect());
        assert_eq!(walk(&long, 100).chain.len(), MAX_HOPS);
        let cycle = Fake(vec![(10, 11, "sh", None), (11, 10, "bash", None)]);
        let r = walk(&cycle, 10);
        assert_eq!(names(&r), ["sh", "bash"]);
        assert_eq!(r.app.pid, 10);
    }

    #[test]
    fn bitwarden_signed_hops_are_skipped() {
        let bw = dev(BITWARDEN_TEAM_ID, "Bitwarden Inc.", "com.bitwarden.cli");
        let t = Fake(vec![
            (60, 50, "bw", bw),
            (50, 40, "zsh", None),
            (40, 1, "ghostty", ghostty()),
        ]);
        let r = walk(&t, 60);
        assert_eq!((r.app.name.as_str(), r.app.pid), ("Ghostty", 40));
    }

    #[test]
    fn bundle_name_beats_identifier_and_basename() {
        let mut code = dev(
            "UBF8T346G9",
            "Microsoft Corporation",
            "com.microsoft.VSCode",
        );
        if let Some(info) = code.as_mut() {
            info.bundle_name = Some("Code".to_string());
        }
        let t = Fake(vec![(60, 50, "bw-access", None), (50, 1, "Electron", code)]);
        assert_eq!(walk(&t, 60).app.name, "Code");
    }

    #[test]
    fn self_signed_bundle_name_is_ignored() {
        let mut fake = info(SignerKind::Other, "Q6L2SF6YDW", "Anthropic PBC", "x");
        if let Some(info) = fake.as_mut() {
            info.bundle_name = Some("Claude Code".to_string());
        }
        let t = Fake(vec![
            (60, 50, "bw-access", None),
            (50, 1, "/tmp/evil", fake),
        ]);
        assert_eq!(walk(&t, 60).app.name, "evil");
    }

    #[test]
    fn only_the_shipped_bw_access_is_the_bundled_cli() {
        let bitwarden = || dev(BITWARDEN_TEAM_ID, "Bitwarden Inc.", "com.bitwarden.desktop");
        let peer = |exe: &'static str, signer| {
            let t = Fake(vec![(60, 1, exe, signer)]);
            walk(&t, 60).bundled_cli
        };
        if cfg!(target_os = "macos") {
            assert!(peer("/Applications/x/bw-access", bitwarden()));
            assert!(!peer("/Applications/x/bw-access", None));
            assert!(!peer("/Applications/x/evil", bitwarden()));
        } else {
            assert!(peer(BUNDLED, None));
            assert!(!peer("/tmp/bw-access", None));
        }
    }

    #[test]
    fn shells_get_no_signer_lookup() {
        struct Counting(Fake, std::cell::RefCell<Vec<u32>>);
        impl ProcessTable for Counting {
            fn process(&self, pid: u32) -> Option<ProcessEntry> {
                self.0.process(pid)
            }
            fn signer(&self, pid: u32, exe: Option<&str>) -> Option<SignerInfo> {
                self.1.borrow_mut().push(pid);
                self.0.signer(pid, exe)
            }
            fn is_bundled_cli(&self, exe: &str) -> bool {
                self.0.is_bundled_cli(exe)
            }
        }
        let t = Counting(
            Fake(vec![
                (60, 50, "bw-access", None),
                (50, 40, "-zsh", apple("com.apple.zsh")),
                (40, 30, "claude", claude()),
            ]),
            Default::default(),
        );
        assert_eq!(walk(&t, 60).app.pid, 40);
        assert_eq!(*t.1.borrow(), [60, 40]);
    }

    #[test]
    fn transparency_ignores_case_login_dash_and_exe() {
        let hop = |name: &str| Hop {
            pid: 2,
            name: name.to_string(),
            exe: None,
            signer: None,
        };
        for name in ["-zsh", "ZSH.EXE", "Bash", "pwsh.exe", "bw-access"] {
            assert!(is_transparent(&hop(name)), "{name}");
        }
        for name in ["claude", "zshell", "node", "Code.exe"] {
            assert!(!is_transparent(&hop(name)), "{name}");
        }
    }

    #[test]
    fn humanize_identifier() {
        let cases = [
            ("com.anthropic.claude-code", "Claude Code"),
            ("com.example.my_cool-tool", "My Cool Tool"),
            ("cursor", "Cursor"),
            ("com.example.", ""),
        ];
        for (identifier, expected) in cases {
            assert_eq!(humanize(identifier).unwrap_or_default(), expected);
        }
    }

    #[test]
    fn live_chain_starts_at_this_process() {
        let me = std::process::id();
        let r = resolve(me);
        assert_eq!(r.chain.first().map(|h| h.pid), Some(me), "{r:?}");
    }
}
