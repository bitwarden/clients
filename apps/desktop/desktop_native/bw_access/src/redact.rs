//! Streaming scrubber: replaces secrets in a byte stream, including ones split across chunks.

const PLACEHOLDER: &[u8] = b"[redacted]";

pub struct Redactor {
    /// Longest first, so a secret that extends a shorter one is caught whole.
    secrets: Vec<Vec<u8>>,
    pending: Vec<u8>,
}

impl Redactor {
    pub fn new(secrets: impl IntoIterator<Item = String>) -> Self {
        let mut secrets: Vec<Vec<u8>> = secrets
            .into_iter()
            .filter(|secret| !secret.is_empty())
            .map(String::into_bytes)
            .collect();
        secrets.sort_by_key(|secret| std::cmp::Reverse(secret.len()));
        Self {
            secrets,
            pending: Vec::new(),
        }
    }

    /// Holds back only a tail that could still become a secret, so prompts are not delayed.
    pub fn push(&mut self, chunk: &[u8]) -> Vec<u8> {
        self.pending.extend_from_slice(chunk);
        self.drain(false)
    }

    /// Call once at EOF.
    pub fn finish(&mut self) -> Vec<u8> {
        self.drain(true)
    }

    fn drain(&mut self, eof: bool) -> Vec<u8> {
        let mut out = Vec::with_capacity(self.pending.len());
        let mut i = 0;
        while i < self.pending.len() {
            let rest = &self.pending[i..];
            let partial = |secret: &Vec<u8>| secret.len() > rest.len() && secret.starts_with(rest);
            if !eof && self.secrets.iter().any(partial) {
                break;
            }
            match self.secrets.iter().find(|secret| rest.starts_with(secret)) {
                Some(secret) => {
                    out.extend_from_slice(PLACEHOLDER);
                    i += secret.len();
                }
                None => {
                    out.push(rest[0]);
                    i += 1;
                }
            }
        }
        self.pending.drain(..i);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scrub(secrets: &[&str], chunks: &[&str]) -> String {
        let mut redactor = Redactor::new(secrets.iter().map(|s| (*s).to_owned()));
        let mut out: Vec<u8> = chunks
            .iter()
            .flat_map(|chunk| redactor.push(chunk.as_bytes()))
            .collect();
        out.extend(redactor.finish());
        String::from_utf8(out).unwrap()
    }

    #[test]
    fn test_redacts_within_a_chunk() {
        assert_eq!(scrub(&["hunter2"], &["pw=hunter2 ok"]), "pw=[redacted] ok");
    }

    #[test]
    fn test_redacts_across_chunk_boundaries() {
        assert_eq!(
            scrub(&["hunter2"], &["pw=hun", "ter2 ok"]),
            "pw=[redacted] ok"
        );
        assert_eq!(
            scrub(&["hunter2"], &["h", "u", "n", "t", "e", "r", "2"]),
            "[redacted]"
        );
    }

    #[test]
    fn test_prefers_the_longest_secret() {
        assert_eq!(
            scrub(&["abc", "abc123"], &["x=abc", "123!"]),
            "x=[redacted]!"
        );
        assert_eq!(scrub(&["abc", "abc123"], &["x=abc", "!"]), "x=[redacted]!");
    }

    #[test]
    fn test_redacts_every_secret_and_occurrence() {
        assert_eq!(
            scrub(&["hunter2", "123456"], &["hunter2 123456 hunter2"]),
            "[redacted] [redacted] [redacted]"
        );
    }

    #[test]
    fn test_releases_an_unfinished_prefix_at_eof() {
        assert_eq!(scrub(&["hunter2"], &["pw=hunt"]), "pw=hunt");
    }

    #[test]
    fn test_holds_back_only_a_possible_prefix() {
        let mut redactor = Redactor::new(["hunter2".to_owned()]);

        assert_eq!(redactor.push(b"Continue? [y/N] "), b"Continue? [y/N] ");
        assert_eq!(redactor.push(b"ok hun"), b"ok ");
    }

    #[test]
    fn test_ignores_empty_secrets() {
        assert_eq!(scrub(&["", "hunter2"], &["a hunter2"]), "a [redacted]");
    }
}
