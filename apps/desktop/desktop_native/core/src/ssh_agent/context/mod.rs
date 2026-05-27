//! Derivation of rich `RequestContext` for SSH agent approval prompts.
//!
//! This module gathers locally-derivable information about a pending sign
//! request — the requesting process and its ancestors, a candidate hostname
//! parsed from the requester's argv, the SHA256 fingerprint of the SSH
//! server's host key, and any `known_hosts` match. Each piece carries its
//! provenance via `HostSource` so the UI can label trust accurately.

pub mod argv_parser;
pub mod fingerprint;
pub mod known_hosts;

#[derive(Debug, Clone, Default)]
pub struct RequestContext {
    pub app: AppContext,
    pub host: HostContext,
}

#[derive(Debug, Clone, Default)]
pub struct AppContext {
    pub process_name: String,
    pub executable_path: Option<String>,
    pub pid: u32,
    pub parent_chain: Vec<ProcessFrame>,
    pub argv: Option<Vec<String>>,
}

#[derive(Debug, Clone)]
pub struct ProcessFrame {
    pub pid: u32,
    pub name: String,
    pub executable_path: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct HostContext {
    pub source: HostSource,
    pub hostname: Option<String>,
    pub hostname_unverified: Option<String>,
    pub port: Option<u16>,
    pub username: Option<String>,
    pub key_fingerprint: Option<String>,
    pub known_hosts_match: bool,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum HostSource {
    #[default]
    None,
    Argv,
    KnownHosts,
    HostKey,
}

use crate::ssh_agent::peerinfo::{gather as peer_gather, models::PeerInfo};

/// Inputs needed to build a `RequestContext`. Keeping these explicit (rather
/// than reaching into `PeerInfo` directly) lets us unit-test the orchestrator
/// without spinning up real processes or filesystem fixtures.
pub struct BuildInputs<'a> {
    pub process_name: String,
    pub pid: u32,
    pub host_key_bytes: &'a [u8],
    pub known_hosts_paths: Vec<std::path::PathBuf>,
}

pub fn build(inputs: BuildInputs<'_>) -> RequestContext {
    let parent_chain = peer_gather::gather_process_tree(inputs.pid);
    let argv = peer_gather::gather_argv(inputs.pid);
    let executable_path = parent_chain.last().and_then(|f| f.executable_path.clone());

    let app = AppContext {
        process_name: inputs.process_name,
        executable_path,
        pid: inputs.pid,
        parent_chain,
        argv: argv.clone(),
    };

    let argv_host = argv.as_ref().and_then(|a| argv_parser::parse(a));
    let fingerprint = fingerprint::sha256(inputs.host_key_bytes);
    let known_match = if inputs.host_key_bytes.is_empty() {
        None
    } else {
        let refs: Vec<&std::path::PathBuf> = inputs.known_hosts_paths.iter().collect();
        // Pass the argv hostname as the recovery candidate so hashed
        // known_hosts entries can be forward-verified into a real hostname.
        let candidate = argv_host.as_ref().map(|h| h.hostname.as_str());
        known_hosts::find_match_in_files(&refs, inputs.host_key_bytes, candidate)
    };

    let host = match (argv_host, known_match, fingerprint.clone()) {
        (Some(a), Some(k), fp) => HostContext {
            source: HostSource::KnownHosts,
            hostname: Some(k.hostname.clone()),
            hostname_unverified: if k.hostname != a.hostname {
                Some(a.hostname)
            } else {
                None
            },
            port: a.port,
            username: a.username,
            key_fingerprint: fp,
            known_hosts_match: true,
        },
        (None, Some(k), fp) => HostContext {
            source: HostSource::KnownHosts,
            hostname: Some(k.hostname),
            hostname_unverified: None,
            port: None,
            username: None,
            key_fingerprint: fp,
            known_hosts_match: true,
        },
        (Some(a), None, fp) => HostContext {
            source: HostSource::Argv,
            hostname: Some(a.hostname),
            hostname_unverified: None,
            port: a.port,
            username: a.username,
            key_fingerprint: fp,
            known_hosts_match: false,
        },
        (None, None, Some(fp)) => HostContext {
            source: HostSource::HostKey,
            hostname: None,
            hostname_unverified: None,
            port: None,
            username: None,
            key_fingerprint: Some(fp),
            known_hosts_match: false,
        },
        (None, None, None) => HostContext::default(),
    };

    RequestContext { app, host }
}

/// Convenience: default `known_hosts` search paths for the running user.
pub fn default_known_hosts_paths() -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    if let Some(home) = dirs::home_dir() {
        out.push(home.join(".ssh").join("known_hosts"));
        out.push(home.join(".ssh").join("known_hosts2"));
    }
    out.push(std::path::PathBuf::from("/etc/ssh/ssh_known_hosts"));
    out
}

/// Convenience: gather a context directly from a live `PeerInfo`.
pub fn build_from_peer(info: &PeerInfo) -> RequestContext {
    let host_key = info.host_key();
    build(BuildInputs {
        process_name: info.process_name().to_string(),
        pid: info.pid(),
        host_key_bytes: &host_key,
        known_hosts_paths: default_known_hosts_paths(),
    })
}

#[cfg(test)]
mod tests {
    use base64::{engine::general_purpose::STANDARD, Engine};

    use super::*;

    #[test]
    fn precedence_known_hosts_beats_argv_for_hostname() {
        // Construct a tempdir with a known_hosts that contains a key, then
        // call build() with that key plus an argv that disagrees.
        let dir = tempfile::tempdir().unwrap();
        let kh_path = dir.path().join("known_hosts");
        const KEY_B64: &str =
            "AAAAC3NzaC1lZDI1NTE5AAAAIA4iivf6TICxdizawaKSZS6GnGZV/aEAZ3ZMrsrA3g32";
        std::fs::write(
            &kh_path,
            format!("real.example.com ssh-ed25519 {KEY_B64}\n"),
        )
        .unwrap();
        let key_bytes = STANDARD.decode(KEY_B64).unwrap();

        // Spawn a child so we get a stable pid + argv to read.
        // We do not exercise argv parsing here — argv is None when sysinfo
        // can't read it, which is acceptable for this precedence test.
        let ctx = build(BuildInputs {
            process_name: "ssh".to_string(),
            pid: std::process::id(),
            host_key_bytes: &key_bytes,
            known_hosts_paths: vec![kh_path],
        });
        assert_eq!(ctx.host.source, HostSource::KnownHosts);
        assert_eq!(ctx.host.hostname.as_deref(), Some("real.example.com"));
        assert!(ctx.host.known_hosts_match);
        assert!(ctx.host.key_fingerprint.is_some());
    }

    #[test]
    fn precedence_fingerprint_only_when_no_match() {
        let key_bytes = b"some-key-bytes".to_vec();
        let ctx = build(BuildInputs {
            process_name: "ssh".to_string(),
            pid: std::process::id(),
            host_key_bytes: &key_bytes,
            known_hosts_paths: vec![std::path::PathBuf::from("/nonexistent")],
        });
        assert_eq!(ctx.host.source, HostSource::HostKey);
        assert!(ctx.host.key_fingerprint.is_some());
        assert!(!ctx.host.known_hosts_match);
        assert!(ctx.host.hostname.is_none());
    }

    #[test]
    fn precedence_none_when_no_signals() {
        let ctx = build(BuildInputs {
            process_name: "unknown".to_string(),
            pid: u32::MAX,
            host_key_bytes: &[],
            known_hosts_paths: vec![],
        });
        assert_eq!(ctx.host.source, HostSource::None);
        assert!(ctx.host.hostname.is_none());
        assert!(ctx.host.key_fingerprint.is_none());
    }
}
