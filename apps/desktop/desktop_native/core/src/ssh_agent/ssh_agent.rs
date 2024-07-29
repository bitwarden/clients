// based on: https://github.com/Eugeny/russh/blob/main/russh-keys/src/agent/server.rs

use std::collections::HashMap;
use std::convert::TryFrom;
use std::marker::Sync;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use async_trait::async_trait;
use byteorder::{BigEndian, ByteOrder};
use futures::future::Future;
use futures::stream::{Stream, StreamExt};
use russh_cryptovec::CryptoVec;
use russh_keys::encoding::{Encoding, Reader};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};
use tokio::time::sleep;
use {std, tokio};

use russh_keys::agent::Constraint;
use russh_keys::encoding::Position;
use russh_keys::{key, Error};
use crate::ssh_agent::msg;

#[derive(Clone)]
#[allow(clippy::type_complexity)]
pub struct KeyStore(pub Arc<RwLock<HashMap<Vec<u8>, (Arc<(key::KeyPair, String)>, Vec<Constraint>)>>>);

#[allow(missing_docs)]
#[derive(Debug)]
pub enum ServerError<E> {
    E(E),
    Error(Error),
}

pub enum MessageType {
    RequestKeys,
    AddKeys,
    RemoveKeys,
    RemoveAllKeys,
    Sign,
    Lock,
    Unlock,
}

#[async_trait]
pub trait Agent: Clone + Send + 'static {
    fn confirm(
        self,
        _pk: Arc<(key::KeyPair, String)>,
    ) -> Box<dyn Future<Output = (Self, bool)> + Unpin + Send> {
        Box::new(futures::future::ready((self, true)))
    }

    async fn confirm_request(&self, _msg: MessageType) -> bool {
        true
    }
}

pub async fn serve<S, L, A>(mut listener: L, agent: A, keys: KeyStore) -> Result<(), Error>
where
    S: AsyncRead + AsyncWrite + Send + Sync + Unpin + 'static,
    L: Stream<Item = tokio::io::Result<S>> + Unpin,
    A: Agent + Send + Sync + 'static,
{
    while let Some(Ok(stream)) = listener.next().await {
        let mut buf = CryptoVec::new();
        buf.resize(4);
        tokio::spawn(
            (Connection {
                keys: keys.clone(),
                agent: Some(agent.clone()),
                s: stream,
                buf: CryptoVec::new(),
            })
            .run(),
        );
    }
    Ok(())
}

impl Agent for () {
    fn confirm(
        self,
        _: Arc<(key::KeyPair, String)>,
    ) -> Box<dyn Future<Output = (Self, bool)> + Unpin + Send> {
        Box::new(futures::future::ready((self, true)))
    }
}

struct Connection<S: AsyncRead + AsyncWrite + Send + 'static, A: Agent> {
    keys: KeyStore,
    agent: Option<A>,
    s: S,
    buf: CryptoVec,
}

impl<S: AsyncRead + AsyncWrite + Send + Unpin + 'static, A: Agent + Send + Sync + 'static>
    Connection<S, A>
{
    async fn run(mut self) -> Result<(), Error> {
        let mut writebuf = CryptoVec::new();
        loop {
            // Reading the length
            self.buf.clear();
            self.buf.resize(4);
            self.s.read_exact(&mut self.buf).await?;
            // Reading the rest of the buffer
            let len = BigEndian::read_u32(&self.buf) as usize;
            self.buf.clear();
            self.buf.resize(len);
            self.s.read_exact(&mut self.buf).await?;
            // respond
            writebuf.clear();
            self.respond(&mut writebuf).await?;
            self.s.write_all(&writebuf).await?;
            self.s.flush().await?
        }
    }

    async fn respond(&mut self, writebuf: &mut CryptoVec) -> Result<(), Error> {
        writebuf.extend(&[0, 0, 0, 0]);
        let mut r = self.buf.reader(0);
        let agentref = self.agent.as_ref().ok_or(Error::AgentFailure)?;
        match r.read_byte() {
            Ok(11) if agentref.confirm_request(MessageType::RequestKeys).await => {
                // request identities
                if let Ok(keys) = self.keys.0.read() {
                    writebuf.push(msg::IDENTITIES_ANSWER);
                    writebuf.push_u32_be(keys.len() as u32);
                    for (k, n) in keys.iter() {
                        writebuf.extend_ssh_string(k);
                        writebuf.extend_ssh_string(n.0.1.as_bytes());
                    }
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(13) if agentref.confirm_request(MessageType::Sign).await => {
                // sign request
                let agent = self.agent.take().ok_or(Error::AgentFailure)?;
                let (agent, signed) = self.try_sign(agent, r, writebuf).await?;
                self.agent = Some(agent);
                if signed {
                    return Ok(());
                } else {
                    writebuf.resize(4);
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(17) if agentref.confirm_request(MessageType::AddKeys).await => {
                // add identity
                if let Ok(true) = self.add_key(r, false, writebuf).await {
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(18) if agentref.confirm_request(MessageType::RemoveKeys).await => {
                // remove identity
                if let Ok(true) = self.remove_identity(r) {
                    writebuf.push(msg::SUCCESS)
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(19) if agentref.confirm_request(MessageType::RemoveAllKeys).await => {
                // remove all identities
                if let Ok(mut keys) = self.keys.0.write() {
                    keys.clear();
                    writebuf.push(msg::SUCCESS)
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(22) if agentref.confirm_request(MessageType::Lock).await => {
                // lock
                if let Ok(()) = self.lock(r) {
                    writebuf.push(msg::SUCCESS)
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(23) if agentref.confirm_request(MessageType::Unlock).await => {
                // unlock
                if let Ok(true) = self.unlock(r) {
                    writebuf.push(msg::SUCCESS)
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            Ok(25) if agentref.confirm_request(MessageType::AddKeys).await => {
                // add identity constrained
                if let Ok(true) = self.add_key(r, true, writebuf).await {
                } else {
                    writebuf.push(msg::FAILURE)
                }
            }
            _ => {
                // Message not understood
                writebuf.push(msg::FAILURE)
            }
        }
        let len = writebuf.len() - 4;
        BigEndian::write_u32(&mut writebuf[..], len as u32);
        Ok(())
    }

    fn lock(&self, mut r: Position) -> Result<(), Error> {
        Ok(())
    }

    fn unlock(&self, mut r: Position) -> Result<bool, Error> {
        Ok(false)
    }

    fn remove_identity(&self, mut r: Position) -> Result<bool, Error> {
        Ok(false)
    }

    async fn add_key(
        &self,
        mut r: Position<'_>,
        constrained: bool,
        writebuf: &mut CryptoVec,
    ) -> Result<bool, Error> {
        Ok(false)
    }

    async fn try_sign(
        &self,
        agent: A,
        mut r: Position<'_>,
        writebuf: &mut CryptoVec,
    ) -> Result<(A, bool), Error> {
        let mut needs_confirm = false;
        let key = {
            let blob = r.read_string()?;
            let k = self.keys.0.read().or(Err(Error::AgentFailure))?;
            if let Some((key, constraints)) = k.get(blob) {
                if constraints.iter().any(|c| *c == Constraint::Confirm) {
                    needs_confirm = true;
                }
                key.clone()
            } else {
                return Ok((agent, false));
            }
        };
        let agent = if needs_confirm {
            let (agent, ok) = agent.confirm(key.clone()).await;
            if !ok {
                return Ok((agent, false));
            }
            agent
        } else {
            agent
        };
        writebuf.push(msg::SIGN_RESPONSE);
        let data = r.read_string()?;
        // todo parse whether this is a git sign request or ssh sign request

        key.0.add_signature(writebuf, data)?;
        let len = writebuf.len();
        BigEndian::write_u32(writebuf, (len - 4) as u32);

        Ok((agent, true))
    }
}
