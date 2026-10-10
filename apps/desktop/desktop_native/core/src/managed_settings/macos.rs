//! Only a value forced by a configuration profile is returned. The application's own preference
//! domain is writable by any process running as the signed-in user, for example with
//! `defaults write`, and `CFPreferencesCopyAppValue` searches that domain too.

use anyhow::Result;
use core_foundation::{
    base::{Boolean, CFTypeRef, TCFType},
    propertylist::CFPropertyList,
    string::{CFString, CFStringRef},
};

const APP_ID: &str = "com.bitwarden.desktop";
const CONTAINER_VALUE: &str = "ManagedSettings";

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFPreferencesCopyAppValue(key: CFStringRef, application_id: CFStringRef) -> CFTypeRef;
    fn CFPreferencesAppValueIsForced(key: CFStringRef, application_id: CFStringRef) -> Boolean;
}

/// The `ManagedSettings` value of the `com.bitwarden.desktop` domain when a configuration profile
/// forces it, or `None`. A value from the user's own preference domain is never returned.
pub fn read() -> Result<Option<String>> {
    let key = CFString::new(CONTAINER_VALUE);
    let app_id = CFString::new(APP_ID);

    // SAFETY: `key` and `app_id` are valid CFStrings that outlive the call. The returned value
    // follows the Create rule, so ownership moves to `CFPropertyList`, which releases it on drop.
    let value = unsafe {
        let raw =
            CFPreferencesCopyAppValue(key.as_concrete_TypeRef(), app_id.as_concrete_TypeRef());
        if raw.is_null() {
            return Ok(None);
        }
        CFPropertyList::wrap_under_create_rule(raw)
    };

    // Checked after the copy. A profile installed or removed between the two calls can make this
    // one read wrong, but the profile change posts a change notification and the re-read corrects
    // it.
    // SAFETY: `key` and `app_id` are valid CFStrings that outlive the call, and the function
    // returns a plain boolean without transferring ownership of anything.
    let forced = unsafe {
        CFPreferencesAppValueIsForced(key.as_concrete_TypeRef(), app_id.as_concrete_TypeRef())
    } != 0;
    if !forced {
        return Ok(None);
    }

    // A forced value of another type is not a container value.
    Ok(value
        .downcast_into::<CFString>()
        .map(|value| value.to_string()))
}

/// Does nothing. The Electron main process watches through
/// `systemPreferences.subscribeNotification`.
pub fn watch(_tx: tokio::sync::mpsc::Sender<()>) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_succeeds_on_any_host() {
        assert!(read().is_ok());
    }

    /// Writes to the signed-in user's own `com.bitwarden.desktop` preference domain, so it runs
    /// only with the `manual_test` feature. It deletes the value afterwards, which also removes a
    /// value the user had set there before. It must run with no configuration profile that sets
    /// `ManagedSettings` installed.
    #[test]
    #[cfg(feature = "manual_test")]
    fn read_ignores_value_from_user_domain() {
        use std::process::Command;

        let domain = dirs::home_dir()
            .expect("home directory")
            .join("Library/Preferences")
            .join(APP_ID);
        let domain = domain.to_str().expect("UTF-8 path");

        let status = Command::new("defaults")
            .args(["write", domain, CONTAINER_VALUE, "-string", r#"{"a":1}"#])
            .status()
            .expect("run defaults write");
        assert!(status.success());

        let key = CFString::new(CONTAINER_VALUE);
        let app_id = CFString::new(APP_ID);
        // SAFETY: as in `read`.
        let visible = unsafe {
            let raw =
                CFPreferencesCopyAppValue(key.as_concrete_TypeRef(), app_id.as_concrete_TypeRef());
            if raw.is_null() {
                false
            } else {
                drop(CFPropertyList::wrap_under_create_rule(raw));
                true
            }
        };
        let result = read();

        let _ = Command::new("defaults")
            .args(["delete", domain, CONTAINER_VALUE])
            .status();

        // Without this the assertion below would pass even if the written value were never seen.
        assert!(
            visible,
            "the user-domain value was not visible to CFPreferences"
        );
        assert_eq!(result.expect("read"), None);
    }

    /// Requires a configuration profile that forces `ManagedSettings` in the
    /// `com.bitwarden.desktop` domain to be installed through System Settings before the run.
    #[test]
    #[cfg(feature = "manual_test")]
    #[ignore = "requires an installed configuration profile"]
    fn read_returns_forced_value() {
        assert!(read().expect("read").is_some());
    }
}
