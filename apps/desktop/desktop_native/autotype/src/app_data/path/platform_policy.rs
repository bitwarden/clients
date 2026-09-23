//! Per-target-platform path conventions consulted by the [normalizer](super::normalizer).

/// Separator and case conventions for a target platform's paths.
#[derive(Debug, Clone, Copy)]
pub struct PlatformPolicy {
    /// Canonical separator; all separators are rewritten to this.
    pub canonical_sep: char,
    /// Characters treated as path separators.
    pub separators: &'static [char],
    /// Whether prefix matching is case-sensitive.
    pub case_sensitive: bool,
}

impl PlatformPolicy {
    pub const WINDOWS: Self = Self {
        canonical_sep: '\\',
        separators: &['\\', '/'],
        case_sensitive: false,
    };

    /// Rewrite every recognized separator in `s` to `canonical_sep`.
    pub(super) fn canonicalize(&self, s: &str) -> String {
        s.chars()
            .map(|c| {
                if self.separators.contains(&c) {
                    self.canonical_sep
                } else {
                    c
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalize_rewrites_all_separators_to_canonical() {
        let policy = PlatformPolicy::WINDOWS;
        // Both `/` and `\` collapse to the canonical backslash.
        assert_eq!(
            policy.canonicalize("C:/Users\\Jane/AppData"),
            r"C:\Users\Jane\AppData"
        );
        assert_eq!(policy.canonicalize("a/b/c"), r"a\b\c");
    }

    #[test]
    fn canonicalize_leaves_non_separators_untouched() {
        let policy = PlatformPolicy::WINDOWS;
        assert_eq!(policy.canonicalize(r"C:\Users\Jane"), r"C:\Users\Jane");
        assert_eq!(policy.canonicalize("no-seps"), "no-seps");
        assert_eq!(policy.canonicalize(""), "");
    }
}
