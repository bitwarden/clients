#[cfg(all(target_os = "linux", target_env = "gnu"))]
mod ctap_hid_fido2;
#[cfg(all(target_os = "linux", target_env = "gnu"))]
use ctap_hid_fido2::*;

#[cfg(not(all(target_os = "linux", target_env = "gnu")))]
mod unimplemented;
#[cfg(not(all(target_os = "linux", target_env = "gnu")))]
use unimplemented::*;

#[cfg(all(target_os = "linux", target_env = "gnu"))]
/// Depending on the platform API, the platform MAY do this for you, or may require you to do it manually.
fn prf_to_hmac(prf_salt: &[u8]) -> [u8; 32] {
    use sha2::Digest;
    sha2::Sha256::digest(&[b"WebAuthn PRF".as_slice(), &[0], prf_salt].concat()).into()
}

#[derive(Debug, PartialEq, Clone)]
pub enum UserVerification {
    Discouraged,
    Preferred,
    Required,
}

#[derive(Debug, Clone)]
pub struct PrfConfig {
    pub first: Vec<u8>,
    pub second: Option<Vec<u8>>,
}

#[derive(Debug, Clone)]
pub struct PublicKeyCredentialRequestOptions {
    pub challenge: Vec<u8>,
    pub timeout: u64,
    pub rp_id: String,
    pub user_verification: UserVerification,
    pub allow_credentials: Vec<Vec<u8>>,
    pub prf: Option<PrfConfig>,
}

#[derive(Debug)]
pub struct AuthenticatorAssertionResponse {
    pub authenticator_data: Vec<u8>,
    pub client_data_json: Vec<u8>,
    pub signature: Vec<u8>,
    pub user_handle: Vec<u8>,
}

#[derive(Debug)]
pub struct PublicKeyCredential {
    pub authenticator_attachment: String,
    pub id: String,
    pub raw_id: Vec<u8>,
    pub response: AuthenticatorAssertionResponse,
    pub r#type: String,
    pub prf: Option<[u8; 32]>,
}

#[derive(Debug)]
pub enum Fido2ClientError {
    WrongPin,
    NoCredentials,
    NoDevice,
    InvalidInput,
    AssertionError,
}

pub mod fido2_client {
    pub fn get(
        assertion_options: super::PublicKeyCredentialRequestOptions,
    ) -> Result<super::PublicKeyCredential, super::Fido2ClientError> {
        super::get(assertion_options)
    }

    pub fn available() -> bool {
        super::available()
    }
}
