use crate::{Fido2ClientError, PublicKeyCredential, PublicKeyCredentialRequestOptions};

pub fn get(
    _options: PublicKeyCredentialRequestOptions,
) -> Result<PublicKeyCredential, Fido2ClientError> {
    todo!("Fido2Client is unimplemented on this platform");
}

pub fn available() -> bool {
    false
}
