use std::fmt::Debug;

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Error parsing CipherString: {0}")]
    InvalidCipherString(#[from] CSParseError),

    #[error("Cryptography Error, {0}")]
    Crypto(#[from] CryptoError),
}

#[derive(Debug, Error)]
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

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("Error while decrypting cipher string")]
    KeyDecrypt,
}

#[derive(Debug, Error)]
pub enum KdfParamError {
    #[error("Invalid KDF parameters: {0}")]
    InvalidParams(String),
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
