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

/// Struct to write CBOR-encoded data to a writer.
pub(crate) struct CborWriter<'a, W: Write> {
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

#[cfg(test)]
mod tests {
    use std::io::ErrorKind;

    use super::CborWriter;

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
}
