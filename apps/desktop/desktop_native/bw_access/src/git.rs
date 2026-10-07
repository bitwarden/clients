//! git's credential helper protocol: `key=value` lines in, `username`/`password` out.

use std::{collections::HashMap, io::BufRead};

use agent_access::protocol::{CredentialData, CredentialQuery, Purpose};
use anyhow::{Context as _, Result};

/// Reads until a blank line or EOF.
pub fn read(input: impl BufRead) -> Result<HashMap<String, String>> {
    let mut attributes = HashMap::new();
    for line in input.lines() {
        let line = line?;
        if line.is_empty() {
            break;
        }
        if let Some((key, value)) = line.split_once('=') {
            attributes.insert(key.to_owned(), value.to_owned());
        }
    }
    Ok(attributes)
}

pub fn query(attributes: &HashMap<String, String>) -> Result<(CredentialQuery, Purpose)> {
    let host = attributes.get("host").context("git sent no host")?;
    let protocol = attributes.get("protocol").map_or("https", String::as_str);
    let domain = host
        .rsplit_once(':')
        .filter(|(_, port)| port.chars().all(|c| c.is_ascii_digit()))
        .map_or(host.as_str(), |(domain, _)| domain);
    let purpose = Purpose {
        command: Some(format!("git credential for {protocol}://{host}")),
        ..Default::default()
    };
    Ok((CredentialQuery::Domain(domain.to_owned()), purpose))
}

pub fn answer(credential: &CredentialData) -> String {
    [
        ("username", &credential.username),
        ("password", &credential.password),
    ]
    .into_iter()
    .filter_map(|(key, value)| Some(format!("{key}={}\n", value.as_deref()?)))
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reads_until_a_blank_line() {
        let input = "protocol=https\nhost=github.com\nwwwauth[]=Basic\n\nhost=ignored\n";

        let attributes = read(input.as_bytes()).unwrap();

        assert_eq!(attributes.len(), 3);
        assert_eq!(attributes["host"], "github.com");
    }

    #[test]
    fn test_queries_the_host_without_its_port() {
        for (host, domain) in [
            ("github.com", "github.com"),
            ("git.corp:8443", "git.corp"),
            ("[::1]:8080", "[::1]"),
            ("[::1]", "[::1]"),
        ] {
            let attributes = HashMap::from([
                ("protocol".to_owned(), "https".to_owned()),
                ("host".to_owned(), host.to_owned()),
            ]);

            let (query, purpose) = query(&attributes).unwrap();

            assert_eq!(query, CredentialQuery::Domain(domain.into()));
            let command = format!("git credential for https://{host}");
            assert_eq!(purpose.command, Some(command));
        }
    }

    #[test]
    fn test_needs_a_host() {
        assert!(query(&HashMap::new()).is_err());
    }

    #[test]
    fn test_answers_with_the_fields_it_has() {
        let credential = CredentialData {
            username: Some("me".into()),
            password: Some("hunter2".into()),
            totp: Some("123456".into()),
            ..Default::default()
        };

        assert_eq!(answer(&credential), "username=me\npassword=hunter2\n");
        assert_eq!(answer(&CredentialData::default()), "");
    }
}
