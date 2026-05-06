//! Crypto methods needed for verifying plugin requests from the OS.
//!
//! These methods are not intended to be generally useful; they are internal to
//! this crate. Passkey plugin implementations should use their own cryptography
//! libraries for passkey operations.

#![allow(non_snake_case)]
use std::mem::{self, MaybeUninit};

use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::E_INVALIDARG,
        Security::Cryptography::{
            BCryptCreateHash, BCryptDestroyHash, BCryptFinishHash, BCryptGetProperty,
            BCryptHashData, NCryptFreeObject, NCryptImportKey, NCryptOpenStorageProvider,
            NCryptVerifySignature, BCRYPT_HASH_HANDLE, BCRYPT_HASH_LENGTH, BCRYPT_KEY_BLOB,
            BCRYPT_OBJECT_LENGTH, BCRYPT_PSS_PADDING_INFO, BCRYPT_PUBLIC_KEY_BLOB,
            BCRYPT_RSAPUBLIC_MAGIC, BCRYPT_SHA256_ALGORITHM, BCRYPT_SHA256_ALG_HANDLE,
            NCRYPT_FLAGS, NCRYPT_HANDLE, NCRYPT_KEY_HANDLE, NCRYPT_PAD_PSS_FLAG,
            NCRYPT_PROV_HANDLE,
        },
    },
};

/// Parses a slice as a [BCRYPT_PUBLIC_KEY_BLOB].
pub(super) fn parse_public_key(data: &[u8]) -> Result<NCryptKey, windows::core::Error> {
    // BCRYPT_KEY_BLOB is a base structure for all types of keys used in the BCRYPT API.
    // Cf. https://learn.microsoft.com/en-us/windows/win32/api/bcrypt/ns-bcrypt-bcrypt_key_blob.
    //
    // The first field is a "magic" field that denotes the algorithm (RSA,
    // P-256, P-384, etc.) and subtype (public, private; RSA also has a
    // "full private" key that includes the key exponents and coefficients).
    //
    // The exact key types which the OS can return from webauthn.dll operations
    // is not currently documented, but we have observed RSA-PSS and ECDSA keys
    // (including P-256 and P-384). They may also evolve in the future (e.g.
    // different curves or PQ algorithms).
    //
    // Because of that, instead of using BCrypt APIs to verify the signature, we
    // use NCrypt, which parses the key blob header automatically to select the
    // correct EC curve. That way, we don't need to enumerate specific ECDSA
    // curve variants (P-256, P-384, P-521).
    //
    // We still detect RSA vs EC to choose the import blob type, and store the
    // RSA flag to apply PSS padding during verification.

    // The key blob comes with trailing data that is longer than the
    // BCRYPT_KEY_BLOB header, so we test to make sure it's at least as long as
    // the BCRYPT_KEY_BLOB header.
    if data.len() < size_of::<BCRYPT_KEY_BLOB>() {
        tracing::error!("Recived too small buffer");
        return Err(windows::core::Error::from_hresult(E_INVALIDARG));
    }
    let header: *const BCRYPT_KEY_BLOB = data.as_ptr().cast();
    if !header.is_aligned() {
        tracing::error!("Received unaligned pointer, not reading BCRYPT_KEY_BLOB.");
        return Err(windows::core::Error::from_hresult(E_INVALIDARG));
    }
    let magic = unsafe { (*header).Magic };
    tracing::debug!("Detected BCRYPT_KEY_BLOB key magic type: {}", magic);
    // RSA is detected solely to apply PSS padding during verification.
    // NCrypt parses the blob header to select the correct algorithm for all other key types.
    let is_rsa = magic == BCRYPT_RSAPUBLIC_MAGIC.0;
    if is_rsa {
        tracing::debug!("Detected RSA key");
    }

    tracing::debug!("Getting key handle");
    let provider_handle = unsafe {
        let mut handle = MaybeUninit::uninit();
        NCryptOpenStorageProvider(handle.as_mut_ptr(), PCWSTR::null(), 0)
            .inspect_err(|err| tracing::error!(%err, "Failed to open key storage provider"))?;
        NCryptProvider {
            handle: handle.assume_init(),
        }
    };
    let key_handle = unsafe {
        let mut key_handle = MaybeUninit::<NCRYPT_KEY_HANDLE>::uninit();
        NCryptImportKey(
            provider_handle.handle,
            None,
            BCRYPT_PUBLIC_KEY_BLOB,
            None,
            key_handle.as_mut_ptr(),
            data,
            NCRYPT_FLAGS(0),
        )
        .inspect_err(|err| tracing::error!(%err, "Failed to load key blob"))?;
        key_handle.assume_init()
    };

    Ok(NCryptKey {
        is_rsa,
        key_handle,
        _provider_handle: provider_handle,
    })
}
/// Verify a public key signature over a SHA-256 hash using Windows Crypto APIs.
///
/// The supported algorithms may change over time without notice, so the whole key blob
/// received from a call to a WebAuthn function.
///
/// Regardless of the key algorithm, the payload is always a SHA-256 hash (i.e., not SHA-384 for
/// P-384 curve, etc.).
pub(super) fn verify_signature(
    public_key: &NCryptKey,
    hash: RequestHash,
    signature: Signature,
) -> Result<(), windows::core::Error> {
    tracing::debug!("Verifying signature");
    let (padding_info, ncrypt_flags) = if public_key.is_rsa {
        // Contrary to the current Microsoft sample code, Windows Hello uses PSS padding.
        tracing::debug!("Detected RSA key, adding PSS padding");
        let padding_info = BCRYPT_PSS_PADDING_INFO {
            pszAlgId: BCRYPT_SHA256_ALGORITHM,
            cbSalt: 32,
        };
        (Some(padding_info), NCRYPT_PAD_PSS_FLAG)
    } else {
        // NCrypt selects the signing algorithm from the key type automatically.
        (None, NCRYPT_FLAGS(0))
    };
    let padding_info = padding_info
        .as_ref()
        .map(|padding| std::ptr::from_ref(padding).cast());
    unsafe {
        NCryptVerifySignature(
            public_key.key_handle,
            padding_info,
            hash.0,
            signature.0,
            ncrypt_flags,
        )?
    };
    tracing::debug!("Verified");
    Ok(())
}

/// Calculate a SHA-256 hash over some data.
pub(super) fn hash_sha256(data: &[u8]) -> Result<Vec<u8>, windows::core::Error> {
    // Hash data
    let sha256 = BcryptHash::sha256()?;
    unsafe { BCryptHashData(sha256.handle, data, 0).ok()? };

    {
        // Get length of SHA256 hash output
        let hash_output_len = {
            let mut hash_output_len_buf = [0; size_of::<u32>()];
            let mut bytes_read = 0;
            unsafe {
                BCryptGetProperty(
                    BCRYPT_SHA256_ALG_HANDLE.into(),
                    BCRYPT_HASH_LENGTH,
                    Some(&mut hash_output_len_buf),
                    &mut bytes_read,
                    0,
                )
                .ok()?;
            }
            u32::from_ne_bytes(hash_output_len_buf) as usize
        };

        let hash_buffer: Vec<u8> = {
            let mut hash_buffer: Vec<MaybeUninit<u8>> = Vec::with_capacity(hash_output_len);
            unsafe {
                {
                    // Temporarily treat the buffer as a byte slice to fit BCryptFinishHash
                    // parameter arguments.
                    let hash_slice: &mut [u8] = mem::transmute(hash_buffer.spare_capacity_mut());
                    BCryptFinishHash(sha256.handle, hash_slice, 0).ok()?;
                    // The hash handle is not usable after calling BCryptFinishHash, drop to clean
                    // up internal state.
                    drop(sha256);
                }
                // SAFETY: BCryptFinishHash initializes the buffer
                hash_buffer.set_len(hash_output_len);
                mem::transmute(hash_buffer)
            }
        };
        tracing::debug!(" Hash: {hash_buffer:?}");
        Ok(hash_buffer)
    }
}

struct BcryptHash {
    handle: BCRYPT_HASH_HANDLE,
}

impl BcryptHash {
    fn sha256() -> Result<Self, windows::core::Error> {
        let handle = {
            let mut hash_handle = MaybeUninit::uninit();
            // Get SHA256 handle
            unsafe {
                BCryptCreateHash(
                    BCRYPT_SHA256_ALG_HANDLE,
                    hash_handle.as_mut_ptr(),
                    None,
                    None,
                    0,
                )
                .ok()?;
                // SAFETY: BCryptCreateHash initializes hash_handle.
                hash_handle.assume_init()
            }
        };
        Ok(Self { handle })
    }
}

impl Drop for BcryptHash {
    fn drop(&mut self) {
        if !self.handle.is_invalid() {
            unsafe {
                if let Err(err) = BCryptDestroyHash(self.handle).to_hresult().ok() {
                    tracing::error!("Failed to clean up hash object: {err}");
                }
            }
        }
    }
}

struct NCryptProvider {
    handle: NCRYPT_PROV_HANDLE,
}

impl Drop for NCryptProvider {
    fn drop(&mut self) {
        if !self.handle.is_invalid() {
            unsafe {
                if let Err(err) = NCryptFreeObject(NCRYPT_HANDLE(self.handle.0)) {
                    tracing::error!("Failed to clean up provider handle: {err}");
                }
            }
        }
    }
}

pub(super) struct NCryptKey {
    is_rsa: bool,
    key_handle: NCRYPT_KEY_HANDLE,
    _provider_handle: NCryptProvider,
}

impl Drop for NCryptKey {
    fn drop(&mut self) {
        if !self.key_handle.is_invalid() {
            unsafe {
                if let Err(err) = NCryptFreeObject(NCRYPT_HANDLE(self.key_handle.0)) {
                    tracing::error!("Failed to clean up key handle: {err}");
                }
            }
        }
    }
}

#[derive(Debug)]
pub(crate) struct Signature<'a>(&'a [u8]);
impl<'a> Signature<'a> {
    pub(crate) fn new(value: &'a [u8]) -> Signature<'a> {
        Self(value)
    }
}

#[derive(Clone, Debug)]
pub(crate) struct OwnedRequestHash(pub(super) Vec<u8>);
impl OwnedRequestHash {
    pub(crate) fn to_vec(&self) -> Vec<u8> {
        self.0.to_vec()
    }
}

impl<'a> From<&'a OwnedRequestHash> for RequestHash<'a> {
    fn from(value: &'a OwnedRequestHash) -> RequestHash<'a> {
        RequestHash::new(&value.0)
    }
}

#[derive(Debug)]
pub(crate) struct RequestHash<'a>(&'a [u8]);

impl<'a> RequestHash<'a> {
    pub(crate) fn new(hash: &'a [u8]) -> Self {
        Self(hash)
    }
}
#[cfg(test)]
mod tests {
    use windows::Win32::Security::Cryptography::{
        BCRYPT_ECCKEY_BLOB, BCRYPT_ECDSA_PUBLIC_P256_MAGIC, BCRYPT_ECDSA_PUBLIC_P384_MAGIC,
        BCRYPT_ECDSA_PUBLIC_P521_MAGIC, BCRYPT_RSAKEY_BLOB, BCRYPT_RSAPUBLIC_MAGIC,
    };

    use super::{hash_sha256, verify_signature, RequestHash, Signature};
    use crate::api::plugin::crypto::parse_public_key;

    #[test]
    fn test_sha256_serializes_properly() {
        let data = b"abc";
        let digest = hash_sha256(data).unwrap();
        let expected = &[
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        assert_eq!(expected.as_slice(), digest.as_slice());
    }

    #[test]
    fn test_rsa_signature_verifies_properly() {
        // SHA-256 hash of "abc"
        let digest = vec![
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        /*
        Test private key used to create expected signature, generated by OpenSSL

        -----BEGIN PRIVATE KEY-----                                       // NOSONAR
        MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDxLbHhDspTRQDM  // NOSONAR
        NA2vTqznLjBztg6VNHiuS3iM1exO8cCZ2Xnorwj4Sk0LwDJg1KJHdpkQkf8IYMY4  // NOSONAR
        BmgTciZThoDp1VAqMNDRHRuYZsVRfHxPnVApNos0MOTe/D2+VkexIdf8scaAStAq  // NOSONAR
        R0XrVp/a+BPHFp9Vbm9LQDMigEXg1orzVLYL/mNadBpqyrjFiRsy7XqPO48T7TDs  // NOSONAR
        Zm3SxPUhX+9tLOCskXP2/tMxSgwSC1d/r+mn5TaT+M7CDtejzByyIIFMvgEBuD1Z  // NOSONAR
        2/POm4bz/SRxwvegdvNcTCb0HiNjAPdkvZ5gOOQAXfYPbuDKGs1MhFq1GtW24MN5  // NOSONAR
        Rp0q0QiFAgMBAAECggEBAOQqd7tUU8MdZ9jIch3kz5zSTNJbbUZo4rb5/W03wR0a  // NOSONAR
        hzzFyxh/53uGR4eTZ9XFtFTpdXuAs4cIjt5X6URkXK/ucq1FulZ/4j3DTOUMbSZf  // NOSONAR
        H/ft+vVSfbV9gDkY54zXcXG5c+3DfejHXlJxJUu0ovz0bzmNRGX9WVsWvImqUvGW  // NOSONAR
        EIDEKsFghLM79DYiGhmifO/gVhGUqaayxQAhcepOOVtwTPk9lpfYoxFQGvHdJKnL  // NOSONAR
        +vmQ00+K96zzl9WMuR6ypNhnDCOqUBnYrmSIjllr7w6IS1EDPvuu3lrsSWstMpV6  // NOSONAR
        SvmC+VXOJkDHgtkVMIlVfn2ATfzkqi62ID75f66mNCECgYEA/1zrB034l42B+k0+  // NOSONAR
        1ELvVytl1pCX1xBGsGTdnBpMS77yTxzCNx4YkMlg7EBygoQN5NC1ziCV1JK08eAr  // NOSONAR
        CY5YOaGEQNTRWXhWRLUy+Vyc4fxdsHWZSWBXzsRyJIoDuYLyiDRJIlOgRcuHv6jp  // NOSONAR
        smH+uUBUlq4YEgK+rbdYA21EMNkCgYEA8ce32ZpSjaG6toAP8blT4XFSMgxHUvCX  // NOSONAR
        7qQfHyPFKy0ANghF5hGgu3dMJ+GcHX3Z88PdwjFW+aABleaXKACvWZ+yK5bm9ijl  // NOSONAR
        3r3G2yGdbhh0d482rsu4++Hm5g4Ib+JbUnLHX8qeD0px0obPACCHoV2YGCu28Jip  // NOSONAR
        b9FxBPxOiY0CgYB0kBpsRCgULbDF61qhk0gi9xlOPsRAlBpgTDpoFgz7ilaazBrP  // NOSONAR
        A/rcpD+Mt8JNVy/sYWSLiY468RiNS/D5NLOK4vI2ka5Z87cVN8zjzGWENikh8hwd  // NOSONAR
        RU/vfvZHPYSDuoUwrQUxGREQqt31G4pJNbgLIZU7Do7IMd6N9yHCtq6oyQKBgCjA  // NOSONAR
        RsaQcjWY+sVj1EwjtnWbCgWReDwMfS8lznELMGJUlWKGBnH+qp6uPtHB/vQhkCi7  // NOSONAR
        7JachlJQm7POR8/gPa3XcspSBt+aiRP/3JJ2mfhCeu7j3o2bnLQnoSlJWDazajz9  // NOSONAR
        R4lntzhQjdq0ChO1Z+bUxZvdUlo/AN/t5yS1+e7JAoGAegATfCsssVR0Fe07YK/a  // NOSONAR
        +ufYuH4D0vw8cGzQrYYJKZlf1ra0DCKFZMBaIpNod3NFptQQeFYxIRylSfUtowx6  // NOSONAR
        /0wrRGqmSe8nZbzeNH7ueYR9VLFOySpA8uH+EIhJfKnAMMPakbYtKJ5nSZaVamjV  // NOSONAR
        URDbVszNO+xWdwug4sbJToU=                                          // NOSONAR
        -----END PRIVATE KEY-----                                         // NOSONAR
         */
        // extracted modulus from key above
        let modulus = vec![
            0xf1, 0x2d, 0xb1, 0xe1, 0x0e, 0xca, 0x53, 0x45, 0x00, 0xcc, 0x34, 0x0d, 0xaf, 0x4e,
            0xac, 0xe7, 0x2e, 0x30, 0x73, 0xb6, 0x0e, 0x95, 0x34, 0x78, 0xae, 0x4b, 0x78, 0x8c,
            0xd5, 0xec, 0x4e, 0xf1, 0xc0, 0x99, 0xd9, 0x79, 0xe8, 0xaf, 0x08, 0xf8, 0x4a, 0x4d,
            0x0b, 0xc0, 0x32, 0x60, 0xd4, 0xa2, 0x47, 0x76, 0x99, 0x10, 0x91, 0xff, 0x08, 0x60,
            0xc6, 0x38, 0x06, 0x68, 0x13, 0x72, 0x26, 0x53, 0x86, 0x80, 0xe9, 0xd5, 0x50, 0x2a,
            0x30, 0xd0, 0xd1, 0x1d, 0x1b, 0x98, 0x66, 0xc5, 0x51, 0x7c, 0x7c, 0x4f, 0x9d, 0x50,
            0x29, 0x36, 0x8b, 0x34, 0x30, 0xe4, 0xde, 0xfc, 0x3d, 0xbe, 0x56, 0x47, 0xb1, 0x21,
            0xd7, 0xfc, 0xb1, 0xc6, 0x80, 0x4a, 0xd0, 0x2a, 0x47, 0x45, 0xeb, 0x56, 0x9f, 0xda,
            0xf8, 0x13, 0xc7, 0x16, 0x9f, 0x55, 0x6e, 0x6f, 0x4b, 0x40, 0x33, 0x22, 0x80, 0x45,
            0xe0, 0xd6, 0x8a, 0xf3, 0x54, 0xb6, 0x0b, 0xfe, 0x63, 0x5a, 0x74, 0x1a, 0x6a, 0xca,
            0xb8, 0xc5, 0x89, 0x1b, 0x32, 0xed, 0x7a, 0x8f, 0x3b, 0x8f, 0x13, 0xed, 0x30, 0xec,
            0x66, 0x6d, 0xd2, 0xc4, 0xf5, 0x21, 0x5f, 0xef, 0x6d, 0x2c, 0xe0, 0xac, 0x91, 0x73,
            0xf6, 0xfe, 0xd3, 0x31, 0x4a, 0x0c, 0x12, 0x0b, 0x57, 0x7f, 0xaf, 0xe9, 0xa7, 0xe5,
            0x36, 0x93, 0xf8, 0xce, 0xc2, 0x0e, 0xd7, 0xa3, 0xcc, 0x1c, 0xb2, 0x20, 0x81, 0x4c,
            0xbe, 0x01, 0x01, 0xb8, 0x3d, 0x59, 0xdb, 0xf3, 0xce, 0x9b, 0x86, 0xf3, 0xfd, 0x24,
            0x71, 0xc2, 0xf7, 0xa0, 0x76, 0xf3, 0x5c, 0x4c, 0x26, 0xf4, 0x1e, 0x23, 0x63, 0x00,
            0xf7, 0x64, 0xbd, 0x9e, 0x60, 0x38, 0xe4, 0x00, 0x5d, 0xf6, 0x0f, 0x6e, 0xe0, 0xca,
            0x1a, 0xcd, 0x4c, 0x84, 0x5a, 0xb5, 0x1a, 0xd5, 0xb6, 0xe0, 0xc3, 0x79, 0x46, 0x9d,
            0x2a, 0xd1, 0x08, 0x85,
        ];
        // 65537 = 0x010001, big-endian, 3 bytes
        let public_exponent = [0x01u8, 0x00, 0x01];
        let key_header = BCRYPT_RSAKEY_BLOB {
            Magic: BCRYPT_RSAPUBLIC_MAGIC,
            BitLength: 2048,
            cbPublicExp: public_exponent.len() as u32,
            cbModulus: modulus.len() as u32,
            cbPrime1: 0,
            cbPrime2: 0,
        };

        let mut public_key_bytes: Vec<u8> = unsafe {
            std::slice::from_raw_parts(
                std::ptr::from_ref(&key_header).cast::<u8>(),
                std::mem::size_of::<BCRYPT_RSAKEY_BLOB>(),
            )
        }
        .to_vec();
        public_key_bytes.extend_from_slice(&public_exponent);
        public_key_bytes.extend_from_slice(&modulus);

        // generated with openssl
        let signature = &[
            0x82, 0xd0, 0xb5, 0xb3, 0xf6, 0xd5, 0x4f, 0x65, 0xd9, 0x14, 0x54, 0xec, 0xc7, 0x09,
            0xfd, 0x42, 0x4b, 0xff, 0x37, 0x03, 0x89, 0xef, 0x7f, 0x9b, 0x24, 0xc4, 0x3c, 0x84,
            0x34, 0xfc, 0x60, 0x46, 0x84, 0x0b, 0x64, 0x3e, 0xdc, 0xca, 0x06, 0x32, 0xb8, 0xab,
            0x48, 0xfc, 0x1c, 0xba, 0xf4, 0x31, 0x3f, 0x1b, 0xa3, 0xee, 0xec, 0xaf, 0x15, 0x7b,
            0x1e, 0x04, 0xc6, 0x0c, 0x74, 0x17, 0xca, 0x0a, 0x5f, 0xa8, 0x21, 0x29, 0xe0, 0x00,
            0x65, 0x36, 0x02, 0x32, 0xcc, 0xab, 0x60, 0x9f, 0x16, 0x78, 0x43, 0x81, 0xc7, 0xa0,
            0x0e, 0xaa, 0x2f, 0x3a, 0x74, 0x1d, 0xf3, 0x16, 0xf2, 0x65, 0x14, 0x2a, 0xb6, 0x78,
            0x33, 0x3f, 0x3b, 0x53, 0x4d, 0x6e, 0xe6, 0x5a, 0xeb, 0x50, 0x07, 0x01, 0xf1, 0x4d,
            0x42, 0x76, 0x29, 0x20, 0x6f, 0x6f, 0xfc, 0x83, 0xfa, 0x88, 0x08, 0x73, 0xb0, 0xb3,
            0x1f, 0x41, 0x11, 0x28, 0xfc, 0x15, 0x4e, 0x49, 0x83, 0x55, 0xf9, 0x8f, 0x50, 0xa0,
            0x56, 0x02, 0xc5, 0x7e, 0x79, 0xa4, 0xba, 0x90, 0x43, 0x3d, 0x19, 0x1a, 0xd1, 0xaf,
            0xbf, 0xd9, 0x37, 0x42, 0xf1, 0xd6, 0x3f, 0x52, 0x89, 0x6e, 0xce, 0x68, 0xb2, 0x6f,
            0x90, 0x08, 0x51, 0x2d, 0x1d, 0x4a, 0x40, 0xc3, 0x16, 0xd3, 0xf1, 0x2e, 0xf4, 0x3b,
            0x7b, 0x48, 0xfd, 0xda, 0x3d, 0x01, 0xfa, 0x0d, 0x28, 0xe5, 0xf8, 0x79, 0x58, 0x2d,
            0xe8, 0x83, 0xe0, 0xcd, 0xde, 0x9d, 0x02, 0xba, 0x9d, 0xac, 0xb7, 0x33, 0x87, 0x42,
            0x33, 0xad, 0x05, 0x3d, 0xe0, 0x29, 0xf9, 0x8e, 0xba, 0xb9, 0xf3, 0xed, 0x25, 0xf2,
            0x47, 0x17, 0x6b, 0x0d, 0xed, 0x65, 0xab, 0xe7, 0xbc, 0xa4, 0x0e, 0x54, 0x44, 0xdf,
            0x9c, 0x6d, 0x69, 0x6c, 0x13, 0x9b, 0x51, 0x97, 0x69, 0xae, 0x99, 0xf4, 0x53, 0xde,
            0x5c, 0xd3, 0x4d, 0xab,
        ];

        let public_key = parse_public_key(&public_key_bytes).unwrap();
        verify_signature(&public_key, RequestHash(&digest), Signature(signature))
            .expect("a signature to verify properly");
    }

    #[test]
    fn test_p384_signature_verifies_properly() {
        // SHA-256 hash of "abc"
        let digest = vec![
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        /*
        Test private key used to create expected signature, generated by OpenSSL

        -----BEGIN PRIVATE KEY-----                                      // NOSONAR
        MIICDAIBADCCAWQGByqGSM49AgEwggFXAgEBMDwGByqGSM49AQECMQD///////// // NOSONAR
        /////////////////////////////////v////8AAAAAAAAAAP////8wewQw//// // NOSONAR
        //////////////////////////////////////7/////AAAAAAAAAAD////8BDCz // NOSONAR
        MS+n4j7n5JiOBWvj+C0ZGB2cbv6BQRIDFAiPUBOHWsZWOY2KLtGdKoXI7dPsKu8D // NOSONAR
        FQCjNZJqoxmieh0AiWpnc6SCes2scwRhBKqHyiK+iwU3jrHHHvMgrXRuHTtii6eb // NOSONAR
        mFn3QeCCVCo4VQLyXb9VKWw6VF44cnYKtzYX3kqWJixvXZ6Yv5KS3Cn49B29KJoU // NOSONAR
        fOnaMRO18LjACmCxzh1+gZ16Qx18kOoOXwIxAP////////////////////////// // NOSONAR
        /////8djTYH0Ny3fWBoNskiwp3rs7BlqzMUpcwIBAQSBnjCBmwIBAQQwhL/0kQDy // NOSONAR
        6VNH5op7R6mvyUth/0KXz7+/3E4bAW1bDngC/TTDdUL1mTL1i4iN0j+AoWQDYgAE // NOSONAR
        ub2c2ielLaE8+cCrwjw1LV8AGTLLz9yxLjSiJgPOfwHYCXP+wKVU1hsurlCYnQdn // NOSONAR
        7Kkj5uCTLDspCY+PIM2QQ6t246no9d/FeujLzv/GHP9K+QsC/qjbQ+WGJ4m5dGTo // NOSONAR
        -----END PRIVATE KEY-----                                        // NOSONAR

        Signature generated with:
        openssl pkeyutl -sign -inkey p384.key.pem -in hash.bin -out sig_der.bin
        Converted from DER to IEEE P1363 (r || s) format.
         */
        // P-384 public key X coordinate (48 bytes, big-endian)
        let x: &[u8] = &[
            0xb9, 0xbd, 0x9c, 0xda, 0x27, 0xa5, 0x2d, 0xa1, 0x3c, 0xf9, 0xc0, 0xab, 0xc2, 0x3c,
            0x35, 0x2d, 0x5f, 0x00, 0x19, 0x32, 0xcb, 0xcf, 0xdc, 0xb1, 0x2e, 0x34, 0xa2, 0x26,
            0x03, 0xce, 0x7f, 0x01, 0xd8, 0x09, 0x73, 0xfe, 0xc0, 0xa5, 0x54, 0xd6, 0x1b, 0x2e,
            0xae, 0x50, 0x98, 0x9d, 0x07, 0x67,
        ];
        // P-384 public key Y coordinate (48 bytes, big-endian)
        let y: &[u8] = &[
            0xec, 0xa9, 0x23, 0xe6, 0xe0, 0x93, 0x2c, 0x3b, 0x29, 0x09, 0x8f, 0x8f, 0x20, 0xcd,
            0x90, 0x43, 0xab, 0x76, 0xe3, 0xa9, 0xe8, 0xf5, 0xdf, 0xc5, 0x7a, 0xe8, 0xcb, 0xce,
            0xff, 0xc6, 0x1c, 0xff, 0x4a, 0xf9, 0x0b, 0x02, 0xfe, 0xa8, 0xdb, 0x43, 0xe5, 0x86,
            0x27, 0x89, 0xb9, 0x74, 0x64, 0xe8,
        ];
        let key_header = BCRYPT_ECCKEY_BLOB {
            dwMagic: BCRYPT_ECDSA_PUBLIC_P384_MAGIC,
            cbKey: 48, // P-384: 384 bits / 8 = 48 bytes per coordinate
        };
        let mut public_key_bytes: Vec<u8> = unsafe {
            std::slice::from_raw_parts(
                std::ptr::from_ref(&key_header).cast::<u8>(),
                std::mem::size_of::<BCRYPT_ECCKEY_BLOB>(),
            )
        }
        .to_vec();
        public_key_bytes.extend_from_slice(x);
        public_key_bytes.extend_from_slice(y);
        let public_key = parse_public_key(&public_key_bytes).unwrap();

        // ECDSA signature in IEEE P1363 format (r || s), each 48 bytes, big-endian
        let signature: &[u8] = &[
            0x2b, 0xc0, 0x76, 0x7f, 0x79, 0x82, 0xec, 0x5f, 0xd2, 0xe9, 0xd1, 0x68, 0x37, 0x5f,
            0x6c, 0x2b, 0x14, 0xda, 0x27, 0x81, 0xed, 0x91, 0x88, 0x9e, 0x1c, 0x0a, 0x5e, 0xfd,
            0x8d, 0xfb, 0xca, 0x3b, 0x31, 0x0e, 0x06, 0x48, 0x42, 0x75, 0xcd, 0x29, 0xd9, 0x23,
            0x76, 0xf9, 0xcf, 0x6f, 0x37, 0xa1, 0xb7, 0x73, 0x1c, 0xc4, 0xba, 0xa8, 0x16, 0x8f,
            0xd7, 0xef, 0x9b, 0x67, 0x6d, 0xab, 0x61, 0x62, 0x02, 0x3c, 0x64, 0xb5, 0x72, 0xe0,
            0xcf, 0x86, 0xa7, 0x04, 0x78, 0x74, 0xb8, 0x68, 0x92, 0x46, 0x61, 0x14, 0xfd, 0x2b,
            0xa4, 0x28, 0x2a, 0xb9, 0x6d, 0x05, 0xf4, 0x61, 0xf2, 0x76, 0x32, 0x8c,
        ];
        verify_signature(&public_key, RequestHash(&digest), Signature(signature))
            .expect("a signature to verify properly");
    }

    #[test]
    fn test_p256_signature_verifies_properly() {
        // SHA-256 hash of "abc"
        let digest = vec![
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        /*
        Test private key used to create expected signature, generated by OpenSSL

        -----BEGIN PRIVATE KEY-----                                      // NOSONAR
        MIIBeQIBADCCAQMGByqGSM49AgEwgfcCAQEwLAYHKoZIzj0BAQIhAP////8AAAAB // NOSONAR
        AAAAAAAAAAAAAAAA////////////////MFsEIP////8AAAABAAAAAAAAAAAAAAAA // NOSONAR
        ///////////////8BCBaxjXYqjqT57PrvVV2mIa8ZR0GsMxTsPY7zjw+J9JgSwMV // NOSONAR
        AMSdNgiG5wSTamZ44ROdJreBn36QBEEEaxfR8uEsQkf4vOblY6RA8ncDfYEt6zOg // NOSONAR
        9KE5RdiYwpZP40Li/hp/m47n60p8D54WK84zV2sxXs7LtkBoN79R9QIhAP////8A // NOSONAR
        AAAA//////////+85vqtpxeehPO5ysL8YyVRAgEBBG0wawIBAQQg/grBMmNCqKg1 // NOSONAR
        8kAjQFqMsmuFf/l5MO/GP3zEEqzcR4yhRANCAASk4KnUT1k3ruE4fbAQm5HQQVb4 // NOSONAR
        JEeWo53xOgSlJm2/6arp39vcqZCNYL+39JaaauWAFlm7TD2jvrQQurvYl8Sk     // NOSONAR
        -----END PRIVATE KEY-----                                        // NOSONAR

        Signature generated with:
        openssl pkeyutl -sign -inkey p256.key.pem -in hash.bin -out sig_der.bin
        Converted from DER to IEEE P1363 (r || s) format.
         */
        // P-256 public key X coordinate (32 bytes, big-endian)
        let x: &[u8] = &[
            0xa4, 0xe0, 0xa9, 0xd4, 0x4f, 0x59, 0x37, 0xae, 0xe1, 0x38, 0x7d, 0xb0, 0x10, 0x9b,
            0x91, 0xd0, 0x41, 0x56, 0xf8, 0x24, 0x47, 0x96, 0xa3, 0x9d, 0xf1, 0x3a, 0x04, 0xa5,
            0x26, 0x6d, 0xbf, 0xe9,
        ];
        // P-256 public key Y coordinate (32 bytes, big-endian)
        let y: &[u8] = &[
            0xaa, 0xe9, 0xdf, 0xdb, 0xdc, 0xa9, 0x90, 0x8d, 0x60, 0xbf, 0xb7, 0xf4, 0x96, 0x9a,
            0x6a, 0xe5, 0x80, 0x16, 0x59, 0xbb, 0x4c, 0x3d, 0xa3, 0xbe, 0xb4, 0x10, 0xba, 0xbb,
            0xd8, 0x97, 0xc4, 0xa4,
        ];
        let key_header = BCRYPT_ECCKEY_BLOB {
            dwMagic: BCRYPT_ECDSA_PUBLIC_P256_MAGIC,
            cbKey: 32, // P-256: 256 bits / 8 = 32 bytes per coordinate
        };
        let mut public_key_bytes: Vec<u8> = unsafe {
            std::slice::from_raw_parts(
                std::ptr::from_ref(&key_header).cast::<u8>(),
                std::mem::size_of::<BCRYPT_ECCKEY_BLOB>(),
            )
        }
        .to_vec();
        public_key_bytes.extend_from_slice(x);
        public_key_bytes.extend_from_slice(y);
        let public_key = parse_public_key(&public_key_bytes).unwrap();
        // ECDSA signature in IEEE P1363 format (r || s), each 32 bytes, big-endian
        let signature: &[u8] = &[
            0x55, 0x8d, 0x74, 0x5e, 0x35, 0x15, 0xbd, 0x56, 0x99, 0x0c, 0xf2, 0x09, 0x99, 0x00,
            0x2e, 0x92, 0x2b, 0x64, 0x3b, 0xf6, 0x07, 0x5f, 0xc4, 0xd1, 0x10, 0xbc, 0xb7, 0xf2,
            0xc4, 0x39, 0x0a, 0x84, 0x3e, 0xda, 0xc6, 0x5c, 0xc9, 0x9a, 0x7a, 0x94, 0x94, 0x08,
            0x7b, 0xac, 0xdd, 0x25, 0x08, 0x37, 0x33, 0xe4, 0xf5, 0xb6, 0xfd, 0xc2, 0x10, 0x7e,
            0xe9, 0xd0, 0xbf, 0xcd, 0x4c, 0xfe, 0xd0, 0x41,
        ];
        verify_signature(&public_key, RequestHash(&digest), Signature(signature))
            .expect("a signature to verify properly");
    }

    #[test]
    fn test_p521_signature_verifies_properly() {
        // SHA-256 hash of "abc"
        let digest = vec![
            0xba, 0x78, 0x16, 0xbf, 0x8f, 0x01, 0xcf, 0xea, 0x41, 0x41, 0x40, 0xde, 0x5d, 0xae,
            0x22, 0x23, 0xb0, 0x03, 0x61, 0xa3, 0x96, 0x17, 0x7a, 0x9c, 0xb4, 0x10, 0xff, 0x61,
            0xf2, 0x00, 0x15, 0xad,
        ];
        /*
        Test private key used to create expected signature, generated by OpenSSL

        -----BEGIN PRIVATE KEY-----                                      // NOSONAR
        MIICrwIBADCCAc8GByqGSM49AgEwggHCAgEBME0GByqGSM49AQECQgH///////// // NOSONAR
        //////////////////////////////////////////////////////////////// // NOSONAR
        /////////////zCBngRCAf////////////////////////////////////////// // NOSONAR
        ///////////////////////////////////////////8BEFRlT65YY4cmh+SmiGg // NOSONAR
        toVA7qLacluZsxXzuLSJkY7xCeFWGTlR7H6TexZSwL07sb8HNXPfiD0sNPHvRR/U  // NOSONAR
        a1A/AAMVANCeiAApHLhTlsxnFzkyhKqg2mS6BIGFBADGhY4GtwQE6c2ePstmI5W0 // NOSONAR
        QpxkgTkFP7Uh+CivYGtNPbqhS1537+dZKP4dwSei/6jeM0izwYVqQpv5fn4xwuW9 // NOSONAR
        ZgEYOSlqeJo7wARcil+0LH0b2Zj1RElXm0RoF6+9Fyc+ZiyX7nKZXvQmQMVQuQE/ // NOSONAR
        rQdhNTxwhqJywkCIvpR2n9FmUAJCAf////////////////////////////////// // NOSONAR
        ////////+lGGh4O/L5Zrf8wBSPcJpdA7tcm4iZxHrrtvtx6ROGQJAgEBBIHWMIHT // NOSONAR
        AgEBBEIBiHOVMi7SQiSeY6hqL3ilLEY/AB7pVe3gqcY2I3RPM59eegWRFXds8q5W // NOSONAR
        6KS3fVYkvT92vyRbcLLvcjGh429wz2GhgYkDgYYABAE0TENXeEO/G7Swkc1pnfS7 // NOSONAR
        mfWaoqnl485oXDaRZ3ktCHHcpsfaggM44j8ZNmXm4ePJ3rFZtWW9qxKKn239yms9 // NOSONAR
        UgGVLHrBoRxicVBiU5gMFOcJOARdHfz59dYORen/alGjQzeoi2ZadbrHl8CXyOkf // NOSONAR
        B9vqsDMhjFpMh6hps2x3s8EkNA==                                     // NOSONAR
        -----END PRIVATE KEY-----                                        // NOSONAR

        Signature generated with:
        openssl pkeyutl -sign -inkey p521.key.pem -in hash.bin -out sig_der.bin
        Converted from DER to IEEE P1363 (r || s) format.
         */
        // P-521 public key X coordinate (66 bytes, big-endian)
        let x: &[u8] = &[
            0x01, 0x34, 0x4c, 0x43, 0x57, 0x78, 0x43, 0xbf, 0x1b, 0xb4, 0xb0, 0x91, 0xcd, 0x69,
            0x9d, 0xf4, 0xbb, 0x99, 0xf5, 0x9a, 0xa2, 0xa9, 0xe5, 0xe3, 0xce, 0x68, 0x5c, 0x36,
            0x91, 0x67, 0x79, 0x2d, 0x08, 0x71, 0xdc, 0xa6, 0xc7, 0xda, 0x82, 0x03, 0x38, 0xe2,
            0x3f, 0x19, 0x36, 0x65, 0xe6, 0xe1, 0xe3, 0xc9, 0xde, 0xb1, 0x59, 0xb5, 0x65, 0xbd,
            0xab, 0x12, 0x8a, 0x9f, 0x6d, 0xfd, 0xca, 0x6b, 0x3d, 0x52,
        ];
        // P-521 public key Y coordinate (66 bytes, big-endian)
        let y: &[u8] = &[
            0x01, 0x95, 0x2c, 0x7a, 0xc1, 0xa1, 0x1c, 0x62, 0x71, 0x50, 0x62, 0x53, 0x98, 0x0c,
            0x14, 0xe7, 0x09, 0x38, 0x04, 0x5d, 0x1d, 0xfc, 0xf9, 0xf5, 0xd6, 0x0e, 0x45, 0xe9,
            0xff, 0x6a, 0x51, 0xa3, 0x43, 0x37, 0xa8, 0x8b, 0x66, 0x5a, 0x75, 0xba, 0xc7, 0x97,
            0xc0, 0x97, 0xc8, 0xe9, 0x1f, 0x07, 0xdb, 0xea, 0xb0, 0x33, 0x21, 0x8c, 0x5a, 0x4c,
            0x87, 0xa8, 0x69, 0xb3, 0x6c, 0x77, 0xb3, 0xc1, 0x24, 0x34,
        ];
        let key_header = BCRYPT_ECCKEY_BLOB {
            dwMagic: BCRYPT_ECDSA_PUBLIC_P521_MAGIC,
            cbKey: 66, // P-521: ceil(521 / 8) = 66 bytes per coordinate
        };
        let mut public_key_bytes: Vec<u8> = unsafe {
            std::slice::from_raw_parts(
                std::ptr::from_ref(&key_header).cast::<u8>(),
                std::mem::size_of::<BCRYPT_ECCKEY_BLOB>(),
            )
        }
        .to_vec();
        public_key_bytes.extend_from_slice(x);
        public_key_bytes.extend_from_slice(y);
        let public_key = parse_public_key(&public_key_bytes).unwrap();

        // ECDSA signature in IEEE P1363 format (r || s), each 66 bytes, big-endian
        let signature: &[u8] = &[
            0x00, 0x89, 0x94, 0x84, 0xe2, 0xad, 0xc2, 0x9e, 0x91, 0xc9, 0x5a, 0x18, 0x87, 0xec,
            0x1b, 0x22, 0xa0, 0x4d, 0xab, 0x2e, 0xbb, 0x82, 0x94, 0xdc, 0x51, 0xf7, 0x33, 0x17,
            0x4c, 0xa5, 0x14, 0x65, 0x6a, 0x07, 0x94, 0xfc, 0x4a, 0x43, 0x9a, 0xa4, 0x89, 0xf5,
            0x2e, 0x8c, 0x14, 0x3f, 0x74, 0xa2, 0xc2, 0x42, 0xc8, 0x29, 0xf7, 0x82, 0x47, 0x64,
            0x92, 0xb4, 0xd5, 0x9a, 0x20, 0x84, 0x38, 0xf7, 0x0c, 0xb8, 0x00, 0xeb, 0xec, 0xf3,
            0xeb, 0xc7, 0x5d, 0xbe, 0x36, 0x53, 0xb6, 0xc9, 0xe0, 0xe3, 0xa5, 0xb0, 0x07, 0xda,
            0x8f, 0x97, 0x03, 0x6f, 0xe9, 0x11, 0x14, 0xbf, 0xdc, 0x75, 0x48, 0x36, 0xf5, 0xf2,
            0x03, 0xb7, 0xad, 0x4a, 0xc6, 0x12, 0x05, 0x7a, 0xd2, 0x6f, 0x1a, 0x8f, 0x0d, 0xd9,
            0x84, 0x04, 0x63, 0x47, 0xb7, 0x4b, 0x29, 0xa5, 0x3a, 0xe3, 0x7f, 0x27, 0x87, 0x38,
            0x61, 0xca, 0xe2, 0x85, 0xd5, 0x6d,
        ];
        verify_signature(&public_key, RequestHash(&digest), Signature(signature))
            .expect("a signature to verify properly");
    }
}
