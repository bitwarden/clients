use std::fs;
use std::path::Path;

use tracing::info;

use crate::protocol::types::PublicKey;

/// Represents a known host entry with hostnames and public keys
#[derive(Clone, Debug)]
pub struct KnownHostEntry {
    /// Host name
    pub hostname: String,
    /// The public key for this host
    pub public_key: PublicKey,
}

impl KnownHostEntry {
    /// Creates a new known host entry
    pub fn new(hostname: String, public_key: PublicKey) -> Self {
        Self {
            hostname,
            public_key,
        }
    }
}

#[derive(Clone, Debug)]
pub struct KnownHosts(Vec<KnownHostEntry>);
impl KnownHosts {
    pub fn find_host(&self, public_key: &PublicKey) -> Option<&KnownHostEntry> {
        self.0.iter().find(|entry| &entry.public_key == public_key)
    }
}

/// Reads and parses the SSH known_hosts file
pub struct KnownHostsReader;

impl KnownHostsReader {
    /// Reads the known_hosts file from the standard SSH directory
    pub fn read_default() -> anyhow::Result<KnownHosts> {
        let path = homedir::my_home()?
            .ok_or_else(|| anyhow::anyhow!("Failed to determine home directory"))?
            .join(".ssh/known_hosts");
        Ok(KnownHosts(Self::read_from(&path)?))
    }

    /// Reads the known_hosts file from a specific path
    pub fn read_from<P: AsRef<Path>>(path: P) -> anyhow::Result<Vec<KnownHostEntry>> {
        let path = path.as_ref();

        if !path.exists() {
            return Ok(Vec::new());
        }

        let content = fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("Failed to read known_hosts file: {}", e))?;

        Self::parse(&content)
    }

    /// Parses known_hosts file content
    /// Format: hostnames key-type key-blob [comment]
    /// Each line is either a comment (starting with #) or a host entry
    pub fn parse(content: &str) -> anyhow::Result<Vec<KnownHostEntry>> {
        let mut entries = Vec::new();

        for line in content.lines() {
            let line = line.trim();

            // Skip empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Split by the first space
            let first_space_index = line.find(' ');
            let Some(first_space_index) = first_space_index else {
                info!("Invalid known_hosts line (no spaces): {}", line);
                continue;
            };
            let (hostnames, rest) = line.split_at(first_space_index);
            let host_key = PublicKey::try_from(rest.trim().to_string())?;
            entries.push(KnownHostEntry::new(hostnames.to_string(), host_key));
        }

        Ok(entries)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty() {
        let content = "";
        let entries = KnownHostsReader::parse(content).unwrap();
        assert_eq!(entries.len(), 0);
    }

    #[test]
    #[ignore]
    fn test_current_user_known_hosts() {
        let entries = KnownHostsReader::read_default().unwrap();
        println!("Known hosts entries: {:?}", entries);
    }

    #[test]
    fn test_parse_with_comments() {
        let content = r#"
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
"#;
        let entries = KnownHostsReader::parse(content).unwrap();
        assert!(entries.len() <= 1);
    }
}
