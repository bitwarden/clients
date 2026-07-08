//! Safe wrappers around raw types and functions for webauthn.dll.
mod sys;
mod util;

pub(crate) mod plugin;
pub(crate) mod webauthn;

pub use util::cbor::{CborError, CborParser, CborValue, CborWriter};
pub(crate) use util::WindowsString;
