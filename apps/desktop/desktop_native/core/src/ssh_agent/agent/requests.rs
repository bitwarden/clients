use byteorder::ReadBytesExt;
use bytes::{Buf, Bytes};
use num_enum::{IntoPrimitive, TryFromPrimitive};

use crate::ssh_agent::agent::agent::SshPublicKey;

#[allow(non_camel_case_types)]
#[derive(Debug, Eq, PartialEq, TryFromPrimitive, IntoPrimitive, Default)]
#[repr(u8)]
pub enum ClientRequest {
    SSH_AGENTC_REQUEST_IDENTITIES = 11,
    SSH_AGENTC_SIGN_REQUEST = 13,
    SSH_AGENTC_EXTENSION = 27,
    #[default]
    SSH_AGENTC_INVALID = 0,
}

#[allow(non_camel_case_types)]
#[derive(Debug, Eq, PartialEq, TryFromPrimitive, IntoPrimitive)]
#[repr(u8)]
pub enum SshSignFlags {
    SSH_AGENT_RSA_SHA2_256 = 2,
    SSH_AGENT_RSA_SHA2_512 = 4,
}

#[derive(Debug)]
pub(crate) enum AgentRequest {
    IdentitiesRequest,
    SignRequest(SshSignRequest),
}

impl TryFrom<Vec<u8>> for AgentRequest {
    type Error = anyhow::Error;

    fn try_from(value: Vec<u8>) -> Result<Self, Self::Error> {
        if value.is_empty() {
            return Err(anyhow::anyhow!("Empty request"));
        }

        let request_type = ClientRequest::try_from_primitive(value[0])
            .map_err(|_| anyhow::anyhow!("Failed to parse request type"))?;
        let request_body = value[1..].to_vec();

        match request_type {
            ClientRequest::SSH_AGENTC_REQUEST_IDENTITIES => Ok(AgentRequest::IdentitiesRequest),
            ClientRequest::SSH_AGENTC_SIGN_REQUEST => {
                let sign_request = SshSignRequest::try_from(request_body.as_slice())
                    .map_err(|e| anyhow::anyhow!("Failed to parse sign request: {e}"))?;
                Ok(AgentRequest::SignRequest(sign_request))
            }
            _ => Err(anyhow::anyhow!(
                "Unsupported request type: {:?}",
                request_type
            )),
        }
    }
}

#[derive(Debug)]
pub(crate) struct SshSignRequest {
    pub(crate) public_key: SshPublicKey,
    pub(crate) payload_to_sign: Vec<u8>,
    pub(crate) parsed_sign_request: ParsedSignRequest,
    flags: u32,
}

impl SshSignRequest {
    pub fn is_flag_set(&self, flag: SshSignFlags) -> bool {
        (self.flags & (flag as u32)) != 0
    }
}

impl TryFrom<&[u8]> for SshSignRequest {
    type Error = anyhow::Error;

    fn try_from(mut value: &[u8]) -> Result<Self, Self::Error> {
        let public_key = SshPublicKey::from(read_bytes(&mut value)?.to_vec());
        let data = read_bytes(&mut value)?;
        let parsed_sign_request = ParsedSignRequest::try_from(data.as_slice())?;

        let flags = value
            .read_u32::<byteorder::BigEndian>()
            .map_err(|e| anyhow::anyhow!("Failed to read flags from sign request: {e}"))?;

        Ok(SshSignRequest {
            public_key: public_key,
            payload_to_sign: data,
            parsed_sign_request,
            flags,
        })
    }
}

#[derive(Debug)]
pub(crate) enum ParsedSignRequest {
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

fn read_bytes(data: &mut &[u8]) -> Result<Vec<u8>, anyhow::Error> {
    let length = data
        .read_u32::<byteorder::BigEndian>()
        .map_err(|e| anyhow::anyhow!("Failed to read length: {e}"))?;
    let mut buf = vec![0; length as usize];
    std::io::Read::read_exact(data, &mut buf)
        .map_err(|e| anyhow::anyhow!("Failed to read exact bytes: {e}"))?;
    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_VECTOR_REQUEST_LIST: &[u8] = &[11];
    const TEST_VECTOR_REQUEST_SIGN: &[u8] = &[13, 0, 0, 0, 51, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57, 0, 0, 0, 32, 29, 223, 117, 159, 179, 182, 138, 116, 19, 26, 175, 28, 112, 116, 125, 161, 73, 110, 213, 155, 210, 209, 216, 151, 51, 134, 209, 95, 89, 119, 233, 120, 0, 0, 0, 146, 0, 0, 0, 32, 181, 207, 94, 63, 132, 40, 223, 192, 113, 235, 146, 168, 148, 99, 10, 232, 43, 52, 136, 115, 113, 29, 242, 9, 69, 130, 8, 140, 111, 100, 189, 9, 50, 0, 0, 0, 3, 103, 105, 116, 0, 0, 0, 14, 115, 115, 104, 45, 99, 111, 110, 110, 101, 99, 116, 105, 111, 110, 0, 0, 0, 9, 112, 117, 98, 108, 105, 99, 107, 101, 121, 1, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57, 0, 0, 0, 51, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57, 0, 0, 0, 32, 29, 223, 117, 159, 179, 182, 138, 116, 19, 26, 175, 28, 112, 116, 125, 161, 73, 110, 213, 155, 210, 209, 216, 151, 51, 134, 209, 95, 89, 119, 233, 120, 0, 0, 0, 0];
    // Inner packets for the sign request
    const TEST_VECTOR_REQUEST_SIGN_AUTHENTICATE: &[u8] =  &[0, 0, 0, 32, 181, 207, 94, 63, 132, 40, 223, 192, 113, 235, 146, 168, 148, 99, 10, 232, 43, 52, 136, 115, 113, 29, 242, 9, 69, 130, 8, 140, 111, 100, 189, 9, 50, 0, 0, 0, 3, 103, 105, 116, 0, 0, 0, 14, 115, 115, 104, 45, 99, 111, 110, 110, 101, 99, 116, 105, 111, 110, 0, 0, 0, 9, 112, 117, 98, 108, 105, 99, 107, 101, 121, 1, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57, 0, 0, 0, 51, 0, 0, 0, 11, 115, 115, 104, 45, 101, 100, 50, 53, 53, 49, 57, 0, 0, 0, 32, 29, 223, 117, 159, 179, 182, 138, 116, 19, 26, 175, 28, 112, 116, 125, 161, 73, 110, 213, 155, 210, 209, 216, 151, 51, 134, 209, 95, 89, 119, 233, 120];
    const TEST_VECTOR_REQUEST_SIGN_SSHSIG_GIT: &[u8] = &[83, 83, 72, 83, 73, 71, 0, 0, 0, 3, 103, 105, 116, 0, 0, 0, 0, 0, 0, 0, 6, 115, 104, 97, 53, 49, 50, 0, 0, 0, 64, 30, 64, 7, 140, 213, 231, 218, 138, 18, 144, 116, 7, 182, 82, 23, 205, 39, 91, 32, 189, 66, 61, 26, 22, 93, 175, 87, 211, 52, 127, 62, 223, 177, 70, 125, 65, 44, 147, 16, 177, 89, 5, 162, 230, 184, 137, 234, 155, 152, 93, 161, 105, 254, 223, 93, 178, 118, 238, 176, 38, 145, 49, 56, 92];

    #[test]
    fn test_parse_identities_request() {
        let req = AgentRequest::try_from(TEST_VECTOR_REQUEST_LIST.to_vec()).expect("Should parse");
        assert!(matches!(req, AgentRequest::IdentitiesRequest));
    }

    #[test]
    fn test_parse_sign_request() {
        let req = AgentRequest::try_from(TEST_VECTOR_REQUEST_SIGN.to_vec()).expect("Should parse");
        assert!(matches!(req, AgentRequest::SignRequest { .. }));
    }

    #[test]
    fn test_parse_sign_authenticate_request() {
    let req = ParsedSignRequest::try_from(TEST_VECTOR_REQUEST_SIGN_AUTHENTICATE).expect("Should parse");
    assert!(matches!(req, ParsedSignRequest::SignRequest {}));
    }

    #[test]
    fn test_parse_sign_sshsig_git_request() {
    let req = ParsedSignRequest::try_from(TEST_VECTOR_REQUEST_SIGN_SSHSIG_GIT).expect("Should parse");
    assert!(matches!(req, ParsedSignRequest::SshSigRequest { namespace } if namespace == "git".to_string()));
    }

    
}