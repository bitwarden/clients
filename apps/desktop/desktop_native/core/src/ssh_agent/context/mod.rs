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
