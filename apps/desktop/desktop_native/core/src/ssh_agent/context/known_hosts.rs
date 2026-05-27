//! `~/.ssh/known_hosts` loader and matcher.
//!
//! Supports both plain (`hostname [comma,hostname]... keytype base64-key`)
//! entries and hashed (`|1|salt|hmac keytype base64-key`) entries per
//! the OpenSSH file format.

use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use sha1::Sha1;

type HmacSha1 = Hmac<Sha1>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Match {
    pub hostname: String,
}

/// Parse the supplied `known_hosts`-format string and return the first
/// hostname entry whose public-key bytes equal `host_key`. When the matched
/// entry is hashed (`|1|salt|hash`), the returned hostname is recovered by
/// hashing `candidate` and comparing — pass `None` if no candidate is
/// available, in which case hashed matches yield `<hashed>` as the hostname.
pub fn find_match(contents: &str, host_key: &[u8], candidate: Option<&str>) -> Option<Match> {
    if host_key.is_empty() {
        return None;
    }
    for line in contents.lines() {
        if let Some(m) = match_line(line, host_key, candidate) {
            return Some(m);
        }
    }
    None
}

/// Read each candidate file in `paths` (skipping missing/unreadable ones) and
/// return the first match found. See [`find_match`] for the `candidate`
/// semantics.
pub fn find_match_in_files<P: AsRef<Path>>(
    paths: &[P],
    host_key: &[u8],
    candidate: Option<&str>,
) -> Option<Match> {
    for path in paths {
        let Ok(contents) = std::fs::read_to_string(path.as_ref()) else {
            continue;
        };
        if let Some(m) = find_match(&contents, host_key, candidate) {
            return Some(m);
        }
    }
    None
}

fn match_line(line: &str, host_key: &[u8], candidate: Option<&str>) -> Option<Match> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }

    let mut iter = trimmed.split_whitespace();
    let hosts_field = iter.next()?;
    let _keytype = iter.next()?;
    let key_b64 = iter.next()?;

    let key_bytes = STANDARD.decode(key_b64).ok()?;
    if key_bytes != host_key {
        return None;
    }

    if let Some(rest) = hosts_field.strip_prefix("|1|") {
        let (salt_b64, hash_b64) = rest.split_once('|')?;
        STANDARD.decode(salt_b64).ok()?;
        STANDARD.decode(hash_b64).ok()?;
        // A matching key + a hashed host entry is a verified key match. If the
        // caller supplied a candidate hostname (typically from the requester's
        // argv), forward-verify the hash to recover the real hostname.
        if let Some(c) = candidate {
            if verify_hashed_entry(salt_b64, hash_b64, c) {
                return Some(Match {
                    hostname: c.to_string(),
                });
            }
        }
        return Some(Match {
            hostname: "<hashed>".to_string(),
        });
    }

    // Plain entry. The hosts field may be a comma-separated list with
    // optional negations and patterns. Take the first positive, non-pattern
    // entry as the display hostname.
    let first = hosts_field
        .split(',')
        .find(|h| !h.starts_with('!'))?
        .trim_start_matches('@')
        .to_string();
    if first.contains('*') || first.contains('?') {
        return Some(Match { hostname: first });
    }
    Some(Match { hostname: first })
}

/// Verify a hashed entry against a candidate hostname (forward direction,
/// usable when we have an argv-derived hostname AND a hashed known_hosts
/// line that matched on key — confirms the hash). Used in tests today;
/// callers can opt in when both signals exist.
pub fn verify_hashed_entry(salt_b64: &str, hash_b64: &str, candidate: &str) -> bool {
    let Ok(salt) = STANDARD.decode(salt_b64) else {
        return false;
    };
    let Ok(expected) = STANDARD.decode(hash_b64) else {
        return false;
    };
    let Ok(mut mac) = HmacSha1::new_from_slice(&salt) else {
        return false;
    };
    mac.update(candidate.as_bytes());
    mac.verify_slice(&expected).is_ok()
}

#[cfg(test)]
mod tests {
    use base64::{engine::general_purpose::STANDARD, Engine};

    use super::*;

    const KEY_B64: &str = "AAAAC3NzaC1lZDI1NTE5AAAAIA4iivf6TICxdizawaKSZS6GnGZV/aEAZ3ZMrsrA3g32";

    fn key_bytes() -> Vec<u8> {
        STANDARD.decode(KEY_B64).unwrap()
    }

    /// Helper: produce a real OpenSSH-format hashed `known_hosts` entry for
    /// `hostname` using the given key.
    fn hashed_line(hostname: &str, key_b64: &str) -> String {
        let salt = b"some-salt-16byte";
        let mut mac = HmacSha1::new_from_slice(salt).unwrap();
        mac.update(hostname.as_bytes());
        let hash = mac.finalize().into_bytes();
        format!(
            "|1|{}|{} ssh-ed25519 {}\n",
            STANDARD.encode(salt),
            STANDARD.encode(hash),
            key_b64,
        )
    }

    #[test]
    fn empty_host_key_returns_none() {
        assert!(find_match("github.com ssh-ed25519 AAAA", &[], None).is_none());
    }

    #[test]
    fn plain_match_returns_hostname() {
        let contents = format!("github.com ssh-ed25519 {KEY_B64}\n");
        let m = find_match(&contents, &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "github.com");
    }

    #[test]
    fn comma_list_takes_first_positive() {
        let contents = format!("alias,github.com ssh-ed25519 {KEY_B64}\n");
        let m = find_match(&contents, &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "alias");
    }

    #[test]
    fn negation_is_skipped() {
        let contents = format!("!evil,github.com ssh-ed25519 {KEY_B64}\n");
        let m = find_match(&contents, &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "github.com");
    }

    #[test]
    fn comments_and_blanks_ignored() {
        let contents = format!("# leading comment\n\n   \ngithub.com ssh-ed25519 {KEY_B64}\n");
        let m = find_match(&contents, &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "github.com");
    }

    #[test]
    fn no_match_returns_none() {
        let contents = format!("github.com ssh-ed25519 {KEY_B64}\n");
        let other_key = vec![0u8; 32];
        assert!(find_match(&contents, &other_key, None).is_none());
    }

    #[test]
    fn hashed_entry_without_candidate_yields_hashed_placeholder() {
        let contents = hashed_line("github.com", KEY_B64);
        let m = find_match(&contents, &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "<hashed>");
    }

    #[test]
    fn hashed_entry_with_matching_candidate_recovers_hostname() {
        let contents = hashed_line("github.com", KEY_B64);
        let m = find_match(&contents, &key_bytes(), Some("github.com")).unwrap();
        assert_eq!(m.hostname, "github.com");
    }

    #[test]
    fn hashed_entry_with_non_matching_candidate_falls_back_to_placeholder() {
        let contents = hashed_line("github.com", KEY_B64);
        let m = find_match(&contents, &key_bytes(), Some("evil.example.com")).unwrap();
        assert_eq!(m.hostname, "<hashed>");
    }

    #[test]
    fn pattern_entry_returned_verbatim() {
        let contents = format!("*.example.com ssh-ed25519 {KEY_B64}\n");
        let m = find_match(&contents, &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "*.example.com");
    }

    #[test]
    fn missing_file_returns_none() {
        let path = Path::new("/nonexistent/path/known_hosts");
        assert!(find_match_in_files(&[path], &key_bytes(), None).is_none());
    }

    #[test]
    fn multiple_files_first_match_wins() {
        let dir = tempfile::tempdir().unwrap();
        let p1 = dir.path().join("first");
        let p2 = dir.path().join("second");
        std::fs::write(&p1, format!("first.example.com ssh-ed25519 {KEY_B64}\n")).unwrap();
        std::fs::write(&p2, format!("second.example.com ssh-ed25519 {KEY_B64}\n")).unwrap();
        let m = find_match_in_files(&[&p1, &p2], &key_bytes(), None).unwrap();
        assert_eq!(m.hostname, "first.example.com");
    }

    #[test]
    fn verify_hashed_entry_roundtrip() {
        // Build a real hashed entry for "github.com" and verify it matches.
        let salt = b"some-salt-16byte";
        let mut mac = HmacSha1::new_from_slice(salt).unwrap();
        mac.update(b"github.com");
        let hash = mac.finalize().into_bytes();
        let salt_b64 = STANDARD.encode(salt);
        let hash_b64 = STANDARD.encode(hash);
        assert!(verify_hashed_entry(&salt_b64, &hash_b64, "github.com"));
        assert!(!verify_hashed_entry(
            &salt_b64,
            &hash_b64,
            "evil.example.com"
        ));
    }
}
