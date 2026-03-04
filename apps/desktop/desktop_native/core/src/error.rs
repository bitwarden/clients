//! Error types for desktop_core operations.

use std::fmt::Debug;

use thiserror::Error;

/// Errors that can occur in desktop_core operations.
#[derive(Error, Debug)]
#[allow(missing_docs)]
pub enum Error {
    #[error("Error parsing CipherString: {0}")]
    InvalidCipherString(#[from] CSParseError),

    #[error("Cryptography Error, {0}")]
    Crypto(#[from] CryptoError),
}

/// Errors during cipher string parsing.
#[derive(Debug, Error)]
#[allow(missing_docs)]
pub enum CSParseError {
    #[error("No type detected, missing '.' separator")]
    NoType,
    #[error("Invalid type, got {enc_type} with {parts} parts")]
    InvalidType { enc_type: String, parts: usize },
    #[error("Error decoding base64: {0}")]
    InvalidBase64(#[from] base64::DecodeError),
    #[error("Invalid base64 length: expected {expected}, got {got}")]
    InvalidBase64Length { expected: usize, got: usize },
}

/// Errors during cryptographic operations.
#[derive(Debug, Error)]
#[allow(missing_docs)]
pub enum CryptoError {
    #[error("Error while decrypting cipher string")]
    KeyDecrypt,
}

/// Errors during KDF parameter validation.
#[derive(Debug, Error)]
#[allow(missing_docs)]
pub enum KdfParamError {
    #[error("Invalid KDF parameters: {0}")]
    InvalidParams(String),
}

/// Convenience Result type using [`Error`].
pub type Result<T, E = Error> = std::result::Result<T, E>;
