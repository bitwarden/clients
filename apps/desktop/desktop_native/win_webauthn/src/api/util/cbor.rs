//! Implements methods to work with [RFC 8949] CBOR encoding, specifically with
//! the subset defined [CTAP2 canonical encoding form][ctap2-canonical-cbor].
//!
//! CBOR is a compact encoding and is used extensively in WebAuthn.
//!
//! It is a tag-length-value (TLV) encoding, where the tags are referred to as "major types".
//! The highest three bits of the start of a CBOR data item determine the major
//! type, while the remaining 5 bits contain "additional information." For most
//! major types, additional information encodes the number of
//! following bytes that contain the value of the data item. As an optimization,
//! the numeric major types elide small values into additional information. Some
//! other major types give special meaning to the additional information (as in
//! FloatOrSimple and Tag).
//!
//! Major types that use additional info for determining the length of the data item follow this
//! pattern:
//! - 24 => 1 bytes
//! - 25 => 2 bytes
//! - 26 => 4 bytes
//! - 27 => 8 bytes
//!
//! Note that for the list-like types (Text, Byte, Array, Map), this means that
//! the additional info is determines the _length of the length_ of the data
//! item. For example, a byte string of length 25 would have additional
//! information 24 to indicate that the byte length is in the following 1 byte,
//! followed by a byte 25, followed by 25 bytes of data.
//!
//! ```ignore
//! [
//!   0b010_11000, // major type 2 (byte string), additional info = 24, length is in the following 1 byte
//!   0b1100_0001, // 25, meaning 25 bytes follow
//!   // <25 bytes of data...>
//! ]
//! ```
//! [RFC 8949]: https://datatracker.ietf.org/doc/html/rfc8949
//! [ctap2-canonical-cbor]: https://fidoalliance.org/specs/fido-v2.1-ps-20210615/fido-client-to-authenticator-protocol-v2.1-ps-errata-20220621.html#ctap2-canonical-cbor-encoding-form
use std::{
    convert::TryInto,
    io::{Error, ErrorKind, Write},
};

/// Struct to write CBOR-encoded data to a writer. Implements a subset of CBOR
/// suitable for serializing CTAP2 values.
pub struct CborWriter<'a, W: Write> {
    writer: &'a mut W,
}

impl<W> CborWriter<'_, W>
where
    W: Write,
{
    pub fn new(writer: &'_ mut W) -> CborWriter<'_, W> {
        CborWriter { writer }
    }

    /// Write a byte string to the buffer.
    pub fn write_bytes<T>(&mut self, data: T) -> Result<(), Error>
    where
        T: AsRef<[u8]>,
    {
        self.write_cbor_value(
            MajorType::ByteString,
            data.as_ref().len().try_into().map_err(|_| {
                Error::new(
                    ErrorKind::InvalidInput,
                    "value too long for definite-length encoding",
                )
            })?,
            Some(data.as_ref()),
        )?;
        Ok(())
    }

    pub fn write_number(&mut self, num: i128) -> Result<(), Error> {
        // Positive Numbers are major type 0 (high-order bits = 0b000), negative is major type 1
        // (0b001).
        const POSITIVE_INTEGER_MASK: u8 = 0b000_00000;
        const NEGATIVE_INTEGER_MASK: u8 = 0b001_00000;
        let (mask, num) = if num >= 0 {
            // CBOR can only encode numbers [-2^64, 2^64 -1], so throw out invalid numbers.
            if num > (u64::MAX as i128) {
                return Err(Error::new(
                    ErrorKind::InvalidInput,
                    "value too large".to_string(),
                ));
            }
            (POSITIVE_INTEGER_MASK, num as u64)
        } else {
            if num < -(u64::MAX as i128) - 1 {
                return Err(Error::new(
                    ErrorKind::InvalidInput,
                    "negative value too large".to_string(),
                ));
            }
            // Like signed integers, negative CBOR integers represent the data item -1 - N, so we
            // capture that here.
            (NEGATIVE_INTEGER_MASK, (-num - 1) as u64)
        };
        // As an optimization, encoded numeric values less than 24 (i.e. [-24,
        // 23]) are encoded in a single byte, and the additional information
        // should be interpreted as the value itself.
        if num < 24 {
            let d: u8 = num as u8;
            self.writer.write_all(&[mask | d])?;
            Ok(())
        }
        // Otherwise, the value of the data item is encoded by the number of
        // bytes following the initial byte.
        //
        // While it is valid CBOR to use more bytes than necessary for encoding
        // numbers, WebAuthn and CTAP CBOR encoding rules require using the
        // smallest number of bytes, so we do that here by going from smallest to biggest.
        else if num < 2_u64.pow(8) {
            let d = num as u8;
            self.writer.write_all(&[mask | 24])?;
            self.writer.write_all(&d.to_be_bytes())?;
            Ok(())
        } else if num < 2_u64.pow(16) {
            let d = num as u16;
            self.writer.write_all(&[mask | 25])?;
            self.writer.write_all(&d.to_be_bytes())?;
            Ok(())
        } else if num < 2_u64.pow(32) {
            let d = num as u32;
            self.writer.write_all(&[mask | 26])?;
            self.writer.write_all(&d.to_be_bytes())?;
            Ok(())
        }
        // We've already checked that the data fits within a u64, so just write it out.
        else {
            let d = num;
            self.writer.write_all(&[mask | 27])?;
            self.writer.write_all(&d.to_be_bytes())?;
            Ok(())
        }
    }

    /// Start a CBOR map.
    ///
    /// A map is encoded with the header type that contains the number of
    /// entries in the map, followed by pairs of CBOR data items. Since the
    /// length is encoded in the header byte, no end marker is needed.
    ///
    /// # Example
    /// To encode the equivalent of the JSON map: `{ "foo": 10, "isValid": true }`:
    /// ```ignore
    /// use crate::api::util::cbor::CborWriter;
    ///
    /// let mut buf = Vec::new();
    /// let mut writer = CborWriter::new(&mut buf);
    /// writer.write_map_start(2).unwrap();
    ///
    /// writer.write_text("foo").unwrap();
    /// writer.write_number(10).unwrap();
    ///
    /// writer.write_text("isValid").unwrap();
    /// writer.write_bool(true).unwrap();
    /// ```
    pub fn write_map_start(&mut self, len: usize) -> Result<(), Error> {
        self.write_cbor_value(MajorType::Map, len as u64, None)?;
        Ok(())
    }

    /// Start a CBOR array.
    ///
    /// An array is encoded with the header type that contains the number of
    /// elements in the array, followed CBOR data items. Since the
    /// length is encoded in the header byte, no end marker is needed.
    ///
    /// # Example
    /// To encode the equivalent of the JSON array: `["blue", 42, "hike!", true]`:`
    /// ```ignore
    /// use crate::api::util::cbor::CborWriter;
    ///
    /// let mut buf = Vec::new();
    /// let mut writer = CborWriter::new(&mut buf);
    /// writer.write_array_start(4).unwrap();
    ///
    /// writer.write_text("blue").unwrap();
    /// writer.write_number(42).unwrap();
    ///
    /// writer.write_text("hike!").unwrap();
    /// writer.write_bool(true).unwrap();
    /// ```
    pub fn write_array_start(&mut self, len: usize) -> Result<(), Error> {
        self.write_cbor_value(MajorType::Array, len as u64, None)?;
        Ok(())
    }

    pub fn write_text(&mut self, text: &str) -> Result<(), Error> {
        let data = text.as_bytes();
        self.write_cbor_value(
            MajorType::TextString,
            data.len().try_into().map_err(|_| {
                Error::new(
                    ErrorKind::InvalidInput,
                    "value too long for definite-length encoding",
                )
            })?,
            Some(data),
        )?;
        Ok(())
    }

    pub fn write_bool(&mut self, value: bool) -> Result<(), Error> {
        let cbor_value = if value { 21 } else { 20 };
        self.write_cbor_value(MajorType::FloatOrSimple, cbor_value, None)
    }

    fn write_cbor_value(
        &mut self,
        major_type: MajorType,
        len: u64,
        data: Option<&[u8]>,
    ) -> Result<(), Error> {
        let major_type_mask = match major_type {
            MajorType::PositiveInteger => 0b000_00000,
            MajorType::NegativeInteger => 0b001_00000,
            MajorType::ByteString => 0b010_00000,
            MajorType::TextString => 0b011_00000,
            MajorType::Array => 0b100_00000,
            MajorType::Map => 0b101_00000,
            MajorType::Tag => 0b110_00000,
            MajorType::FloatOrSimple => 0b111_00000,
        };

        let mut major_type_buf = [0; 9];
        // Here, we assume that additional information always encodes a length
        // of a value, optionally followed by a payload. But this is not always
        // the case, e.g. in the case of FloatOrSimple values.  If the need for
        // any more major types in WebAuthn is needed (unlikely), then we'll
        // need to handle those differently.

        // Compact the length if it's less than 24 according to the CBOR rules:
        if len < 24 {
            let l = len as u8;
            self.writer.write_all(&[major_type_mask | l])?;
        }
        // Otherwise, encode the length in the smallest number of bytes possible:
        else if len < 2u64.pow(8) {
            let l = len as u8;
            major_type_buf[0] = major_type_mask | 24u8;
            major_type_buf[1..2].copy_from_slice(&l.to_be_bytes());
            self.writer.write_all(&major_type_buf[0..2])?;
        } else if len < 2u64.pow(16) {
            let l = len as u16;
            major_type_buf[0] = major_type_mask | 25u8;
            major_type_buf[1..3].copy_from_slice(&l.to_be_bytes());
            self.writer.write_all(&major_type_buf[0..3])?;
        } else if len < 2u64.pow(32) {
            let l = len as u32;
            major_type_buf[0] = major_type_mask | 26u8;
            major_type_buf[1..5].copy_from_slice(&l.to_be_bytes());
            self.writer.write_all(&major_type_buf[0..5])?;
        } else {
            let l = len;
            major_type_buf[0] = major_type_mask | 27u8;
            major_type_buf[1..9].copy_from_slice(&l.to_be_bytes());
            self.writer.write_all(&major_type_buf[0..9])?;
        }
        // After writing the length, write the value of the data item, if any.
        if let Some(data) = data {
            self.writer.write_all(data)?;
        }
        Ok(())
    }
}

#[allow(dead_code)]
enum MajorType {
    PositiveInteger,
    NegativeInteger,
    ByteString,
    TextString,
    Array,
    Map,
    Tag,
    FloatOrSimple,
}

use std::{
    fmt,
    io::{Cursor, Read},
};

#[derive(Debug)]
pub enum CborError {
    UnexpectedEof,
    InvalidUtf8(std::str::Utf8Error),
    UnsupportedType(&'static str),
    MaxDepthExceeded,
    IndefiniteLength,
}

impl fmt::Display for CborError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CborError::UnexpectedEof => write!(f, "unexpected end of input"),
            CborError::InvalidUtf8(e) => write!(f, "invalid UTF-8: {e}"),
            CborError::UnsupportedType(t) => write!(f, "unsupported CBOR type: {t}"),
            CborError::MaxDepthExceeded => write!(f, "maximum nesting depth exceeded"),
            CborError::IndefiniteLength => write!(
                f,
                "indefinite-length items are not permitted in CTAP2 canonical CBOR"
            ),
        }
    }
}

/// Maximum nesting depth the parser will descend into. The CTAP2 canonical
/// encoding form mandates no more than four levels of nesting, so eight is
/// comfortable headroom. Its purpose is to bound recursion so that untrusted
/// input made of deeply nested containers cannot overflow the stack and abort
/// the process.
const MAX_DEPTH: usize = 8;

#[derive(Debug, PartialEq)]
pub enum CborValue {
    PositiveInteger(u64),
    NegativeInteger(i128),
    ByteString(Vec<u8>),
    TextString(String),
    Array(Vec<CborValue>),
    Map(Vec<(CborValue, CborValue)>),
    Bool(bool),
    Null,
    Undefined,
}

impl CborValue {
    pub fn as_text(&self) -> Option<&str> {
        match self {
            CborValue::TextString(s) => Some(s.as_str()),
            _ => None,
        }
    }

    pub fn as_bytes(&self) -> Option<&[u8]> {
        match self {
            CborValue::ByteString(b) => Some(b.as_slice()),
            _ => None,
        }
    }

    pub fn into_map(self) -> Result<Vec<(CborValue, CborValue)>, CborValue> {
        match self {
            CborValue::Map(m) => Ok(m),
            other => Err(other),
        }
    }
}

/// CBOR parser implementing the subset of features required for parsing
/// WebAuthn structures.
pub struct CborParser<'a> {
    cursor: Cursor<&'a [u8]>,
}

impl<'a> CborParser<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self {
            cursor: Cursor::new(data),
        }
    }

    fn read_byte(&mut self) -> Result<u8, CborError> {
        let mut buf = [0u8; 1];
        self.cursor
            .read_exact(&mut buf)
            .map_err(|_| CborError::UnexpectedEof)?;
        Ok(buf[0])
    }

    /// Number of bytes left to read in the underlying buffer.
    fn remaining(&self) -> usize {
        let len = self.cursor.get_ref().len();
        let pos = self.cursor.position() as usize;
        len.saturating_sub(pos)
    }

    fn read_bytes(&mut self, n: usize) -> Result<Vec<u8>, CborError> {
        // `n` is the length field of a byte/text string read from untrusted
        // input, so it can be arbitrarily large (up to u64::MAX). A
        // definite-length string of length `n` must be followed by `n` bytes in
        // the stream, so if `n` exceeds what's left in the buffer the input is
        // truncated. Reject it before allocating, otherwise a tiny payload
        // declaring a huge length triggers a massive allocation or a
        // capacity-overflow panic.
        if n > self.remaining() {
            return Err(CborError::UnexpectedEof);
        }
        let mut buf = vec![0u8; n];
        self.cursor
            .read_exact(&mut buf)
            .map_err(|_| CborError::UnexpectedEof)?;
        Ok(buf)
    }

    /// Returns `None` for indefinite-length (additional_info == 31).
    fn read_argument(&mut self, additional_info: u8) -> Result<Option<u64>, CborError> {
        match additional_info {
            n @ 0..=23 => Ok(Some(n as u64)),
            24 => Ok(Some(self.read_byte()? as u64)),
            25 => {
                let b = self.read_bytes(2)?;
                Ok(Some(u16::from_be_bytes([b[0], b[1]]) as u64))
            }
            26 => {
                let b = self.read_bytes(4)?;
                Ok(Some(u32::from_be_bytes([b[0], b[1], b[2], b[3]]) as u64))
            }
            27 => {
                let b = self.read_bytes(8)?;
                Ok(Some(u64::from_be_bytes([
                    b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
                ])))
            }
            31 => Ok(None),
            _ => Err(CborError::UnsupportedType("reserved additional info")),
        }
    }

    fn read_value(&mut self, depth: usize) -> Result<CborValue, CborError> {
        if depth >= MAX_DEPTH {
            return Err(CborError::MaxDepthExceeded);
        }

        let first = self.read_byte()?;
        let major_type = first >> 5;
        let additional_info = first & 0x1f;

        let arg = self.read_argument(additional_info)?;

        match major_type {
            // Major type 0: unsigned integer
            0 => Ok(CborValue::PositiveInteger(
                arg.ok_or(CborError::IndefiniteLength)?,
            )),

            // Major type 1: negative integer (-1 - n)
            1 => {
                let n = arg.ok_or(CborError::IndefiniteLength)?;
                Ok(CborValue::NegativeInteger(-1_i128 - n as i128))
            }

            // Major type 2: byte string
            2 => {
                let len = arg.ok_or(CborError::IndefiniteLength)?;
                Ok(CborValue::ByteString(self.read_bytes(len as usize)?))
            }

            // Major type 3: text string
            3 => {
                let len = arg.ok_or(CborError::IndefiniteLength)?;
                let bytes = self.read_bytes(len as usize)?;
                let s =
                    String::from_utf8(bytes).map_err(|e| CborError::InvalidUtf8(e.utf8_error()))?;
                Ok(CborValue::TextString(s))
            }

            // Major type 4: array
            4 => {
                let count = arg.ok_or(CborError::IndefiniteLength)?;
                // `count` is attacker-controlled. Passing it raw to with_capacity
                // would panic on capacity overflow for a huge declared count.
                // Each element occupies at least one input byte, so the remaining
                // input is a safe upper bound; clamp to it and let the Vec grow if
                // elements turn out larger.
                let mut items = Vec::with_capacity((count as usize).min(self.remaining()));
                for _ in 0..count {
                    items.push(self.read_value(depth + 1)?);
                }
                Ok(CborValue::Array(items))
            }

            // Major type 5: map
            5 => {
                let count = arg.ok_or(CborError::IndefiniteLength)?;
                // See the array case: clamp the attacker-controlled count to the
                // remaining input to avoid a capacity-overflow panic.
                let mut pairs = Vec::with_capacity((count as usize).min(self.remaining()));
                for _ in 0..count {
                    let k = self.read_value(depth + 1)?;
                    let v = self.read_value(depth + 1)?;
                    pairs.push((k, v));
                }
                Ok(CborValue::Map(pairs))
            }

            // Major type 6: tag — not supported
            6 => Err(CborError::UnsupportedType("Tag")),

            // Major type 7: simple values (floats not supported)
            7 => match arg {
                Some(20) => Ok(CborValue::Bool(false)),
                Some(21) => Ok(CborValue::Bool(true)),
                Some(22) => Ok(CborValue::Null),
                Some(23) => Ok(CborValue::Undefined),
                _ => Err(CborError::UnsupportedType("Float or unknown simple value")),
            },

            _ => unreachable!("major_type is a 3-bit value"),
        }
    }

    /// Parse a single CBOR value from `data`.
    pub fn parse(data: &'a [u8]) -> Result<CborValue, CborError> {
        Self::new(data).read_value(0)
    }
}

#[cfg(test)]
mod tests {
    use std::io::ErrorKind;

    use super::*;

    #[expect(clippy::string_slice)]
    fn from_hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            // SAFETY: Only used on trusted hex input.
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn write_bytes() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        let data: &[u8] = &[0x01, 0x23, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xff];
        cbor_writer.write_bytes(data).unwrap();
        assert_eq!(
            buf,
            &[
                0b010_01001,
                0x01,
                0x23,
                0x34,
                0x56,
                0x78,
                0x9a,
                0xbc,
                0xde,
                0xff
            ]
        );
    }

    #[test]
    fn write_bytes_over24() {
        let mut buf: Vec<u8> = Vec::new();
        let mut cbor_writer = CborWriter::new(&mut buf);
        let data = vec![0; 32];
        cbor_writer.write_bytes(data.clone()).unwrap();
        assert_eq!(&buf[0..2], &[0b010_11000, 32u8]);
        assert_eq!(&buf[2..34], &data);
    }

    #[test]
    fn write_uint() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(22_i128).unwrap();
        assert_eq!(buf, &[0b000_10110]);
    }

    #[test]
    fn write_number_24() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(24_i128).unwrap();
        assert_eq!(buf, &[0b000_11000, 24]);
    }

    #[test]
    fn write_number_u8() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(25_i128).unwrap();
        assert_eq!(buf, &[0b000_11000, 25]);
    }

    #[test]
    fn write_number_u16() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(500_i128).unwrap();
        assert_eq!(buf, &[0b000_11001, 0x01, 0xf4]);
    }

    #[test]
    fn write_number_u32() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(u32::MAX as i128).unwrap();
        assert_eq!(buf, &[0b000_11010, 0xff, 0xff, 0xff, 0xff]);
    }

    #[test]
    fn write_number_u64() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(u64::MAX as i128).unwrap();
        assert_eq!(
            buf,
            &[0b000_11011, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]
        );
    }

    #[test]
    fn write_negative_number_24() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(-24_i128).unwrap();
        assert_eq!(buf, &[0b001_10111]);
    }

    #[test]
    fn write_negative_number_25() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(-25_i128).unwrap();
        assert_eq!(buf, &[0b001_11000, 24]);
    }

    #[test]
    fn write_negative_number() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(-22_i128).unwrap();
        assert_eq!(buf, &[0b001_10101]);
    }

    #[test]
    fn write_negative_number_u16() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(-500_i128).unwrap();
        assert_eq!(buf, &[0b001_11001, 0x01, 0xf3]);
    }

    #[test]
    fn write_negative_number_u32() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(-(u32::MAX as i128)).unwrap();
        assert_eq!(buf, &[0b001_11010, 0xff, 0xff, 0xff, 0xfe]);
    }

    #[test]
    fn write_negative_number_u64() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_number(-(u64::MAX as i128)).unwrap();
        assert_eq!(
            buf,
            &[0b001_11011, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]
        );
    }

    #[test]
    fn write_negative_number_overflow() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        let err = cbor_writer.write_number(-(2_i128.pow(64)) - 1).unwrap_err();
        assert!(matches!(err.kind(), ErrorKind::InvalidInput));
    }

    #[test]
    fn write_positive_number_overflow() {
        let mut buf: Vec<u8> = Vec::with_capacity(16);
        let mut cbor_writer = CborWriter::new(&mut buf);
        let err = cbor_writer.write_number(u64::MAX as i128 + 1).unwrap_err();
        assert!(matches!(err.kind(), ErrorKind::InvalidInput));
    }

    #[test]
    fn write_map_start() {
        let mut buf: Vec<u8> = Vec::with_capacity(3);
        let mut cbor_writer = CborWriter::new(&mut buf);
        cbor_writer.write_map_start(800).unwrap();
        assert_eq!(buf, &[0b101_11001, 0b0000_0011, 0b0010_0000,]);
    }

    /// Test vectors from https://github.com/Yubico/python-fido2/blob/main/tests/test_cbor.py
    /// which itself sources from https://github.com/cbor/test-vectors
    #[test]
    fn test_decode_vectors() {
        use CborValue::*;
        let cases: &[(&str, CborValue)] = &[
            // unsigned integers — inline (< 24), 1-byte, 2-byte, 4-byte, 8-byte
            ("00", PositiveInteger(0)),
            ("01", PositiveInteger(1)),
            ("0a", PositiveInteger(10)),
            ("17", PositiveInteger(23)),
            ("1818", PositiveInteger(24)),
            ("1819", PositiveInteger(25)),
            ("1864", PositiveInteger(100)),
            ("1903e8", PositiveInteger(1000)),
            ("1a000f4240", PositiveInteger(1_000_000)),
            ("1b000000e8d4a51000", PositiveInteger(1_000_000_000_000)),
            ("1bffffffffffffffff", PositiveInteger(u64::MAX)),
            // negative integers
            ("20", NegativeInteger(-1)),
            ("29", NegativeInteger(-10)),
            ("3863", NegativeInteger(-100)),
            ("3903e7", NegativeInteger(-1000)),
            // negatives that overflow i64: -2^63-1 and the CBOR minimum -2^64
            ("3b8000000000000000", NegativeInteger(-(2_i128.pow(63)) - 1)),
            ("3bffffffffffffffff", NegativeInteger(-(2_i128.pow(64)))),
            // simple values
            ("f4", Bool(false)),
            ("f5", Bool(true)),
            // byte strings
            ("40", ByteString(vec![])),
            ("4401020304", ByteString(vec![1, 2, 3, 4])),
            // text strings — ASCII, escape chars, multi-byte UTF-8, 4-byte codepoint
            ("60", TextString(String::new())),
            ("6161", TextString("a".into())),
            ("6449455446", TextString("IETF".into())),
            ("62225c", TextString("\"\\".into())),
            ("62c3bc", TextString("ü".into())),
            ("63e6b0b4", TextString("水".into())),
            ("64f0908591", TextString("𐅑".into())),
            // arrays — empty, flat, nested, 1-byte-length (25 items)
            ("80", Array(vec![])),
            (
                "83010203",
                Array(vec![
                    PositiveInteger(1),
                    PositiveInteger(2),
                    PositiveInteger(3),
                ]),
            ),
            (
                "8301820203820405",
                Array(vec![
                    PositiveInteger(1),
                    Array(vec![PositiveInteger(2), PositiveInteger(3)]),
                    Array(vec![PositiveInteger(4), PositiveInteger(5)]),
                ]),
            ),
            (
                "98190102030405060708090a0b0c0d0e0f101112131415161718181819",
                Array((1u64..=25).map(PositiveInteger).collect()),
            ),
            // maps — empty, integer keys, string keys with array values, mixed nesting
            ("a0", Map(vec![])),
            (
                "a201020304",
                Map(vec![
                    (PositiveInteger(1), PositiveInteger(2)),
                    (PositiveInteger(3), PositiveInteger(4)),
                ]),
            ),
            (
                "a26161016162820203",
                Map(vec![
                    (TextString("a".into()), PositiveInteger(1)),
                    (
                        TextString("b".into()),
                        Array(vec![PositiveInteger(2), PositiveInteger(3)]),
                    ),
                ]),
            ),
            (
                "826161a161626163",
                Array(vec![
                    TextString("a".into()),
                    Map(vec![(TextString("b".into()), TextString("c".into()))]),
                ]),
            ),
            (
                "a56161614161626142616361436164614461656145",
                Map(vec![
                    (TextString("a".into()), TextString("A".into())),
                    (TextString("b".into()), TextString("B".into())),
                    (TextString("c".into()), TextString("C".into())),
                    (TextString("d".into()), TextString("D".into())),
                    (TextString("e".into()), TextString("E".into())),
                ]),
            ),
        ];

        for (hex, expected) in cases {
            let bytes = from_hex(hex);
            assert_eq!(
                CborParser::parse(&bytes).unwrap(),
                *expected,
                "failed for {hex}"
            );
        }
    }

    /// A tiny payload declaring an enormous length must error, not panic or
    /// attempt a huge allocation. Covers byte string, text string, array, and
    /// map, each declaring u64::MAX via an 8-byte length.
    #[test]
    fn oversized_length_does_not_panic() {
        let cases: &[&str] = &[
            "5bffffffffffffffff", // byte string, len = u64::MAX
            "7bffffffffffffffff", // text string, len = u64::MAX
            "9bffffffffffffffff", // array, count = u64::MAX
            "bbffffffffffffffff", // map, count = u64::MAX
        ];
        for hex in cases {
            let bytes = from_hex(hex);
            assert!(
                matches!(CborParser::parse(&bytes), Err(CborError::UnexpectedEof)),
                "expected UnexpectedEof for {hex}"
            );
        }
    }

    /// Deeply nested containers must error rather than recurse until the stack
    /// overflows. Eight nested single-element arrays (`81` headers) exceed
    /// MAX_DEPTH.
    #[test]
    fn excessive_nesting_does_not_overflow_stack() {
        let bytes = from_hex(&"81".repeat(8));
        assert!(
            matches!(CborParser::parse(&bytes), Err(CborError::MaxDepthExceeded)),
            "expected MaxDepthExceeded"
        );
    }

    /// Nesting up to the limit still parses: seven array headers wrapping a
    /// single integer stays within MAX_DEPTH.
    #[test]
    fn nesting_within_limit_parses() {
        use CborValue::*;
        let bytes = from_hex(&("81".repeat(7) + "00"));
        let mut value = CborParser::parse(&bytes).unwrap();
        for _ in 0..7 {
            match value {
                Array(mut items) => {
                    assert_eq!(items.len(), 1);
                    value = items.pop().unwrap();
                }
                other => panic!("expected nested array, got {other:?}"),
            }
        }
        assert_eq!(value, PositiveInteger(0));
    }

    /// Indefinite-length items are forbidden in CTAP2 canonical CBOR and must be
    /// rejected. Covers byte string, text string, array, and map (each `..1f`
    /// header followed by a `ff` break).
    #[test]
    fn indefinite_length_is_rejected() {
        let cases: &[&str] = &[
            "5fff", // indefinite byte string
            "7fff", // indefinite text string
            "9fff", // indefinite array
            "bfff", // indefinite map
        ];
        for hex in cases {
            let bytes = from_hex(hex);
            assert!(
                matches!(CborParser::parse(&bytes), Err(CborError::IndefiniteLength)),
                "expected IndefiniteLength for {hex}"
            );
        }
    }

    #[test]
    fn test_webauthn_attestation_object() {
        // {fmt: "none", attStmt: {}, authData: <4 bytes>}
        // Byte sequence from make_credential test
        let data = vec![
            163, 99, 102, 109, 116, 100, 110, 111, 110, 101, 103, 97, 116, 116, 83, 116, 109, 116,
            160, 104, 97, 117, 116, 104, 68, 97, 116, 97, 68, 1, 2, 3, 4,
        ];
        let value = CborParser::parse(&data).unwrap();
        let map = value.into_map().unwrap();
        let lookup: std::collections::HashMap<&str, &CborValue> = map
            .iter()
            .filter_map(|(k, v)| k.as_text().map(|s| (s, v)))
            .collect();
        assert_eq!(lookup["fmt"].as_text(), Some("none"));
        assert_eq!(
            lookup["authData"].as_bytes(),
            Some([1u8, 2, 3, 4].as_slice())
        );
    }
}
