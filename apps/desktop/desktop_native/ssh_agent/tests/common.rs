//! Shared helpers for integration tests

use ssh_agent::{
    ApprovalError, ApprovalRequester, BitwardenSSHAgent, InMemoryEncryptedKeyStore, SSHKeyData,
    SignApprovalRequest,
};

// Unencrypted Ed25519 test key for testing only
const TEST_ED25519_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACAOYor3+kyAsXYs2sGikmUuhpxmVf2hAGd2TK7KwN4N9gAAAJj79ujB+/bo
wQAAAAtzc2gtZWQyNTUxOQAAACAOYor3+kyAsXYs2sGikmUuhpxmVf2hAGd2TK7KwN4N9g
AAAEAgAQkLDKjON00XO+Y09BoIBuQsAXAx6HUhQoTEodVzig5iivf6TICxdizawaKSZS6G
nGZV/aEAZ3ZMrsrA3g32AAAAEHRlc3RAZXhhbXBsZS5jb20BAgMEBQ==
-----END OPENSSH PRIVATE KEY-----";

pub fn init_tracing() {
    let _ = tracing_subscriber::fmt().with_test_writer().try_init();
}

pub fn always_approving_agent(
) -> BitwardenSSHAgent<InMemoryEncryptedKeyStore, MockApprovalRequester> {
    let mut requester = MockApprovalRequester::new();
    requester
        .expect_request_sign_approval()
        .returning(|_| Ok(true));
    BitwardenSSHAgent::new(InMemoryEncryptedKeyStore::new(), requester)
}

pub fn agent_with_keys(
    keys: Vec<SSHKeyData>,
) -> BitwardenSSHAgent<InMemoryEncryptedKeyStore, MockApprovalRequester> {
    let agent = always_approving_agent();
    agent.replace(keys).expect("failed to replace test keys");
    agent
}

pub fn test_ed25519_key() -> SSHKeyData {
    SSHKeyData::from_private_key_pem(
        TEST_ED25519_PEM,
        "Test Key".to_string(),
        "cipher-test-1".to_string(),
    )
    .expect("test PEM should be valid")
}

/// Builds a framed SSH REQUEST_IDENTITIES message (type byte 11).
pub fn framed_request_identities() -> Vec<u8> {
    let mut frame = 1u32.to_be_bytes().to_vec();
    frame.push(11u8);
    frame
}

/// Reads a single length-prefixed response frame from any async reader.
pub async fn read_framed_response<R>(reader: &mut R) -> Vec<u8>
where
    R: tokio::io::AsyncRead + Unpin,
{
    use tokio::io::AsyncReadExt;
    let mut len_buf = [0u8; 4];
    reader
        .read_exact(&mut len_buf)
        .await
        .expect("failed to read response length");
    let len = u32::from_be_bytes(len_buf) as usize;
    let mut body = vec![0u8; len];
    reader
        .read_exact(&mut body)
        .await
        .expect("failed to read response body");
    body
}

/// Parses the human-readable name of the first key from an IDENTITIES_ANSWER body.
pub fn parse_first_key_name(response: &[u8]) -> String {
    // byte 0: type; bytes 1-4: count; then for each key: [4-byte blob_len][blob][4-byte
    // name_len][name]
    let blob_len = u32::from_be_bytes(response[5..9].try_into().expect("4-byte slice")) as usize;
    let name_offset = 9 + blob_len;
    let name_len = u32::from_be_bytes(
        response[name_offset..name_offset + 4]
            .try_into()
            .expect("4-byte slice"),
    ) as usize;
    String::from_utf8(response[name_offset + 4..name_offset + 4 + name_len].to_vec())
        .expect("valid UTF-8 key name")
}

mockall::mock! {
    pub ApprovalRequester {}

    #[async_trait::async_trait]
    impl ApprovalRequester for ApprovalRequester {
        async fn request_sign_approval(
            &self,
            request: SignApprovalRequest,
        ) -> Result<bool, ApprovalError>;
    }
}
