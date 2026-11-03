use super::{AssertionRequest, AssertionResponse, Error};

pub(super) fn get_assertion(
    _window_handle: &[u8],
    _request: AssertionRequest,
) -> Result<AssertionResponse, Error> {
    Err(Error::NotImplemented)
}
