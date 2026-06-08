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

// Unencrypted 2048-bit RSA test key for testing only
const TEST_RSA_PEM: &str = "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAQEA8nnAt1NQAzh5C6lybBVgdfmhxL96Jddpl0Z4vlb7iysdW5oj7b09
rWUpQmPrW+Qpc+pJWVF++FQvjyEtTQwV/FHJsqYMZIpS98dQVWC1IZeQbPdsa3Ey5YmM3S
/tf9UpqCcKG5J2ZJYeayVSerfRZFKgMhu8wmLaGxPk153Z5lj6RkBFE28j058ivN55IZcX
hd0qvbDIpvCV9W1Qo4x/ia7es3se3kJc+IwXu/rkE5KM0RDVzLmuZ5R1wOMXcTZ4ceG9by
viJXvSIb6CYE1zGMt5gFvLtNHTyzExqtpsLe3DfufzSl5wN1HcRDcLyU949Lvf6XxHqWfc
aWm26q3nYQAAA8j0V6qC9FeqggAAAAdzc2gtcnNhAAABAQDyecC3U1ADOHkLqXJsFWB1+a
HEv3ol12mXRni+VvuLKx1bmiPtvT2tZSlCY+tb5Clz6klZUX74VC+PIS1NDBX8Ucmypgxk
ilL3x1BVYLUhl5Bs92xrcTLliYzdL+1/1SmoJwobknZklh5rJVJ6t9FkUqAyG7zCYtobE+
TXndnmWPpGQEUTbyPTnyK83nkhlxeF3Sq9sMim8JX1bVCjjH+Jrt6zex7eQlz4jBe7+uQT
kozRENXMua5nlHXA4xdxNnhx4b1vK+Ile9IhvoJgTXMYy3mAW8u00dPLMTGq2mwt7cN+5/
NKXnA3UdxENwvJT3j0u9/pfEepZ9xpabbqredhAAAAAwEAAQAAAQBQ/yLFGmtr5/1nS98R
A8MJJa5IDr46zc5T3hKPYnb8chaIduDxlXl45oX1y3Lfa0P9mJGP6I1FXrnUUfzT8+mUM6
3wo08YdqxoYIgRPRDEe+CexbfN3C5oRp5rdIsdXJNhvEjAFRi/WPYoTHtUyvqDTKZ+lo1j
UaoRyX90FyKmswPR9dcG130M4MrKYWA8rz7XtnMaR1IbLb3AnlfOhfMKsOWklgNPBpDAoH
HMeYVBhva+LN2+VpRVnLaZ2yM747UEMJymLR6gvVN+uAyOMZscOJ8wNKhnf59UfEZummA1
k1Q+H+bkCoOcpx8MqT7mad+5dMCvU5oyGnjhZ00srEzBAAAAgDVKPCR0n4IC/wUCaPmniw
x+H5HxG4NPRxdKQegRxCZjpZxxNFFbO3Kxfu/kppkAR9kI3y7OEszYJvDnnz69h+S2UBww
Bdnv6VzEtAysx98X70KyoA4fUa8l1D6wNwwjC1Mfty6vsJ7fH8NylzlhkpiBt2ZmqvD4fz
rJoMCqGE2PAAAAgQD7Vx7zZ+1xr+fzdmVEA5/NVFXLd7BmSDndUeUmOX1dlc1MH93PYtC6
eoByaz9J/bibbJtExyBPq2J7yQbx/6tp4BJ1WkJNhNKfc1gNYiY0mhbV5/TOZOu33IcOk+
USl3hJCuja+cL5O+txPUoxp+5CWx0yb69jTbYdjiz5eCj7dQAAAIEA9viPLqCgGdXoNXWS
8y/XETvN4EVFg2kleUcabSb2jrJ9hEr6ERJ1bRWtIbnwHC2QUNjXF+41MYBbjpbf+BVEsl
SP5DsnXG3RJCI4fE9sUM81avDnDXKbDH7IgbqRc8hHnhQnE2d2wBnpiDedVu4m6BKTGWKM
vt8T5DsruwPs+r0AAAAQdGVzdEBleGFtcGxlLmNvbQECAw==
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

/// Returns the SSH wire-format public key blob for the test Ed25519 key.
pub fn test_ed25519_key_blob() -> Vec<u8> {
    ssh_key::PrivateKey::from_openssh(TEST_ED25519_PEM)
        .expect("test PEM should be valid")
        .public_key()
        .to_bytes()
        .expect("ed25519 public key encoding should succeed")
}

pub fn test_rsa_key() -> SSHKeyData {
    SSHKeyData::from_private_key_pem(
        TEST_RSA_PEM,
        "Test RSA Key".to_string(),
        "cipher-rsa-1".to_string(),
    )
    .expect("test RSA PEM should be valid")
}

/// Returns the SSH wire-format public key blob for the test RSA key.
pub fn test_rsa_key_blob() -> Vec<u8> {
    ssh_key::PrivateKey::from_openssh(TEST_RSA_PEM)
        .expect("test RSA PEM should be valid")
        .public_key()
        .to_bytes()
        .expect("RSA public key encoding should succeed")
}

/// Returns a public key blob with an unsupported algorithm (DSA).
// The blob only needs the algorithm-name prefix to trigger a keystore lookup; no valid DSA key
// material is required because the agent returns FAILURE as soon as it cannot find the key.
pub fn unsupported_dsa_key_blob() -> Vec<u8> {
    let alg = b"ssh-dss";
    let mut blob = Vec::new();
    blob.extend_from_slice(&(alg.len() as u32).to_be_bytes());
    blob.extend_from_slice(alg);
    blob
}

/// Builds a framed SSH REQUEST_IDENTITIES message (type byte 11).
pub fn framed_request_identities() -> Vec<u8> {
    let mut frame = 1u32.to_be_bytes().to_vec();
    frame.push(11u8);
    frame
}

/// Builds a framed SSH SIGN_REQUEST message (type byte 13).
pub fn framed_sign_request(blob: &[u8], data: &[u8], flags: u32) -> Vec<u8> {
    let mut body = vec![13u8]; // SSH2_AGENTC_SIGN_REQUEST
    body.extend_from_slice(&(blob.len() as u32).to_be_bytes());
    body.extend_from_slice(blob);
    body.extend_from_slice(&(data.len() as u32).to_be_bytes());
    body.extend_from_slice(data);
    body.extend_from_slice(&flags.to_be_bytes());

    let mut framed = (body.len() as u32).to_be_bytes().to_vec();
    framed.extend(body);
    framed
}

/// Extracts the algorithm name string from a SIGN_RESPONSE body.
///
/// SIGN_RESPONSE layout (after `read_framed_response`):
/// - byte 0:   type (14)
/// - bytes 1–4: outer signature string length
/// - bytes 5–8: algorithm name length
/// - bytes 9..: algorithm name
pub fn parse_sign_response_algorithm(response: &[u8]) -> String {
    let alg_len = u32::from_be_bytes(response[5..9].try_into().expect("4-byte slice")) as usize;
    String::from_utf8(response[9..9 + alg_len].to_vec()).expect("valid UTF-8 algorithm name")
}

/// Creates an agent whose approval handler always denies sign requests.
pub fn always_denying_agent() -> BitwardenSSHAgent<InMemoryEncryptedKeyStore, MockApprovalRequester>
{
    let mut requester = MockApprovalRequester::new();
    requester
        .expect_request_sign_approval()
        .returning(|_| Ok(false));
    BitwardenSSHAgent::new(InMemoryEncryptedKeyStore::new(), requester)
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

fn write_ssh_string(buf: &mut Vec<u8>, data: &[u8]) {
    buf.extend_from_slice(&(data.len() as u32).to_be_bytes());
    buf.extend_from_slice(data);
}

fn make_session_bind_payload(
    keypair: &ssh_key::private::Ed25519Keypair,
    session_id: &[u8],
    is_forwarding: bool,
) -> Vec<u8> {
    use signature::Signer as _;
    use ssh_key::private::KeypairData;

    let private_key = ssh_key::PrivateKey::new(KeypairData::Ed25519(keypair.clone()), "")
        .expect("key generation not to fail.");
    let hostkey_bytes = private_key
        .public_key()
        .to_bytes()
        .expect("conversion to bytes not to fail.");
    let sig: ssh_key::Signature = keypair.sign(session_id);

    let mut sig_outer = Vec::new();
    write_ssh_string(&mut sig_outer, sig.algorithm().to_string().as_bytes());
    write_ssh_string(&mut sig_outer, sig.as_bytes());

    let mut payload = Vec::new();
    write_ssh_string(&mut payload, &hostkey_bytes);
    write_ssh_string(&mut payload, session_id);
    write_ssh_string(&mut payload, &sig_outer);
    payload.push(u8::from(is_forwarding));
    payload
}

/// Builds a framed EXTENSION message containing a valid session-bind payload.
pub fn framed_session_bind_extension(is_forwarding: bool) -> Vec<u8> {
    use ssh_key::{private::Ed25519Keypair, rand_core::OsRng};

    let keypair = Ed25519Keypair::random(&mut OsRng);
    let session_id = [0x42u8; 32];
    let bind_payload = make_session_bind_payload(&keypair, &session_id, is_forwarding);

    let name = b"session-bind@openssh.com";
    let mut msg = vec![27u8]; // SSH2_AGENTC_EXTENSION
    write_ssh_string(&mut msg, name);
    msg.extend_from_slice(&bind_payload);

    let mut framed = (msg.len() as u32).to_be_bytes().to_vec();
    framed.extend(msg);
    framed
}

/// Builds a framed EXTENSION message with the session-bind name but a garbage payload.
pub fn framed_invalid_session_bind_extension() -> Vec<u8> {
    let name = b"session-bind@openssh.com";
    let garbage = [0xDE, 0xAD, 0xBE, 0xEF];
    let mut msg = vec![27u8]; // SSH2_AGENTC_EXTENSION
    write_ssh_string(&mut msg, name);
    msg.extend_from_slice(&garbage);

    let mut framed = (msg.len() as u32).to_be_bytes().to_vec();
    framed.extend(msg);
    framed
}
