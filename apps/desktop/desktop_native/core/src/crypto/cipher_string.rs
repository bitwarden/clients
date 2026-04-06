use std::{fmt::Display, str::FromStr};

use base64::{engine::general_purpose::STANDARD as base64_engine, Engine};

use crate::error::{CSParseError, Error};

#[allow(unused, non_camel_case_types)]
pub enum CipherString {
    // 0
    AesCbc256_B64 {
        iv: [u8; 16],
        data: Vec<u8>,
    },
    // 1
    AesCbc128_HmacSha256_B64 {
        iv: [u8; 16],
        mac: [u8; 32],
        data: Vec<u8>,
    },
    // 2
    AesCbc256_HmacSha256_B64 {
        iv: [u8; 16],
        mac: [u8; 32],
        data: Vec<u8>,
    },
    // 3
    Rsa2048_OaepSha256_B64 {
        data: Vec<u8>,
    },
    // 4
    Rsa2048_OaepSha1_B64 {
        data: Vec<u8>,
    },
    // 5
    Rsa2048_OaepSha256_HmacSha256_B64 {
        mac: [u8; 32],
        data: Vec<u8>,
    },
    // 6
    Rsa2048_OaepSha1_HmacSha256_B64 {
        mac: [u8; 32],
        data: Vec<u8>,
    },
}

// We manually implement these to make sure we don't print any sensitive data
impl std::fmt::Debug for CipherString {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("CipherString")
            .field("type", &self.enc_type_name())
            .finish()
    }
}

fn invalid_len_error(expected: usize) -> impl Fn(Vec<u8>) -> CSParseError {
    move |e: Vec<_>| CSParseError::InvalidBase64Length {
        expected,
        got: e.len(),
    }
}

impl FromStr for CipherString {
    type Err = Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (enc_type, data) = s.split_once('.').ok_or(CSParseError::NoType)?;

        let parts: Vec<_> = data.split('|').collect();
        match (enc_type, parts.len()) {
            ("0", 2) => {
                let iv_str = parts[0];
                let data_str = parts[1];

                let iv = base64_engine
                    .decode(iv_str)
                    .map_err(CSParseError::InvalidBase64)?
                    .try_into()
                    .map_err(invalid_len_error(16))?;

                let data = base64_engine
                    .decode(data_str)
                    .map_err(CSParseError::InvalidBase64)?;

                Ok(CipherString::AesCbc256_B64 { iv, data })
            }

            ("1" | "2", 3) => {
                let iv_str = parts[0];
                let data_str = parts[1];
                let mac_str = parts[2];

                let iv = base64_engine
                    .decode(iv_str)
                    .map_err(CSParseError::InvalidBase64)?
                    .try_into()
                    .map_err(invalid_len_error(16))?;

                let mac = base64_engine
                    .decode(mac_str)
                    .map_err(CSParseError::InvalidBase64)?
                    .try_into()
                    .map_err(invalid_len_error(32))?;

                let data = base64_engine
                    .decode(data_str)
                    .map_err(CSParseError::InvalidBase64)?;

                if enc_type == "1" {
                    Ok(CipherString::AesCbc128_HmacSha256_B64 { iv, mac, data })
                } else {
                    Ok(CipherString::AesCbc256_HmacSha256_B64 { iv, mac, data })
                }
            }

            ("3" | "4", 1) => {
                let data = base64_engine
                    .decode(data)
                    .map_err(CSParseError::InvalidBase64)?;
                if enc_type == "3" {
                    Ok(CipherString::Rsa2048_OaepSha256_B64 { data })
                } else {
                    Ok(CipherString::Rsa2048_OaepSha1_B64 { data })
                }
            }
            ("5" | "6", 2) => {
                unimplemented!()
            }

            (enc_type, parts) => Err(CSParseError::InvalidType {
                enc_type: enc_type.to_string(),
                parts,
            }
            .into()),
        }
    }
}

impl Display for CipherString {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.", self.enc_type())?;

        let mut parts = Vec::<&[u8]>::new();

        match self {
            CipherString::AesCbc256_B64 { iv, data } => {
                parts.push(iv);
                parts.push(data);
            }
            CipherString::AesCbc128_HmacSha256_B64 { iv, mac, data } => {
                parts.push(iv);
                parts.push(data);
                parts.push(mac);
            }
            CipherString::AesCbc256_HmacSha256_B64 { iv, mac, data } => {
                parts.push(iv);
                parts.push(data);
                parts.push(mac);
            }
            CipherString::Rsa2048_OaepSha256_B64 { data } => {
                parts.push(data);
            }
            CipherString::Rsa2048_OaepSha1_B64 { data } => {
                parts.push(data);
            }
            CipherString::Rsa2048_OaepSha256_HmacSha256_B64 { mac, data } => {
                parts.push(data);
                parts.push(mac);
            }
            CipherString::Rsa2048_OaepSha1_HmacSha256_B64 { mac, data } => {
                parts.push(data);
                parts.push(mac);
            }
        }

        for i in 0..parts.len() {
            if i == parts.len() - 1 {
                write!(f, "{}", base64_engine.encode(parts[i]))?;
            } else {
                write!(f, "{}|", base64_engine.encode(parts[i]))?;
            }
        }

        Ok(())
    }
}

impl CipherString {
    fn enc_type(&self) -> u8 {
        match self {
            CipherString::AesCbc256_B64 { .. } => 0,
            CipherString::AesCbc128_HmacSha256_B64 { .. } => 1,
            CipherString::AesCbc256_HmacSha256_B64 { .. } => 2,
            CipherString::Rsa2048_OaepSha256_B64 { .. } => 3,
            CipherString::Rsa2048_OaepSha1_B64 { .. } => 4,
            CipherString::Rsa2048_OaepSha256_HmacSha256_B64 { .. } => 5,
            CipherString::Rsa2048_OaepSha1_HmacSha256_B64 { .. } => 6,
        }
    }

    fn enc_type_name(&self) -> &str {
        match self.enc_type() {
            0 => "AesCbc256_B64",
            1 => "AesCbc128_HmacSha256_B64",
            2 => "AesCbc256_HmacSha256_B64",
            3 => "Rsa2048_OaepSha256_B64",
            4 => "Rsa2048_OaepSha1_B64",
            5 => "Rsa2048_OaepSha256_HmacSha256_B64",
            6 => "Rsa2048_OaepSha1_HmacSha256_B64",
            _ => "Unknown",
        }
    }
}
