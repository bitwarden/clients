use super::{AssertionRequest, AssertionResponse, Error};

#[derive(Clone)]
pub(super) struct Cancellation;

impl Cancellation {
    pub(super) fn new() -> Result<Self, Error> {
        Ok(Self)
    }

    pub(super) fn cancel(&self) {}
}

pub(super) fn get_assertion(
    _window_handle: &[u8],
    _request: AssertionRequest,
    _cancellation: &Cancellation,
) -> Result<AssertionResponse, Error> {
    Err(Error::NotImplemented)
}

pub(super) fn requires_browser(_rp_id: &str) -> bool {
    false
}

pub(super) fn web_authentication_session(
    _window_handle: &[u8],
    _url: &str,
    _callback_scheme: &str,
    _cancellation: &Cancellation,
) -> Result<String, Error> {
    Err(Error::NotImplemented)
}
