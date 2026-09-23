//! The first frame `desktop_proxy` sends the desktop app, telling it which client spawned the
//! proxy. Every client spawns the proxy the same way, so the socket alone cannot tell them apart;
//! their launch arguments can.
//!
//! ```text
//! CLI       --client=cli
//!           -> {"clientType":"cli"}
//! Chrome    chrome-extension://nngceckbapebfimnlniiiahkandclblb/ [--parent-window=1234]
//!           -> {"clientType":"chrome","extensionId":"nngceckbapebfimnlniiiahkandclblb"}
//! Firefox   /path/to/com.8bit.bitwarden.json {446900e4-71c2-419f-a6a7-df9c091e268b}
//!           -> {"clientType":"firefox","extensionId":"{446900e4-...}"}
//! other     -> {"clientType":"unknown"}
//!
//! The autofill provider does not go through the proxy; it announces itself with
//! [`ClientAnnouncement::new_autofill`] -> {"clientType":"autofill"}.
//! ```

use std::fmt;

use serde::{Deserialize, Serialize};

/// Passed by the CLI. Browsers cannot pass arguments of their own, so they never match it.
const ARG_CLIENT_CLI: &str = "--client=cli";

const CHROME_ORIGIN_PREFIX: &str = "chrome-extension://";
const MANIFEST_SUFFIX: &str = ".json";

/// The client on the far end of stdin/stdout, as far as its launch arguments tell.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(
    tag = "clientType",
    rename_all = "lowercase",
    rename_all_fields = "camelCase"
)]
enum Client {
    Cli,
    /// Any Chromium-based browser.
    Chrome {
        extension_id: String,
    },
    Firefox {
        extension_id: String,
    },
    /// The OS autofill provider, connecting to the desktop app's autofill IPC server.
    Autofill,
    /// Still announced, so the desktop app logs that it could not tell.
    Unknown,
}

/// Tells the desktop app which client is connecting.
///
/// Needs no message `type`: the server only reads it as a client's first frame, and reports it
/// with the `Connected` event.
#[derive(Debug, PartialEq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ClientAnnouncement {
    client: Client,
}

impl ClientAnnouncement {
    /// Identifies the client from the arguments it launched this proxy with.
    pub fn from_args(args: &[String]) -> Self {
        Self {
            client: Client::from_args(args),
        }
    }

    /// Identifies the OS autofill provider.
    pub fn new_autofill() -> Self {
        Self {
            client: Client::Autofill,
        }
    }

    /// Parses an announcement from its JSON form.
    pub fn from_string(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

/// The JSON form sent over the wire, so `to_string()` yields the frame.
impl fmt::Display for ClientAnnouncement {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let json = serde_json::to_string(self).map_err(|_| fmt::Error)?;
        f.write_str(&json)
    }
}

impl Client {
    fn from_args(args: &[String]) -> Self {
        if args.iter().any(|arg| arg == ARG_CLIENT_CLI) {
            return Self::Cli;
        }

        // `chrome-extension://<id>/`
        if let Some(origin) = args
            .first()
            .and_then(|arg| arg.strip_prefix(CHROME_ORIGIN_PREFIX))
        {
            return Self::Chrome {
                extension_id: origin.trim_end_matches('/').to_owned(),
            };
        }

        // `<manifest path> <extension id>`; the manifest path only identifies Firefox.
        if let [manifest_path, extension_id, ..] = args {
            if manifest_path.ends_with(MANIFEST_SUFFIX) {
                return Self::Firefox {
                    extension_id: extension_id.clone(),
                };
            }
        }

        Self::Unknown
    }
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Value};

    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    /// The wire form of the announcement for `values`, parsed back for structural comparison.
    fn announced(values: &[&str]) -> Value {
        let json = ClientAnnouncement::from_args(&args(values)).to_string();
        serde_json::from_str(&json).expect("valid JSON")
    }

    #[test]
    fn announces_cli() {
        assert_eq!(announced(&["--client=cli"]), json!({ "clientType": "cli" }));
    }

    #[test]
    fn announces_chrome() {
        assert_eq!(
            announced(&["chrome-extension://abc/"]),
            json!({ "clientType": "chrome", "extensionId": "abc" })
        );
    }

    #[test]
    fn announces_chrome_on_windows() {
        assert_eq!(
            Client::from_args(&args(&["chrome-extension://abc/", "--parent-window=1234"])),
            Client::Chrome {
                extension_id: "abc".to_owned()
            }
        );
    }

    #[test]
    fn announces_firefox() {
        let manifest = r"C:\Users\me\AppData\Roaming\Bitwarden\browsers\firefox.json";
        let extension = "{446900e4-71c2-419f-a6a7-df9c091e268b}";

        assert_eq!(
            announced(&[manifest, extension]),
            json!({
                "clientType": "firefox",
                "extensionId": extension,
            })
        );
    }

    #[test]
    fn announces_unknown() {
        assert_eq!(Client::from_args(&args(&[])), Client::Unknown);
        assert_eq!(
            Client::from_args(&args(&["something-else"])),
            Client::Unknown
        );
        assert_eq!(announced(&[]), json!({ "clientType": "unknown" }));
    }

    #[test]
    fn announces_autofill() {
        let json = ClientAnnouncement::new_autofill().to_string();
        let value: Value = serde_json::from_str(&json).expect("valid JSON");

        assert_eq!(value, json!({ "clientType": "autofill" }));
    }

    #[test]
    fn round_trips_through_a_string() {
        let cases = [
            args(&["--client=cli"]),
            args(&["chrome-extension://abc/"]),
            args(&["/path/com.8bit.bitwarden.json", "{id}"]),
            args(&[]),
        ];

        let announcements = cases
            .iter()
            .map(|case| ClientAnnouncement::from_args(case))
            .chain([ClientAnnouncement::new_autofill()]);

        for announcement in announcements {
            let parsed = ClientAnnouncement::from_string(&announcement.to_string());
            assert_eq!(parsed.expect("parses"), announcement);
        }
    }

    #[test]
    fn rejects_other_messages() {
        assert!(ClientAnnouncement::from_string(r#"{"command":"connected"}"#).is_err());
        assert!(ClientAnnouncement::from_string(
            r#"{"type":"bitwarden-ipc-message","message":{}}"#
        )
        .is_err());
        assert!(ClientAnnouncement::from_string(r#"{"clientType":"web"}"#).is_err());
    }
}
