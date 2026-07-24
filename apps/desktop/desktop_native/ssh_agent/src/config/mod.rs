//! Hand-authored SSH agent configuration file (`ssh-agent.toml`).
//!
//! Lets users associate vault SSH keys with specific servers, define a global default key set,
//! filter by vault, and scope rules to one or more Bitwarden accounts. When no config file is
//! present the agent offers every vault key, preserving the prior default behaviour.

mod known_hosts;

use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use tracing::{debug, info, warn};

use crate::crypto::PublicKey;

/// Metadata for a single vault SSH key. Carries no private key material.
#[derive(Clone, Debug, PartialEq)]
pub struct KeyMeta {
    pub public_key: PublicKey,
    pub name: String,
    pub cipher_id: String,
    /// Display name of the vault that owns this key ("My vault" for personal, org name for org
    /// vaults).
    pub vault_name: String,
}

/// Parsed `ssh-agent.toml`. Deserialized directly from TOML; each `AccountBlock`'s `resolved`
/// map is populated afterwards by [`SshAgentConfig::resolve_hostnames`].
#[derive(Deserialize, Default)]
pub struct SshAgentConfig {
    #[serde(default, rename = "account")]
    pub accounts: Vec<AccountBlock>,
}

/// One account-scoped rule set. The `email` field scopes it to a single Bitwarden account;
/// omitting `email` makes the block a catch-all that applies when no email-scoped block matches.
#[derive(Deserialize)]
pub struct AccountBlock {
    pub email: Option<String>,
    #[serde(default)]
    pub settings: Settings,
    pub defaults: Option<Defaults>,
    #[serde(default, rename = "hosts")]
    pub host_rules: Vec<HostRule>,
    /// Populated by [`SshAgentConfig::resolve_hostnames`]; not serialized.
    #[serde(skip)]
    resolved: HashMap<String, usize>,
}

#[derive(Deserialize, Default)]
pub struct Settings {
    #[serde(default)]
    pub identities_only: bool,
}

#[derive(Deserialize)]
pub struct Defaults {
    pub keys: Vec<String>,
    pub vault: Option<String>,
}

#[derive(Deserialize)]
pub struct HostRule {
    pub hostname: Option<String>,
    /// Explicit host fingerprint. Takes precedence over a resolved `hostname`.
    pub fingerprint: Option<String>,
    pub keys: Vec<String>,
    pub vault: Option<String>,
}

impl SshAgentConfig {
    /// Reads and parses the config at `path`.
    ///
    /// A missing file is normal and yields defaults silently. A malformed file logs `warn!` and
    /// also yields defaults so the agent still starts.
    #[must_use]
    pub fn load(path: &Path) -> Self {
        let contents = match std::fs::read_to_string(path) {
            Ok(contents) => contents,
            Err(error) => {
                debug!(?path, %error, "SSH agent config not read; using defaults");
                return Self::default();
            }
        };

        match toml::from_str::<Self>(&contents) {
            Ok(config) => {
                info!(
                    ?path,
                    account_block_count = config.accounts.len(),
                    "SSH agent config loaded"
                );
                config
            }
            Err(error) => {
                warn!(%error, "Failed to parse SSH agent config; using defaults");
                Self::default()
            }
        }
    }

    /// Resolves each account block's host rules to fingerprints, populating each block's internal
    /// fingerprint → rule-index map. Rules with an explicit `fingerprint` are used directly;
    /// otherwise the `hostname` is looked up in the parsed `known_hosts` files.
    pub fn resolve_hostnames(&mut self, known_hosts_paths: &[PathBuf]) {
        let candidates: Vec<String> = self
            .accounts
            .iter()
            .flat_map(|block| block.host_rules.iter())
            .filter_map(|rule| rule.hostname.clone())
            .collect();

        let known = known_hosts::parse(known_hosts_paths, &candidates);

        let total_rules: usize = self.accounts.iter().map(|b| b.host_rules.len()).sum();
        let mut total_fingerprints = 0;

        for block in &mut self.accounts {
            block.resolve_hostnames(&known);
            total_fingerprints += block.resolved.len();
        }

        debug!(
            resolved_fingerprint_count = total_fingerprints,
            host_rule_count = total_rules,
            "SSH agent config: hostname resolution complete"
        );
    }

    /// Returns the first account block whose `email` matches `active_email` (case-insensitive),
    /// falling back to the first block with no `email`. Returns `None` if no block matches.
    #[must_use]
    fn find_active_block(&self, active_email: &str) -> Option<&AccountBlock> {
        if let Some(block) = self
            .accounts
            .iter()
            .find(|b| b.email.as_deref().is_some_and(|e| e.eq_ignore_ascii_case(active_email)))
        {
            return Some(block);
        }
        self.accounts.iter().find(|b| b.email.is_none())
    }

    /// Filters `keys` down to those the config permits for the given connection.
    ///
    /// Finds the active account block for `active_email`, then applies that block's host rules,
    /// defaults, and `identities_only` setting. If no block matches, all keys are offered.
    #[must_use]
    pub fn filter_keys(
        &self,
        keys: Vec<KeyMeta>,
        host_fingerprint: Option<&str>,
        active_email: &str,
    ) -> Vec<KeyMeta> {
        match self.find_active_block(active_email) {
            Some(block) => block.filter_keys(keys, host_fingerprint),
            None => {
                debug!(
                    offered_count = keys.len(),
                    "SSH agent config: no account block matches; offering all keys"
                );
                keys
            }
        }
    }
}

impl AccountBlock {
    /// Resolves this block's host rules against a pre-parsed known_hosts map.
    fn resolve_hostnames(&mut self, known: &HashMap<String, Vec<String>>) {
        let mut resolved = HashMap::new();
        for (index, rule) in self.host_rules.iter().enumerate() {
            if let Some(fingerprint) = &rule.fingerprint {
                resolved.insert(fingerprint.clone(), index);
            } else if let Some(hostname) = &rule.hostname {
                match known.get(hostname) {
                    Some(fingerprints) if !fingerprints.is_empty() => {
                        for fingerprint in fingerprints {
                            resolved.insert(fingerprint.clone(), index);
                        }
                    }
                    _ => {
                        warn!(
                            hostname,
                            "SSH agent config: hostname not found in known_hosts; rule skipped"
                        );
                    }
                }
            } else {
                warn!("SSH agent config: host rule has neither hostname nor fingerprint");
            }
        }
        self.resolved = resolved;
    }

    /// Applies this block's host rules and defaults to filter `keys`.
    fn filter_keys(&self, keys: Vec<KeyMeta>, host_fingerprint: Option<&str>) -> Vec<KeyMeta> {
        let matched_rule = host_fingerprint
            .and_then(|fp| self.resolved.get(fp))
            .and_then(|&index| self.host_rules.get(index));

        if let Some(rule) = matched_rule {
            let filtered = filter_by_allowlist(keys.clone(), &rule.keys, rule.vault.as_deref());
            if !filtered.is_empty() || self.settings.identities_only {
                debug!(
                    host_fingerprint,
                    offered_count = filtered.len(),
                    "SSH agent config: host rule matched"
                );
                return filtered;
            }
            debug!(
                host_fingerprint,
                "SSH agent config: host rule matched but no keys passed filter; identities_only=false, offering all keys"
            );
            return keys;
        }

        if let Some(defaults) = &self.defaults {
            let filtered =
                filter_by_allowlist(keys.clone(), &defaults.keys, defaults.vault.as_deref());
            if !filtered.is_empty() || self.settings.identities_only {
                debug!(
                    offered_count = filtered.len(),
                    "SSH agent config: no host rule matched; using defaults"
                );
                return filtered;
            }
            debug!(
                "SSH agent config: defaults matched no keys; identities_only=false, offering all keys"
            );
            return keys;
        }

        if self.settings.identities_only {
            debug!(
                "SSH agent config: identities_only=true with no matching rule or defaults; offering no keys"
            );
            return Vec::new();
        }

        debug!(
            offered_count = keys.len(),
            "SSH agent config: no constraints; offering all keys"
        );
        keys
    }
}

/// Retains keys that match the vault filter (when present) and any of the allowed identifiers.
fn filter_by_allowlist(
    keys: Vec<KeyMeta>,
    allowed: &[String],
    vault: Option<&str>,
) -> Vec<KeyMeta> {
    keys.into_iter()
        .filter(|key| {
            if let Some(vault) = vault {
                if !vault_matches(key, vault) {
                    debug!(
                        key_name = key.name,
                        key_vault = key.vault_name,
                        filter_vault = vault,
                        "SSH agent config: key skipped — vault does not match"
                    );
                    return false;
                }
            }
            if !allowed.iter().any(|id| identifier_matches(key, id)) {
                debug!(
                    key_name = key.name,
                    cipher_id = key.cipher_id,
                    "SSH agent config: key skipped — not in allowed keys list"
                );
                return false;
            }
            true
        })
        .collect()
}

fn vault_matches(key: &KeyMeta, vault: &str) -> bool {
    key.vault_name.eq_ignore_ascii_case(vault)
}

/// A valid UUID is matched against the cipher id; anything else against the display name.
fn identifier_matches(key: &KeyMeta, identifier: &str) -> bool {
    if uuid::Uuid::parse_str(identifier).is_ok() {
        key.cipher_id == identifier
    } else {
        key.name == identifier
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn key(name: &str, cipher_id: &str, vault_name: &str) -> KeyMeta {
        KeyMeta {
            public_key: PublicKey {
                alg: "ssh-ed25519".to_string(),
                blob: name.as_bytes().to_vec(),
            },
            name: name.to_string(),
            cipher_id: cipher_id.to_string(),
            vault_name: vault_name.to_string(),
        }
    }

    const UUID_A: &str = "11111111-1111-1111-1111-111111111111";
    const UUID_B: &str = "22222222-2222-2222-2222-222222222222";

    fn parse(config: &str) -> SshAgentConfig {
        toml::from_str(config).expect("valid test config")
    }

    // ---------------------------------------------------------------------------
    // load()
    // ---------------------------------------------------------------------------

    #[test]
    fn load_absent_file_returns_default() {
        let config = SshAgentConfig::load(Path::new("/nonexistent/ssh-agent.toml"));
        assert!(config.accounts.is_empty());
    }

    #[test]
    fn load_malformed_toml_returns_default() {
        let mut path = std::env::temp_dir();
        path.push(format!("ssh-agent-test-{}.toml", std::process::id()));
        std::fs::write(&path, "this is not = valid = toml [[[").unwrap();

        let config = SshAgentConfig::load(&path);
        let _ = std::fs::remove_file(&path);

        assert!(config.accounts.is_empty());
    }

    // ---------------------------------------------------------------------------
    // find_active_block()
    // ---------------------------------------------------------------------------

    #[test]
    fn find_active_block_none_when_no_accounts() {
        let config = SshAgentConfig::default();
        assert!(config.find_active_block("anyone@example.com").is_none());
    }

    #[test]
    fn find_active_block_matches_email_case_insensitively() {
        let config = parse("[[account]]\nemail = \"User@Example.com\"\n");
        assert!(config.find_active_block("user@example.com").is_some());
        assert!(config.find_active_block("other@example.com").is_none());
    }

    #[test]
    fn find_active_block_returns_catchall_when_no_email_matches() {
        let config = parse(
            "[[account]]\nemail = \"owner@example.com\"\n[[account]]\n# catch-all\n",
        );
        let block = config.find_active_block("other@example.com");
        assert!(block.is_some());
        assert!(block.unwrap().email.is_none());
    }

    #[test]
    fn find_active_block_email_takes_precedence_over_catchall() {
        let config = parse(
            "[[account]]\nemail = \"owner@example.com\"\n[[account]]\n# catch-all\n",
        );
        let block = config.find_active_block("owner@example.com");
        assert!(block.is_some());
        assert_eq!(
            block.unwrap().email.as_deref(),
            Some("owner@example.com")
        );
    }

    // ---------------------------------------------------------------------------
    // filter_keys() — account matching
    // ---------------------------------------------------------------------------

    #[test]
    fn no_accounts_offers_all_keys() {
        let config = SshAgentConfig::default();
        let keys = vec![key("A", UUID_A, "My vault"), key("B", UUID_B, "My vault")];
        let filtered = config.filter_keys(keys.clone(), None, "user@example.com");
        assert_eq!(filtered, keys);
    }

    #[test]
    fn non_matching_account_offers_all_keys() {
        let config = parse(
            "[[account]]\nemail = \"owner@example.com\"\n[[account.hosts]]\nfingerprint = \"SHA256:x\"\nkeys = [\"Only\"]\n",
        );
        let keys = vec![key("A", UUID_A, "My vault"), key("B", UUID_B, "My vault")];
        let filtered =
            config.filter_keys(keys.clone(), Some("SHA256:x"), "someone-else@example.com");
        assert_eq!(filtered, keys);
    }

    #[test]
    fn second_account_block_rules_applied_when_it_matches() {
        let config = parse(
            "[[account]]\nemail = \"work@example.com\"\n[[account.hosts]]\nfingerprint = \"SHA256:x\"\nkeys = [\"Work Key\"]\n\
             [[account]]\nemail = \"personal@example.com\"\n[[account.hosts]]\nfingerprint = \"SHA256:x\"\nkeys = [\"Personal Key\"]\n",
        );
        let keys = vec![
            key("Work Key", UUID_A, "My vault"),
            key("Personal Key", UUID_B, "My vault"),
        ];
        let mut config = config;
        config.resolve_hostnames(&[]);

        let filtered = config.filter_keys(keys, Some("SHA256:x"), "personal@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "Personal Key");
    }

    #[test]
    fn catchall_block_applies_when_no_email_matches() {
        let config = parse(
            "[[account]]\nemail = \"work@example.com\"\n[[account.hosts]]\nfingerprint = \"SHA256:x\"\nkeys = [\"Work Key\"]\n\
             [[account]]\n[[account.hosts]]\nfingerprint = \"SHA256:x\"\nkeys = [\"Shared Key\"]\n",
        );
        let keys = vec![
            key("Work Key", UUID_A, "My vault"),
            key("Shared Key", UUID_B, "My vault"),
        ];
        let mut config = config;
        config.resolve_hostnames(&[]);

        let filtered = config.filter_keys(keys, Some("SHA256:x"), "other@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "Shared Key");
    }

    // ---------------------------------------------------------------------------
    // filter_keys() — host rule and defaults logic
    // ---------------------------------------------------------------------------

    #[test]
    fn matching_fingerprint_selects_host_rule_keys() {
        let mut config =
            parse("[[account]]\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"Prod Key\"]\n");
        config.resolve_hostnames(&[]);
        let keys = vec![
            key("Prod Key", UUID_A, "My vault"),
            key("Other", UUID_B, "My vault"),
        ];
        let filtered = config.filter_keys(keys, Some("SHA256:abc"), "user@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "Prod Key");
    }

    #[test]
    fn no_fingerprint_match_falls_back_to_defaults() {
        let mut config = parse(
            "[[account]]\n[account.defaults]\nkeys = [\"Default Key\"]\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"Prod Key\"]\n",
        );
        config.resolve_hostnames(&[]);
        let keys = vec![
            key("Default Key", UUID_A, "My vault"),
            key("Prod Key", UUID_B, "My vault"),
        ];
        let filtered = config.filter_keys(keys, Some("SHA256:other"), "user@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "Default Key");
    }

    #[test]
    fn identities_only_with_no_match_and_no_defaults_returns_empty() {
        let mut config = parse(
            "[[account]]\n[account.settings]\nidentities_only = true\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"Prod Key\"]\n",
        );
        config.resolve_hostnames(&[]);
        let keys = vec![key("Prod Key", UUID_A, "My vault")];
        let filtered = config.filter_keys(keys, Some("SHA256:other"), "user@example.com");
        assert!(filtered.is_empty());
    }

    #[test]
    fn no_match_without_identities_only_returns_all() {
        let config = parse("[[account]]\n[account.settings]\nidentities_only = false\n");
        let keys = vec![key("A", UUID_A, "My vault")];
        let filtered = config.filter_keys(keys.clone(), None, "user@example.com");
        assert_eq!(filtered, keys);
    }

    #[test]
    fn vault_filter_excludes_non_matching_vault() {
        let mut config = parse(
            "[[account]]\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"A\", \"B\"]\nvault = \"My vault\"\n",
        );
        config.resolve_hostnames(&[]);
        let keys = vec![key("A", UUID_A, "My vault"), key("B", UUID_B, "Acme Corp")];
        let filtered = config.filter_keys(keys, Some("SHA256:abc"), "user@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "A");
    }

    #[test]
    fn vault_org_name_includes_only_matching_org_keys() {
        let mut config = parse(
            "[[account]]\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"A\", \"B\"]\nvault = \"Acme Corp\"\n",
        );
        config.resolve_hostnames(&[]);
        let keys = vec![key("A", UUID_A, "My vault"), key("B", UUID_B, "Acme Corp")];
        let filtered = config.filter_keys(keys, Some("SHA256:abc"), "user@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "B");
    }

    #[test]
    fn key_matched_by_uuid_identifier() {
        let mut config = parse(&format!(
            "[[account]]\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"{UUID_A}\"]\n"
        ));
        config.resolve_hostnames(&[]);
        let keys = vec![
            key("Ignored Name", UUID_A, "My vault"),
            key("Other", UUID_B, "My vault"),
        ];
        let filtered = config.filter_keys(keys, Some("SHA256:abc"), "user@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].cipher_id, UUID_A);
    }

    #[test]
    fn key_matched_by_name_identifier() {
        let mut config =
            parse("[[account]]\n[[account.hosts]]\nfingerprint = \"SHA256:abc\"\nkeys = [\"My Key\"]\n");
        config.resolve_hostnames(&[]);
        let keys = vec![
            key("My Key", UUID_A, "My vault"),
            key("Other", UUID_B, "My vault"),
        ];
        let filtered = config.filter_keys(keys, Some("SHA256:abc"), "user@example.com");
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].name, "My Key");
    }
}
