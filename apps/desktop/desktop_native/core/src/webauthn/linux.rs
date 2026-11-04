use std::sync::{Arc, Mutex, MutexGuard};

use super::{
    callbacks::{Canceller, PendingCallback},
    client_data, AssertionRequest, AssertionResponse, Error,
};

#[derive(Clone)]
pub(super) struct Cancellation(Arc<Mutex<CancellationState>>);

#[derive(Default)]
struct CancellationState {
    /// Set when cancelled, so that a cancellation before the session starts is not lost.
    cancelled: bool,
    /// Set while a session is waiting for its callback.
    canceller: Option<Canceller>,
}

impl Cancellation {
    pub(super) fn new() -> Result<Self, Error> {
        Ok(Self(Arc::default()))
    }

    pub(super) fn cancel(&self) {
        let mut state = self.lock();
        state.cancelled = true;
        if let Some(canceller) = state.canceller.take() {
            canceller.cancel();
        }
    }

    fn lock(&self) -> MutexGuard<'_, CancellationState> {
        // The state is always left consistent, so recover it from a panicked holder.
        self.0.lock().unwrap_or_else(|err| err.into_inner())
    }
}

/// There are no platform passkey APIs on Linux.
pub(super) fn get_assertion(
    _window_handle: &[u8],
    _request: AssertionRequest,
    _cancellation: &Cancellation,
) -> Result<AssertionResponse, Error> {
    Err(Error::RequiresBrowser(
        "There are no platform passkey APIs on Linux".to_string(),
    ))
}

pub(super) fn requires_browser(_rp_id: &str) -> bool {
    true
}

/// Waits for the callback URL for `url` to be delivered with [super::deliver_callback]. The caller
/// opens `url`, e.g. with Electron's `shell.openExternal`, which passes an activation token so that
/// the browser is focused.
pub(super) fn web_authentication_session(
    _window_handle: &[u8],
    url: &str,
    callback_scheme: &str,
    cancellation: &Cancellation,
) -> Result<String, Error> {
    client_data::validate_page_url(url)?;
    let state = super::callbacks::fragment_param(url, "state").ok_or_else(|| {
        Error::InvalidRequest("The URL has no state parameter in its fragment".to_string())
    })?;
    let pending = PendingCallback::register(callback_scheme, state)?;
    {
        let mut cancellation = cancellation.lock();
        if cancellation.cancelled {
            return Err(Error::Cancelled);
        }
        cancellation.canceller = Some(pending.canceller());
    }

    let result = pending.wait().ok_or(Error::Cancelled);
    cancellation.lock().canceller = None;
    result
}
