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
    let magic_header = "SSHSIG";
    let mut data_iter = data.to_vec().into_iter();
    let header = data_iter
        .by_ref()
        .take(magic_header.len())
        .collect::<Vec<u8>>();

    // sshsig; based on https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.sshsig
    if header == magic_header.as_bytes() {
        let version = data_iter.by_ref().take(4).collect::<Vec<u8>>();
        let _version = u32::from_be_bytes(
            version
                .try_into()
                .map_err(|_| anyhow::anyhow!("Invalid version"))?,
        );

        // read until null byte
        let namespace = data_iter
            .by_ref()
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
