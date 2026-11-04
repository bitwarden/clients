//! Delivers callback URLs from the app's URL scheme handler to the browser sessions waiting for
//! them, on platforms where the browser can't return them to the session directly.
//!
//! Sessions are identified by the `state` parameter in the fragment of the page's URL, which the
//! page returns in the fragment of its callback URL.

use std::{
    collections::HashMap,
    sync::{
        mpsc::{self, Receiver, Sender},
        LazyLock, Mutex, MutexGuard,
    },
};

use super::Error;

/// Sessions waiting for a callback, by state.
static PENDING: LazyLock<Mutex<HashMap<String, Waiter>>> = LazyLock::new(Mutex::default);

struct Waiter {
    callback_scheme: String,
    sender: Sender<Option<String>>,
}

/// A session waiting for its callback URL. It stops waiting when dropped.
pub(super) struct PendingCallback {
    state: String,
    sender: Sender<Option<String>>,
    receiver: Receiver<Option<String>>,
}

impl PendingCallback {
    /// Waits for a callback URL with `callback_scheme` and `state`.
    pub(super) fn register(callback_scheme: &str, state: &str) -> Result<Self, Error> {
        let (sender, receiver) = mpsc::channel();
        let mut pending = lock_pending();
        if pending.contains_key(state) {
            return Err(Error::InvalidRequest(
                "A browser session with this state is already in progress".to_string(),
            ));
        }
        pending.insert(
            state.to_string(),
            Waiter {
                callback_scheme: callback_scheme.to_string(),
                sender: sender.clone(),
            },
        );
        Ok(Self {
            state: state.to_string(),
            sender,
            receiver,
        })
    }

    /// Ends [Self::wait] without a callback URL, from another thread.
    pub(super) fn canceller(&self) -> Canceller {
        Canceller(self.sender.clone())
    }

    /// Blocks until the callback URL is delivered, or returns `None` if cancelled.
    pub(super) fn wait(&self) -> Option<String> {
        // The sender in `self` keeps the channel open.
        self.receiver.recv().ok().flatten()
    }
}

impl Drop for PendingCallback {
    fn drop(&mut self) {
        lock_pending().remove(&self.state);
    }
}

/// Ends a [PendingCallback::wait] without a callback URL.
pub(super) struct Canceller(Sender<Option<String>>);

impl Canceller {
    pub(super) fn cancel(&self) {
        // The session may have ended already.
        let _ = self.0.send(None);
    }
}

/// Delivers `url` to the session waiting for it, if any, which is identified by its scheme and
/// the `state` parameter in its fragment. Returns whether it was delivered.
///
/// Only the first URL for a session is delivered.
pub(super) fn deliver(url: &str) -> bool {
    let Some((scheme, _)) = url.split_once(':') else {
        return false;
    };
    let Some(state) = fragment_param(url, "state") else {
        return false;
    };
    let mut pending = lock_pending();
    match pending.get(state) {
        Some(waiter) if waiter.callback_scheme.eq_ignore_ascii_case(scheme) => {
            let waiter = pending.remove(state).expect("the session is pending");
            waiter.sender.send(Some(url.to_string())).is_ok()
        }
        _ => false,
    }
}

/// Returns the raw value of the parameter `name` in the fragment of `url`.
pub(super) fn fragment_param<'a>(url: &'a str, name: &str) -> Option<&'a str> {
    let (_, fragment) = url.split_once('#')?;
    fragment
        .split('&')
        .filter_map(|param| param.split_once('='))
        .find_map(|(key, value)| (key == name).then_some(value))
}

fn lock_pending() -> MutexGuard<'static, HashMap<String, Waiter>> {
    // The map is always left consistent, so recover it from a panicked holder.
    PENDING.lock().unwrap_or_else(|err| err.into_inner())
}

#[cfg(test)]
mod tests {
    use std::thread;

    use super::*;

    #[test]
    fn test_fragment_param() {
        let url = "https://example.com/page?state=query#v=2&state=abc&data=x%3D";
        assert_eq!(fragment_param(url, "state"), Some("abc"));
        assert_eq!(fragment_param(url, "data"), Some("x%3D"));
        assert_eq!(fragment_param(url, "missing"), None);
        assert_eq!(
            fragment_param("https://example.com?state=abc", "state"),
            None
        );
    }

    #[test]
    fn test_delivers_the_callback_for_the_state() {
        let pending = PendingCallback::register("bitwarden", "deliver-state").unwrap();
        let url = "bitwarden://webauthn-callback#state=deliver-state&ciphertext=abc";

        let delivery = thread::spawn(move || deliver(url));

        assert_eq!(pending.wait().as_deref(), Some(url));
        assert!(delivery.join().unwrap());
    }

    #[test]
    fn test_delivers_only_the_first_callback() {
        let pending = PendingCallback::register("bitwarden", "first-state").unwrap();

        assert!(deliver(
            "bitwarden://webauthn-callback#state=first-state&n=1"
        ));
        assert!(!deliver(
            "bitwarden://webauthn-callback#state=first-state&n=2"
        ));
        assert_eq!(
            pending.wait().as_deref(),
            Some("bitwarden://webauthn-callback#state=first-state&n=1")
        );
    }

    #[test]
    fn test_does_not_deliver_other_callbacks() {
        let _pending = PendingCallback::register("bitwarden", "other-state").unwrap();

        assert!(!deliver(
            "bitwarden://webauthn-callback#state=unknown-state"
        ));
        assert!(!deliver("bitwarden://webauthn-callback?state=other-state"));
        assert!(!deliver("other://webauthn-callback#state=other-state"));
    }

    #[test]
    fn test_does_not_deliver_after_the_session_ends() {
        drop(PendingCallback::register("bitwarden", "ended-state").unwrap());

        assert!(!deliver("bitwarden://webauthn-callback#state=ended-state"));
    }

    #[test]
    fn test_rejects_a_state_that_is_already_pending() {
        let _pending = PendingCallback::register("bitwarden", "duplicate-state").unwrap();

        assert!(PendingCallback::register("bitwarden", "duplicate-state").is_err());
    }

    #[test]
    fn test_cancels_the_wait() {
        let pending = PendingCallback::register("bitwarden", "cancel-state").unwrap();
        let canceller = pending.canceller();

        thread::spawn(move || canceller.cancel()).join().unwrap();

        assert_eq!(pending.wait(), None);
    }
}
