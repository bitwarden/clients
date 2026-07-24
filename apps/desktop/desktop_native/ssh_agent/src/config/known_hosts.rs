//! Minimal `known_hosts` parser used to resolve config `hostname` entries to host-key
//! fingerprints.
//!
//! Both plain-text and hashed (`HashKnownHosts`) entries are supported. Hashed entries hide the
//! plaintext hostname, so they can only be resolved against a known set of candidate hostnames
//! (the ones referenced by the config).

use std::{collections::HashMap, path::PathBuf};

use base64::{prelude::BASE64_STANDARD, Engine as _};
use hmac::{Hmac, Mac as _};
use sha1::Sha1;
use ssh_key::{HashAlg, PublicKey};
use tracing::debug;

type HmacSha1 = Hmac<Sha1>;

/// Parses the given `known_hosts` files, merging results into a map of hostname → SHA-256
/// fingerprints (`SHA256:...`).
///
/// `candidate_hostnames` are the hostnames referenced by the config. They are required to resolve
/// hashed entries, whose plaintext hostname is not recoverable from the file.
///
/// Never returns an error: unreadable files, malformed lines, and unrecognised formats are
/// skipped (with a `debug!` for the latter).
pub(super) fn parse(
    paths: &[PathBuf],
    candidate_hostnames: &[String],
) -> HashMap<String, Vec<String>> {
    let mut resolved: HashMap<String, Vec<String>> = HashMap::new();

    for path in paths {
        let Ok(contents) = std::fs::read_to_string(path) else {
            debug!(?path, "known_hosts file not readable, skipping");
            continue;
        };
        let line_count = contents.lines().count();
        debug!(?path, line_count, "reading known_hosts file");
        for line in contents.lines() {
            parse_line(line, candidate_hostnames, &mut resolved);
        }
    }

    debug!(
        resolved_hostname_count = resolved.len(),
        "known_hosts parsing complete"
    );
    resolved
}

fn parse_line(line: &str, candidates: &[String], resolved: &mut HashMap<String, Vec<String>>) {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') {
        return;
    }

    let fields: Vec<&str> = line.split_whitespace().collect();
    // Marker entries (`@cert-authority`, `@revoked`) carry an extra leading field and are not
    // usable for direct host-key matching.
    if fields.first().is_some_and(|f| f.starts_with('@')) {
        debug!("skipping marked known_hosts entry");
        return;
    }

    // Expected layout: <hosts> <algorithm> <base64 key>
    let (Some(&host_field), Some(&key_b64)) = (fields.first(), fields.get(2)) else {
        debug!("unrecognised known_hosts line format");
        return;
    };

    let Some(fingerprint) = fingerprint_from_b64(key_b64) else {
        debug!("failed to derive fingerprint from known_hosts key blob");
        return;
    };

    if let Some(rest) = host_field.strip_prefix("|1|") {
        resolve_hashed(rest, &fingerprint, candidates, resolved);
    } else {
        for host in host_field.split(',') {
            let hostname = normalize_host(host);
            if !hostname.is_empty() {
                resolved
                    .entry(hostname)
                    .or_default()
                    .push(fingerprint.clone());
            }
        }
    }
}

/// Strips optional `[host]:port` bracket/port syntax, returning the bare hostname.
fn normalize_host(host: &str) -> String {
    let host = host.trim();
    if let Some(stripped) = host.strip_prefix('[') {
        if let Some((inner, _port)) = stripped.split_once("]:") {
            return inner.to_string();
        }
    }
    host.to_string()
}

/// Resolves a hashed entry (`|1|<base64 salt>|<base64 hmac>`) against the candidate hostnames by
/// recomputing `HMAC-SHA1(salt, hostname)` and comparing to the stored digest.
fn resolve_hashed(
    rest: &str,
    fingerprint: &str,
    candidates: &[String],
    resolved: &mut HashMap<String, Vec<String>>,
) {
    let Some((salt_b64, hash_b64)) = rest.split_once('|') else {
        debug!("malformed hashed known_hosts entry");
        return;
    };

    let (Ok(salt), Ok(expected)) = (
        BASE64_STANDARD.decode(salt_b64),
        BASE64_STANDARD.decode(hash_b64),
    ) else {
        debug!("failed to decode hashed known_hosts entry");
        return;
    };

    for hostname in candidates {
        let Ok(mut mac) = HmacSha1::new_from_slice(&salt) else {
            continue;
        };
        mac.update(hostname.as_bytes());
        if mac.verify_slice(&expected).is_ok() {
            debug!(hostname, "resolved hashed known_hosts entry to fingerprint");
            resolved
                .entry(hostname.clone())
                .or_default()
                .push(fingerprint.to_string());
        }
    }
}

fn fingerprint_from_b64(key_b64: &str) -> Option<String> {
    let blob = BASE64_STANDARD.decode(key_b64).ok()?;
    let public_key = PublicKey::from_bytes(&blob).ok()?;
    Some(public_key.fingerprint(HashAlg::Sha256).to_string())
}

#[cfg(test)]
mod tests {
    use std::io::Write as _;

    use ssh_key::{private::Ed25519Keypair, rand_core::OsRng, PrivateKey};

    use super::*;

    // Produces (openssh-authorized-keys line, SHA256 fingerprint) for a fresh Ed25519 key.
    fn random_host_key() -> (String, String) {
        let keypair = Ed25519Keypair::random(&mut OsRng);
        let private = PrivateKey::new(ssh_key::private::KeypairData::Ed25519(keypair), "").unwrap();
        let public = private.public_key();
        let openssh = public.to_openssh().unwrap();
        // openssh format: "ssh-ed25519 <base64> [comment]"
        let b64 = openssh.split_whitespace().nth(1).unwrap().to_string();
        let fingerprint = public.fingerprint(HashAlg::Sha256).to_string();
        (b64, fingerprint)
    }

    fn write_temp(contents: &str) -> PathBuf {
        use std::sync::atomic::{AtomicU32, Ordering};
        static COUNTER: AtomicU32 = AtomicU32::new(0);

        let mut path = std::env::temp_dir();
        path.push(format!(
            "known_hosts_test_{}_{}",
            std::process::id(),
            COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        let mut file = std::fs::File::create(&path).unwrap();
        file.write_all(contents.as_bytes()).unwrap();
        path
    }

    #[test]
    fn plaintext_entry_resolves_to_fingerprint() {
        let (b64, fingerprint) = random_host_key();
        let path = write_temp(&format!("github.com ssh-ed25519 {b64}\n"));

        let resolved = parse(&[path.clone()], &[]);
        let _ = std::fs::remove_file(&path);

        assert_eq!(resolved.get("github.com"), Some(&vec![fingerprint]));
    }

    #[test]
    fn comma_separated_hostnames_all_resolve() {
        let (b64, fingerprint) = random_host_key();
        let path = write_temp(&format!("github.com,140.82.121.4 ssh-ed25519 {b64}\n"));

        let resolved = parse(&[path.clone()], &[]);
        let _ = std::fs::remove_file(&path);

        assert_eq!(resolved.get("github.com"), Some(&vec![fingerprint.clone()]));
        assert_eq!(resolved.get("140.82.121.4"), Some(&vec![fingerprint]));
    }

    #[test]
    fn bracketed_port_hostname_is_normalized() {
        let (b64, fingerprint) = random_host_key();
        let path = write_temp(&format!("[git.example.com]:2222 ssh-ed25519 {b64}\n"));

        let resolved = parse(&[path.clone()], &[]);
        let _ = std::fs::remove_file(&path);

        assert_eq!(resolved.get("git.example.com"), Some(&vec![fingerprint]));
    }

    #[test]
    fn comments_and_blank_lines_are_skipped() {
        let (b64, fingerprint) = random_host_key();
        let path = write_temp(&format!(
            "# a comment\n\n   \ngithub.com ssh-ed25519 {b64}\n"
        ));

        let resolved = parse(&[path.clone()], &[]);
        let _ = std::fs::remove_file(&path);

        assert_eq!(resolved.get("github.com"), Some(&vec![fingerprint]));
    }

    #[test]
    fn marker_entries_are_skipped() {
        let (b64, _fingerprint) = random_host_key();
        let path = write_temp(&format!("@cert-authority github.com ssh-ed25519 {b64}\n"));

        let resolved = parse(&[path.clone()], &[]);
        let _ = std::fs::remove_file(&path);

        assert!(resolved.is_empty());
    }

    #[test]
    fn hashed_entry_resolves_for_candidate_hostname() {
        let (b64, fingerprint) = random_host_key();

        // Compute a hashed host entry for "github.com".
        let salt = [7u8; 20];
        let mut mac = HmacSha1::new_from_slice(&salt).unwrap();
        mac.update(b"github.com");
        let digest = mac.finalize().into_bytes();
        let host_field = format!(
            "|1|{}|{}",
            BASE64_STANDARD.encode(salt),
            BASE64_STANDARD.encode(digest)
        );
        let path = write_temp(&format!("{host_field} ssh-ed25519 {b64}\n"));

        let resolved = parse(&[path.clone()], &["github.com".to_string()]);
        let _ = std::fs::remove_file(&path);

        assert_eq!(resolved.get("github.com"), Some(&vec![fingerprint]));
    }

    #[test]
    fn hashed_entry_not_resolved_without_matching_candidate() {
        let (b64, _fingerprint) = random_host_key();

        let salt = [7u8; 20];
        let mut mac = HmacSha1::new_from_slice(&salt).unwrap();
        mac.update(b"github.com");
        let digest = mac.finalize().into_bytes();
        let host_field = format!(
            "|1|{}|{}",
            BASE64_STANDARD.encode(salt),
            BASE64_STANDARD.encode(digest)
        );
        let path = write_temp(&format!("{host_field} ssh-ed25519 {b64}\n"));

        let resolved = parse(&[path.clone()], &["other.example.com".to_string()]);
        let _ = std::fs::remove_file(&path);

        assert!(resolved.is_empty());
    }

    #[test]
    fn missing_file_returns_empty_map() {
        let resolved = parse(&[PathBuf::from("/nonexistent/known_hosts")], &[]);
        assert!(resolved.is_empty());
    }

    #[test]
    fn malformed_key_blob_is_skipped() {
        let path = write_temp("github.com ssh-ed25519 not-valid-base64!!!\n");
        let resolved = parse(&[path.clone()], &[]);
        let _ = std::fs::remove_file(&path);
        assert!(resolved.is_empty());
    }
}
