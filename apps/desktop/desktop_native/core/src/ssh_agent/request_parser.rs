use bytes::{Buf, Bytes};

#[derive(Debug)]
pub(crate) struct SshSigRequest {
    pub namespace: String,
}

#[derive(Debug)]
pub(crate) struct SignRequest {}

#[derive(Debug)]
pub(crate) enum SshAgentSignRequest {
    SshSigRequest(SshSigRequest),
    SignRequest(SignRequest),
}

pub(crate) fn parse_request(data: &[u8]) -> Result<SshAgentSignRequest, anyhow::Error> {
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

        Ok(SshAgentSignRequest::SshSigRequest(SshSigRequest {
            namespace,
        }))
    } else {
        // regular sign request
        Ok(SshAgentSignRequest::SignRequest(SignRequest {}))
    }
}
