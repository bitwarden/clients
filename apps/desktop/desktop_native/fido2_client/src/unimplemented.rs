use crate::{Fido2ClientError, PublicKeyCredential, PublicKeyCredentialRequestOptions};

pub(crate) fn get(
    _options: PublicKeyCredentialRequestOptions,
) -> Result<PublicKeyCredential, Fido2ClientError> {
    todo!("Fido2Client is unimplemented on this platform");
}

pub(crate) fn available() -> bool {
    false
}
