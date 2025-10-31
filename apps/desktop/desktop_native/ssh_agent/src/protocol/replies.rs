use num_enum::{IntoPrimitive, TryFromPrimitive};
use ssh_encoding::Encode;

use crate::protocol::types::{PrivateKey, PublicKeyWithName, RsaSigningScheme, Signature};

/// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-protocol-messages`
/// The different types of replies that the SSH agent can send to a client.
#[allow(non_camel_case_types)]
#[derive(Debug, Eq, PartialEq, TryFromPrimitive, IntoPrimitive, Default)]
#[repr(u8)]
pub enum ReplyType {
    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-generic-server-responses`
    /// Generic response indicating failure
    /// Unsupported extensions must be replied to with SSH_AGENT_FAILURE.
    SSH_AGENT_FAILURE = 5,
    /// Generic response indicating success
    SSH_AGENT_SUCCESS = 6,

    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-extension-mechanism`
    /// Failure within an extension are replied to with this message.
    SSH_AGENT_EXTENSION_FAILURE = 28,
    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-requesting-a-list-of-keys`
    /// Response to `RequestType::SSH_AGENTC_REQUEST_IDENTITIES`
    SSH_AGENT_IDENTITIES_ANSWER = 12,
    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-private-key-operations`
    /// Response to `RequestType::SSH_AGENTC_SIGN_REQUEST`
    SSH_AGENT_SIGN_RESPONSE = 14,
    /// Invalid reply type
    #[default]
    SSH_AGENT_INVALID = 0,
}

/// A reply is structured as a single byte indicating the type, followed by a
/// payload that is structured according to the type.
pub struct ReplyFrame {
    /// The serialized frame structured as
    /// reply_type|payload
    raw_frame: Vec<u8>,
}

impl ReplyFrame {
    pub fn new(reply: ReplyType, payload: &[u8]) -> Self {
        let mut raw_frame = Vec::new();
        Into::<u8>::into(reply)
            .encode(&mut raw_frame)
            .expect("Encoding into Vec cannot fail");
        raw_frame.extend_from_slice(payload);
        Self { raw_frame }
    }
}

impl From<&ReplyFrame> for Vec<u8> {
    fn from(val: &ReplyFrame) -> Self {
        val.raw_frame.clone()
    }
}

pub(crate) struct IdentitiesReply {
    keys: Vec<PublicKeyWithName>,
}

impl IdentitiesReply {
    pub fn new(keys: Vec<PublicKeyWithName>) -> Self {
        Self { keys }
    }

    /// https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-requesting-a-list-of-keys
    /// The reply to a request is structured as:
    ///
    /// byte SSH_AGENT_IDENTITIES_ANSWER
    /// uint32 nkeys
    /// [
    ///   string public key blob
    ///   string comment (a utf-8 string)
    ///   ... (nkeys times)
    /// ]
    pub fn encode(&self) -> Result<ReplyFrame, ssh_encoding::Error> {
        let mut reply_message = Vec::new();
        Ok(ReplyFrame::new(ReplyType::SSH_AGENT_IDENTITIES_ANSWER, {
            reply_message.clear();
            (self.keys.len() as u32).encode(&mut reply_message)?;
            for key in &self.keys {
                key.key.encode(&mut reply_message)?;
                key.name.encode(&mut reply_message)?;
            }
            &reply_message
        }))
    }
}

pub(crate) struct SshSignReply(Signature);

impl SshSignReply {
    pub fn try_create(
        private_key: &PrivateKey,
        data: &[u8],
        requested_signing_scheme: Option<RsaSigningScheme>,
    ) -> Result<Self, anyhow::Error> {
        Ok(Self(
            // Note, this should take into account the extension / signing scheme.
            private_key.sign(data, requested_signing_scheme)?,
        ))
    }

    /// `https://www.ietf.org/archive/id/draft-miller-ssh-agent-11.html#name-private-key-operations`
    /// A reply to a sign request is structured as:
    ///
    /// byte SSH_AGENT_SIGN_RESPONSE
    /// string signature blob
    pub fn encode(&self) -> Result<ReplyFrame, ssh_encoding::Error> {
        let mut reply_payload = Vec::new();
        Ok(ReplyFrame::new(ReplyType::SSH_AGENT_SIGN_RESPONSE, {
            self.0.encode()?.encode(&mut reply_payload)?;
            &reply_payload
        }))
    }
}

pub(crate) struct AgentExtensionFailure;
impl AgentExtensionFailure {
    pub fn new() -> Self {
        Self {}
    }
}

impl From<AgentExtensionFailure> for ReplyFrame {
    fn from(_value: AgentExtensionFailure) -> Self {
        ReplyFrame::new(ReplyType::SSH_AGENT_EXTENSION_FAILURE, &[])
    }
}

pub(crate) struct AgentFailure;
impl AgentFailure {
    pub fn new() -> Self {
        Self {}
    }
}

impl From<AgentFailure> for ReplyFrame {
    fn from(_value: AgentFailure) -> Self {
        ReplyFrame::new(ReplyType::SSH_AGENT_FAILURE, &[])
    }
}

pub(crate) struct AgentSuccess;
impl AgentSuccess {
    pub fn new() -> Self {
        Self {}
    }
}

impl From<AgentSuccess> for ReplyFrame {
    fn from(_value: AgentSuccess) -> Self {
        ReplyFrame::new(ReplyType::SSH_AGENT_SUCCESS, &[])
    }
}
