//! This file contains parsing logic for requests sent to the SSH agent.
//! Parsers must include test vectors recorded from real SSH operations.

use byteorder::ReadBytesExt;
use bytes::{Buf, Bytes};
use log::info;
use num_enum::{IntoPrimitive, TryFromPrimitive};
use std::fmt::Debug;

use crate::protocol::types::{PublicKey, RsaSigningScheme, SessionId, Signature};

/// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-protocol-messages`
/// The different types of requests that a client can send to the SSH agent.
#[allow(non_camel_case_types)]
#[derive(Debug, Eq, PartialEq, TryFromPrimitive, IntoPrimitive, Default)]
#[repr(u8)]
pub(crate) enum RequestType {
    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-requesting-a-list-of-keys`
    /// Request the list of keys the agent is holding
    SSH_AGENTC_REQUEST_IDENTITIES = 11,
    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-private-key-operations`
    /// Sign an authentication request or SSHSIG request
    SSH_AGENTC_SIGN_REQUEST = 13,
    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-extension-mechanism`
    /// Handle vendor specific extensions such as session binding
    SSH_AGENTC_EXTENSION = 27,
    /// An invalid request
    #[default]
    SSH_AGENTC_INVALID = 0,
}

/// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-signature-flags`
///
/// There are currently two flags defined which control which signature method
/// are used for RSA. These have no effect on other key types. If neither of these is defined,
/// RSA is used with SHA1, however this is deprecated and should not be used.
#[allow(non_camel_case_types)]
#[derive(Debug, Eq, PartialEq, TryFromPrimitive, IntoPrimitive)]
#[repr(u8)]
pub(crate) enum SshSignFlags {
    /// Sign with SHA256 if RSA is used
    SSH_AGENT_RSA_SHA2_256 = 2,
    /// Sign with SHA512 if RSA is used
    SSH_AGENT_RSA_SHA2_512 = 4,
}

#[derive(Debug)]
pub(crate) enum Request {
    /// Request the list of keys the agent is holding
    Identities,
    /// Sign an authentication request or SSHSIG request
    Sign(SshSignRequest),
    /// Session bind request
    SessionBind(SessionBindRequest),
}

impl TryFrom<&[u8]> for Request {
    type Error = anyhow::Error;

    // A protocol message consists of
    //
    // uint32 length
    // byte type
    // byte[length-1] contents
    //
    // The length is already stripped of in the `async_stream_wrapper::read_message`, so
    // the message is just type|contents.
    fn try_from(message: &[u8]) -> Result<Self, Self::Error> {
        if message.is_empty() {
            return Err(anyhow::anyhow!("Empty request"));
        }

        let r#type = RequestType::try_from_primitive(message[0])?;
        let contents = message[1..].to_vec();

        match r#type {
            RequestType::SSH_AGENTC_REQUEST_IDENTITIES => Ok(Request::Identities),
            RequestType::SSH_AGENTC_SIGN_REQUEST => {
                Ok(Request::Sign(contents.as_slice().try_into()?))
            }
            RequestType::SSH_AGENTC_EXTENSION => {
                // Only support session bind for now
                let extension_request: SessionBindRequest = contents.as_slice().try_into()?;
                if !extension_request.verify_signature() {
                    return Err(anyhow::anyhow!("Invalid session bind signature"));
                }
                Ok(Request::SessionBind(extension_request))
            }
            _ => Err(anyhow::anyhow!("Unsupported request type: {:?}", r#type)),
        }
    }
}

/// A sign request requests the agent to sign a blob of data with a specific key. The key is
/// referenced by its public key blob. The payload usually has a specific structure for auth
/// requests or SSHSIG requests. There are also flags supported that control signing behavior.
pub(crate) struct SshSignRequest {
    public_key: PublicKey,
    payload_to_sign: Vec<u8>,
    parsed_sign_request: ParsedSignRequest,
    flags: u32,
}

impl Debug for SshSignRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SshSignRequest")
            .field("public_key", &self.public_key)
            .field("parsed_sign_request", &self.parsed_sign_request)
            .field("flags", &self.flags)
            .finish()
    }
}

impl SshSignRequest {
    pub fn is_flag_set(&self, flag: SshSignFlags) -> bool {
        (self.flags & (flag as u32)) != 0
    }

    pub fn signing_scheme(&self) -> Option<RsaSigningScheme> {
        if self.is_flag_set(SshSignFlags::SSH_AGENT_RSA_SHA2_256) {
            Some(RsaSigningScheme::Pkcs1v15Sha256)
        } else if self.is_flag_set(SshSignFlags::SSH_AGENT_RSA_SHA2_512) {
            Some(RsaSigningScheme::Pkcs1v15Sha512)
        } else {
            None
        }
    }

    pub fn public_key(&self) -> &PublicKey {
        &self.public_key
    }

    pub fn payload_to_sign(&self) -> &[u8] {
        &self.payload_to_sign
    }

    pub fn parsed_payload(&self) -> &ParsedSignRequest {
        &self.parsed_sign_request
    }
}

impl TryFrom<&[u8]> for SshSignRequest {
    type Error = anyhow::Error;

    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-private-key-operations`
    ///  A private key operation is structured as follows:
    ///
    ///  byte             SSH_AGENTC_SIGN_REQUEST
    ///  string           key blob
    ///  string           data
    ///  uint32           flags
    ///
    /// In this case, the message already has the leading byte stripped off by the previous parsing code.
    fn try_from(mut message: &[u8]) -> Result<Self, Self::Error> {
        let public_key_blob = read_bytes(&mut message)?.clone();
        let data = read_bytes(&mut message)?;
        let flags = message
            .read_u32::<byteorder::BigEndian>()
            .map_err(|e| anyhow::anyhow!("Failed to read flags from sign request: {e}"))?;

        Ok(SshSignRequest {
            public_key: PublicKey::try_from_blob(public_key_blob)?,
            payload_to_sign: data.clone(),
            parsed_sign_request: data.as_slice().try_into()?,
            flags,
        })
    }
}

#[derive(Debug)]
pub enum ParsedSignRequest {
    SshSigRequest { namespace: String },
    SignRequest {},
}

impl<'a> TryFrom<&'a [u8]> for ParsedSignRequest {
    type Error = anyhow::Error;

    fn try_from(data: &'a [u8]) -> Result<Self, Self::Error> {
        let mut data = Bytes::copy_from_slice(data);
        let magic_header = "SSHSIG";
        let header = data.split_to(magic_header.len());

        // sshsig; based on https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig
        if header == magic_header.as_bytes() {
            let _version = data.get_u32();

            // read until null byte
            let namespace = data
                .into_iter()
                .take_while(|&x| x != 0)
                .collect::<Vec<u8>>();
            let namespace =
                String::from_utf8(namespace).map_err(|_| anyhow::anyhow!("Invalid namespace"))?;

            Ok(ParsedSignRequest::SshSigRequest { namespace })
        } else {
            Ok(ParsedSignRequest::SignRequest {})
        }
    }
}

fn read_bool(data: &mut &[u8]) -> Result<bool, anyhow::Error> {
    let byte = data
        .read_u8()
        .map_err(|e| anyhow::anyhow!("Failed to read bool: {e}"))?;
    match byte {
        0 => Ok(false),
        1 => Ok(true),
        _ => Err(anyhow::anyhow!("Invalid boolean value")),
    }
}

/// A helper function to read a length prefixed byte array
pub(super) fn read_bytes(data: &mut &[u8]) -> Result<Vec<u8>, anyhow::Error> {
    let length = data
        .read_u32::<byteorder::BigEndian>()
        .map_err(|e| anyhow::anyhow!("Failed to read length: {e}"))?;
    let mut buf = vec![
        0;
        length
            .try_into()
            .map_err(|_| anyhow::anyhow!("Invalid length"))?
    ];
    std::io::Read::read_exact(data, &mut buf)
        .map_err(|e| anyhow::anyhow!("Failed to read exact bytes: {e}"))?;
    Ok(buf)
}

enum Extension {
    SessionBind,
    Unsupported,
}

impl From<String> for Extension {
    fn from(value: String) -> Self {
        match value.as_str() {
            "session-bind@openssh.com" => Extension::SessionBind,
            _ => Extension::Unsupported,
        }
    }
}

/// https://www.openssh.com/agent-restrict.html
/// byte            SSH_AGENTC_EXTENSION (0x1b)
/// string          session-bind@openssh.com
/// string          hostkey
/// string          session identifier
/// string          signature
/// bool            is_forwarding
#[derive(Debug)]
pub(crate) struct SessionBindRequest {
    #[allow(unused)]
    host_key: PublicKey,
    #[allow(unused)]
    session_id: SessionId,
    #[allow(unused)]
    signature: Signature,
    #[allow(unused)]
    is_forwarding: bool,
}

impl SessionBindRequest {
    pub fn verify_signature(&self) -> bool {
        match self.signature.verify(
            &self.host_key,
            Vec::from(self.session_id.clone()).as_slice(),
        ) {
            Ok(valid) => {
                if !valid {
                    info!("Invalid session bind signature");
                }
                valid
            }
            Err(e) => {
                info!("Failed to verify session bind signature: {e}");
                false
            }
        }
    }

    pub fn host_key(&self) -> &PublicKey {
        &self.host_key
    }
}

impl TryFrom<&[u8]> for SessionBindRequest {
    type Error = anyhow::Error;

    fn try_from(mut message: &[u8]) -> Result<Self, Self::Error> {
        let extension_name = String::from_utf8(read_bytes(&mut message)?)
            .map_err(|_| anyhow::anyhow!("Invalid extension name"))?;
        match Extension::from(extension_name) {
            Extension::SessionBind => {
                let host_key = read_bytes(&mut message)?.try_into()?;
                let session_id = read_bytes(&mut message)?;
                let signature = read_bytes(&mut message)?;
                let is_forwarding = read_bool(&mut message)?;

                Ok(SessionBindRequest {
                    host_key,
                    session_id: SessionId::from(session_id),
                    signature: Signature::try_from(signature.as_slice())?,
                    is_forwarding,
                })
            }
            Extension::Unsupported => Err(anyhow::anyhow!("Unsupported extension")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Protocol Request Messages
    const TEST_VECTOR_REQUEST_LIST: &[u8] = &[11];
    const TEST_VECTOR_REQUEST_SIGN: &[u8] = &[
        13, 0, 0, 0, 51, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57, 0, 0, 0, 32,
        29, 223, 117, 159, 179, 182, 138, 116, 19, 26, 175, 28, 112, 116, 125, 161, 73, 110, 213,
        155, 210, 209, 216, 151, 51, 134, 209, 95, 89, 119, 233, 120, 0, 0, 0, 146, 0, 0, 0, 32,
        181, 207, 94, 63, 132, 40, 223, 192, 113, 235, 146, 168, 148, 99, 10, 232, 43, 52, 136,
        115, 113, 29, 242, 9, 69, 130, 8, 140, 111, 100, 189, 9, 50, 0, 0, 0, 3, 103, 105, 116, 0,
        0, 0, 14, 115, 115, 104, 45, 99, 111, 110, 110, 101, 99, 116, 105, 111, 110, 0, 0, 0, 9,
        112, 117, 98, 108, 105, 99, 107, 101, 121, 1, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50,
        53, 53, 49, 57, 0, 0, 0, 51, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57,
        0, 0, 0, 32, 29, 223, 117, 159, 179, 182, 138, 116, 19, 26, 175, 28, 112, 116, 125, 161,
        73, 110, 213, 155, 210, 209, 216, 151, 51, 134, 209, 95, 89, 119, 233, 120, 0, 0, 0, 0,
    ];

    // Inner messages for the sign request
    const TEST_VECTOR_REQUEST_SIGN_AUTHENTICATE: &[u8] = &[
        0, 0, 0, 32, 181, 207, 94, 63, 132, 40, 223, 192, 113, 235, 146, 168, 148, 99, 10, 232, 43,
        52, 136, 115, 113, 29, 242, 9, 69, 130, 8, 140, 111, 100, 189, 9, 50, 0, 0, 0, 3, 103, 105,
        116, 0, 0, 0, 14, 115, 115, 104, 45, 99, 111, 110, 110, 101, 99, 116, 105, 111, 110, 0, 0,
        0, 9, 112, 117, 98, 108, 105, 99, 107, 101, 121, 1, 0, 0, 0, 11, 115, 115, 104, 45, 101,
        100, 50, 53, 53, 49, 57, 0, 0, 0, 51, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53,
        49, 57, 0, 0, 0, 32, 29, 223, 117, 159, 179, 182, 138, 116, 19, 26, 175, 28, 112, 116, 125,
        161, 73, 110, 213, 155, 210, 209, 216, 151, 51, 134, 209, 95, 89, 119, 233, 120,
    ];
    const TEST_VECTOR_REQUEST_SIGN_SSHSIG_GIT: &[u8] = &[
        83, 83, 72, 83, 73, 71, 0, 0, 0, 3, 103, 105, 116, 0, 0, 0, 0, 0, 0, 0, 6, 115, 104, 97,
        53, 49, 50, 0, 0, 0, 64, 30, 64, 7, 140, 213, 231, 218, 138, 18, 144, 116, 7, 182, 82, 23,
        205, 39, 91, 32, 189, 66, 61, 26, 22, 93, 175, 87, 211, 52, 127, 62, 223, 177, 70, 125, 65,
        44, 147, 16, 177, 89, 5, 162, 230, 184, 137, 234, 155, 152, 93, 161, 105, 254, 223, 93,
        178, 118, 238, 176, 38, 145, 49, 56, 92,
    ];

    #[test]
    fn test_parse_identities_request() {
        let req = Request::try_from(TEST_VECTOR_REQUEST_LIST).expect("Should parse");
        assert!(matches!(req, Request::Identities));
    }

    #[test]
    fn test_parse_sign_request() {
        let req = Request::try_from(TEST_VECTOR_REQUEST_SIGN).expect("Should parse");
        assert!(matches!(req, Request::Sign { .. }));
    }

    #[test]
    fn test_parse_sign_authenticate_request() {
        let req = ParsedSignRequest::try_from(TEST_VECTOR_REQUEST_SIGN_AUTHENTICATE)
            .expect("Should parse");
        assert!(matches!(req, ParsedSignRequest::SignRequest {}));
    }

    #[test]
    fn test_parse_sign_sshsig_git_request() {
        let req =
            ParsedSignRequest::try_from(TEST_VECTOR_REQUEST_SIGN_SSHSIG_GIT).expect("Should parse");
        assert!(
            matches!(req, ParsedSignRequest::SshSigRequest { namespace } if namespace == *"git".to_string())
        );
    }
}
