//! Safe wrappers around raw types and functions for webauthn.dll.
mod sys;
mod util;

pub(crate) mod plugin;
pub(crate) mod webauthn;

pub(crate) use util::WindowsString;
