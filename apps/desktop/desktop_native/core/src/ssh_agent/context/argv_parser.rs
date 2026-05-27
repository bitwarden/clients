//! Parse OpenSSH client argv into a (username, hostname, port) candidate.
//!
//! Argv is supplied by the requesting process — it is **untrusted**. The
//! caller must surface results behind a clearly-labeled trust badge.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostCandidate {
    pub username: Option<String>,
    pub hostname: String,
    pub port: Option<u16>,
}

/// Return `Some(HostCandidate)` if `argv` looks like an OpenSSH client
/// invocation (`ssh`, `sftp`, or `scp`) targeting a host; `None` otherwise.
pub fn parse(argv: &[String]) -> Option<HostCandidate> {
    let exe = argv.first()?;
    let exe_basename = exe.rsplit(['/', '\\']).next()?.to_lowercase();
    let exe_basename = exe_basename
        .strip_suffix(".exe")
        .unwrap_or(&exe_basename)
        .to_string();
    if !matches!(exe_basename.as_str(), "ssh" | "scp" | "sftp") {
        return None;
    }

    let is_scp = exe_basename == "scp";

    // Flag → value lookup. We only care about flags that change the (user, port);
    // every other OpenSSH flag is harmless to skip-past so long as we recognize
    // whether it takes a value.
    const FLAGS_WITH_VALUE: &[&str] = &[
        "-l", "-p", "-i", "-o", "-b", "-c", "-D", "-e", "-F", "-I", "-J", "-L", "-m", "-O", "-Q",
        "-R", "-S", "-W", "-w", "-E", "-P",
    ];

    let mut username: Option<String> = None;
    let mut port: Option<u16> = None;
    let mut positional: Vec<String> = Vec::new();
    let mut idx = 1;
    let mut saw_double_dash = false;
    while idx < argv.len() {
        let token = &argv[idx];
        if !saw_double_dash && token == "--" {
            saw_double_dash = true;
            idx += 1;
            continue;
        }
        if !saw_double_dash && token.starts_with('-') && token.len() > 1 {
            if token == "-l" && idx + 1 < argv.len() {
                username = Some(argv[idx + 1].clone());
                idx += 2;
                continue;
            }
            // scp's -P is the port flag (ssh uses -p)
            if (token == "-p" || (is_scp && token == "-P")) && idx + 1 < argv.len() {
                port = argv[idx + 1].parse().ok();
                idx += 2;
                continue;
            }
            if FLAGS_WITH_VALUE.contains(&token.as_str()) {
                idx += 2;
                continue;
            }
            idx += 1;
            continue;
        }
        positional.push(token.clone());
        idx += 1;
    }

    // For ssh/sftp the host is the first positional; for scp it is the first
    // positional that contains a remote-path colon (`host:/path` or
    // `user@host:/path`).
    let host_token = if is_scp {
        positional.iter().find(|p| p.contains(':')).cloned()?
    } else {
        positional.into_iter().next()?
    };

    let host_part = host_token.split(':').next()?;
    let (user_from_host, hostname) = match host_part.split_once('@') {
        Some((u, h)) => (Some(u.to_string()), h.to_string()),
        None => (None, host_part.to_string()),
    };

    if hostname.is_empty() {
        return None;
    }

    Some(HostCandidate {
        username: username.or(user_from_host),
        hostname,
        port,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn argv(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn ssh_user_at_host() {
        let got = parse(&argv(&["ssh", "user@host"])).unwrap();
        assert_eq!(got.username.as_deref(), Some("user"));
        assert_eq!(got.hostname, "host");
        assert_eq!(got.port, None);
    }

    #[test]
    fn ssh_with_flags() {
        let got = parse(&argv(&[
            "ssh",
            "-l",
            "user",
            "-p",
            "2222",
            "host.example.com",
        ]))
        .unwrap();
        assert_eq!(got.username.as_deref(), Some("user"));
        assert_eq!(got.hostname, "host.example.com");
        assert_eq!(got.port, Some(2222));
    }

    #[test]
    fn ssh_bare_host() {
        let got = parse(&argv(&["ssh", "host"])).unwrap();
        assert_eq!(got.username, None);
        assert_eq!(got.hostname, "host");
    }

    #[test]
    fn ssh_double_dash_separator() {
        let got = parse(&argv(&["ssh", "--", "-weird-host"])).unwrap();
        assert_eq!(got.hostname, "-weird-host");
    }

    #[test]
    fn scp_with_remote_path() {
        let got = parse(&argv(&["scp", "file.txt", "user@host:/remote/path"])).unwrap();
        assert_eq!(got.username.as_deref(), Some("user"));
        assert_eq!(got.hostname, "host");
    }

    #[test]
    fn sftp_user_at_host() {
        let got = parse(&argv(&["sftp", "user@host"])).unwrap();
        assert_eq!(got.username.as_deref(), Some("user"));
        assert_eq!(got.hostname, "host");
    }

    #[test]
    fn non_ssh_invocation_returns_none() {
        assert!(parse(&argv(&["git", "push"])).is_none());
        assert!(parse(&argv(&["curl", "https://example.com"])).is_none());
    }

    #[test]
    fn empty_argv_returns_none() {
        assert!(parse(&argv(&[])).is_none());
    }

    #[test]
    fn ssh_with_only_flags_no_host() {
        assert!(parse(&argv(&["ssh", "-V"])).is_none());
    }

    #[test]
    fn full_path_to_ssh_is_recognized() {
        let got = parse(&argv(&["/usr/bin/ssh", "user@host"])).unwrap();
        assert_eq!(got.hostname, "host");
    }
}
