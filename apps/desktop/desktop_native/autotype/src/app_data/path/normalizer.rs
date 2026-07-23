//! Path normalization for autotype app data.

use tracing::{trace, warn};

use super::platform_policy::PlatformPolicy;

/// Bidirectional path normalizer.
///
/// Maps paths (e.g. `C:\Users\Jane\AppData\Local`) to tokens (e.g. `%LOCALAPPDATA%`)
/// and back, according to a [`PlatformPolicy`].
#[derive(Debug, Clone)]
pub struct PathNormalizer {
    /// `(resolved_path, token)` pairs, canonicalized and sorted by resolved-path length
    /// descending (more specific dirs take precedence over their parents).
    mappings: Vec<(String, String)>,
    policy: PlatformPolicy,
}

impl PathNormalizer {
    /// Build a normalizer from `(resolved_path, token)` pairs under `policy`.
    ///
    /// Both sides of each pair are separator-canonicalized, and the pairs are sorted
    /// longest-resolved-path-first; the caller need not pre-sort them.
    pub fn new(
        mappings: impl IntoIterator<Item = (String, String)>,
        policy: PlatformPolicy,
    ) -> Self {
        let mut mappings: Vec<(String, String)> = mappings
            .into_iter()
            .map(|(resolved, token)| (policy.canonicalize(&resolved), policy.canonicalize(&token)))
            .filter(|(resolved, token)| !resolved.is_empty() && !token.is_empty())
            .collect();

        // Longest resolved path first
        mappings.sort_by_key(|b| std::cmp::Reverse(b.0.len()));

        Self { mappings, policy }
    }

    /// Replace a known-dir prefix with its token.
    /// Returns the (separator-canonicalized) input if no mapping matches.
    ///
    /// `C:\Users\Jane\AppData\Local\App\app.exe` → `%LOCALAPPDATA%\App\app.exe`.
    pub fn normalize(&self, path: &str) -> String {
        let path = self.policy.canonicalize(path);

        for (resolved, token) in &self.mappings {
            if let Some(rest) = match_prefix(&path, resolved, &self.policy) {
                return format!("{token}{rest}");
            }
        }

        path
    }

    /// Inverse of [`normalize`](Self::normalize): replace a leading token with its actual path.
    /// Returns the (separator-canonicalized) input if no token matches.
    ///
    /// `%LOCALAPPDATA%\App\app.exe` → `C:\Users\Jane\AppData\Local\App\app.exe`.
    pub fn denormalize(&self, path: &str) -> String {
        let path = self.policy.canonicalize(path);
        for (resolved, token) in &self.mappings {
            if let Some(rest) = match_prefix(&path, token, &self.policy) {
                return format!("{resolved}{rest}");
            }
        }
        path
    }
}

/// If `path` starts with `prefix` at a path boundary (per `policy`), return the remainder.
/// Otherwise return `None`.
///
/// Both `path` and `prefix` are assumed already separator-canonicalized, and `prefix` non-empty.
/// A "path boundary" means the character after the prefix is end-of-string or a separator,
/// this prevents `C:\Users\John` from matching `C:\Users\JohnDoe\...`.
fn match_prefix<'a>(path: &'a str, prefix: &str, policy: &PlatformPolicy) -> Option<&'a str> {
    if path.len() < prefix.len() {
        trace!("path shorter than prefix; no match");
        return None;
    }
    // Guard against slicing through a multi-byte UTF-8 char (paths are usually ASCII).
    if !path.is_char_boundary(prefix.len()) {
        warn!("path prefix falls on a non-char boundary; skipping");
        return None;
    }

    let (head, rest) = path.split_at(prefix.len());

    let matched = if policy.case_sensitive {
        head == prefix
    } else {
        head.eq_ignore_ascii_case(prefix)
    };

    if !matched {
        trace!("prefix not in path");
        return None;
    }

    match rest.chars().next() {
        None => Some(rest),
        Some(c) if policy.separators.contains(&c) => Some(rest),
        Some(_) => {
            trace!("prefix not at a path boundary");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> PathNormalizer {
        // Intentionally unsorted to exercise PathNormalizer::new's sorting. Includes a nested
        // token to exercise longest-first precedence even though the real Windows builder
        // emits only the three base user dirs.
        PathNormalizer::new(
            [
                (r"C:\Users\Jane".to_string(), "%USERPROFILE%".to_string()),
                (
                    r"C:\Users\Jane\AppData\Local".to_string(),
                    "%LOCALAPPDATA%".to_string(),
                ),
                (
                    r"C:\Users\Jane\AppData\Local\Programs".to_string(),
                    r"%LOCALAPPDATA%\Programs".to_string(),
                ),
                (
                    r"C:\Users\Jane\AppData\Roaming".to_string(),
                    "%APPDATA%".to_string(),
                ),
            ],
            PlatformPolicy::WINDOWS,
        )
    }

    #[test]
    fn basic_substitution() {
        let n = fixture();
        assert_eq!(
            n.normalize(r"C:\Users\Jane\AppData\Roaming\App\config.json"),
            r"%APPDATA%\App\config.json"
        );
    }

    #[test]
    fn longest_prefix_wins() {
        let n = fixture();
        assert_eq!(
            n.normalize(r"C:\Users\Jane\AppData\Local\Programs\MyApp\app.exe"),
            r"%LOCALAPPDATA%\Programs\MyApp\app.exe"
        );
        assert_eq!(
            n.normalize(r"C:\Users\Jane\AppData\Local\Temp\x.tmp"),
            r"%LOCALAPPDATA%\Temp\x.tmp"
        );
        assert_eq!(
            n.normalize(r"C:\Users\Jane\Desktop\notes.txt"),
            r"%USERPROFILE%\Desktop\notes.txt"
        );
    }

    #[test]
    fn boundary_safety() {
        let n = PathNormalizer::new(
            [(r"C:\Users\John".to_string(), "%USERPROFILE%".to_string())],
            PlatformPolicy::WINDOWS,
        );
        // "JohnDoe" must NOT be treated as a match for "John".
        assert_eq!(
            n.normalize(r"C:\Users\JohnDoe\file.txt"),
            r"C:\Users\JohnDoe\file.txt"
        );
        // Exact match (prefix consumes whole path) is fine.
        assert_eq!(n.normalize(r"C:\Users\John"), "%USERPROFILE%");
    }

    #[test]
    fn case_insensitive_prefix_on_windows() {
        let n = fixture();
        assert_eq!(
            n.normalize(r"c:\users\jane\appdata\local\programs\App\app.EXE"),
            r"%LOCALAPPDATA%\Programs\App\app.EXE"
        );
    }

    #[test]
    fn mixed_separators_canonicalize_to_backslash() {
        let n = fixture();
        // Forward-slash input (valid on Windows) normalizes identically to the backslash form.
        assert_eq!(
            n.normalize("C:/Users/Jane/AppData/Local/App/app.exe"),
            r"%LOCALAPPDATA%\App\app.exe"
        );
        // Remainder separators are canonicalized too, not preserved.
        assert_eq!(
            n.normalize(r"C:\Users\Jane\AppData\Local/App/app.exe"),
            r"%LOCALAPPDATA%\App\app.exe"
        );
    }

    #[test]
    fn no_match_passthrough() {
        let n = fixture();
        assert_eq!(n.normalize(r"D:\Games\thing.exe"), r"D:\Games\thing.exe");
        assert_eq!(n.denormalize(r"D:\Games\thing.exe"), r"D:\Games\thing.exe");
    }

    #[test]
    fn denormalize_basic() {
        let n = fixture();
        assert_eq!(
            n.denormalize(r"%LOCALAPPDATA%\Programs\MyApp\app.exe"),
            r"C:\Users\Jane\AppData\Local\Programs\MyApp\app.exe"
        );
        assert_eq!(
            n.denormalize(r"%LOCALAPPDATA%\Temp\x.tmp"),
            r"C:\Users\Jane\AppData\Local\Temp\x.tmp"
        );
    }

    #[test]
    fn denormalize_case_insensitive_token() {
        let n = fixture();
        assert_eq!(
            n.denormalize(r"%localappdata%\App\f.txt"),
            r"C:\Users\Jane\AppData\Local\App\f.txt"
        );
    }

    #[test]
    fn round_trip() {
        let n = fixture();
        for p in [
            r"C:\Users\Jane\AppData\Local\Programs\MyApp\app.exe",
            r"C:\Users\Jane\AppData\Roaming\App\config.json",
            r"C:\Users\Jane\Desktop\notes.txt",
        ] {
            assert_eq!(
                n.denormalize(&n.normalize(p)),
                p,
                "round trip failed for {p}"
            );
        }
    }

    #[test]
    fn empty_mappings_pass_through_unchanged() {
        // Simulates every `dirs` dir resolving to `None`: nothing to substitute.
        let n = PathNormalizer::new(Vec::new(), PlatformPolicy::WINDOWS);
        assert_eq!(
            n.normalize(r"C:\Users\Jane\AppData\Local\App\app.exe"),
            r"C:\Users\Jane\AppData\Local\App\app.exe"
        );
        assert_eq!(
            n.denormalize(r"%LOCALAPPDATA%\App\app.exe"),
            r"%LOCALAPPDATA%\App\app.exe"
        );
    }
}
