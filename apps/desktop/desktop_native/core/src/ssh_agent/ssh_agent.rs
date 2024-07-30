// based on: https://github.com/Eugeny/russh/blob/main/russh-keys/src/agent/server.rs

use std::collections::HashMap;
use std::marker::Sync;
use std::sync::{Arc, RwLock};

use byteorder::{BigEndian, ByteOrder};
use futures::stream::{Stream, StreamExt};
use russh_cryptovec::CryptoVec;
use russh_keys::encoding::{Encoding, Reader};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use russh_keys::agent::Constraint;
use russh_keys::encoding::Position;
use russh_keys::{key, Error};
use crate::ssh_agent::msg;

use super::msg::{REQUEST_IDENTITIES, SIGN_REQUEST};

#[derive(Clone)]
#[allow(clippy::type_complexity)]
pub struct KeyStore(pub Arc<RwLock<HashMap<Vec<u8>, (Arc<(key::KeyPair, String, String)>, Vec<Constraint>)>>>);

#[allow(missing_docs)]
#[derive(Debug)]
pub enum ServerError<E> {
    E(E),
    Error(Error),
}

pub trait Agent: Clone + Send + 'static {
    fn confirm(
        &self,
        _pk: Arc<(key::KeyPair, String, String)>,
    ) -> impl std::future::Future<Output = bool> + std::marker::Send{async {
        true
    }}
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
        let keys = keys.clone();
        let agent = agent.clone();
        
        tokio::spawn(async move {
            let _ = Connection {
                keys,
                agent: Some(agent),
                s: stream,
                buf: CryptoVec::new(),
            }.run().await;
        });
    }
    Ok(())
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
        match r.read_byte() {
            Ok(REQUEST_IDENTITIES) => {
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
            Ok(SIGN_REQUEST) => {
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
            _ => {
                // Message not understood
                writebuf.push(msg::FAILURE)
            }
        }
        let len = writebuf.len() - 4;
        BigEndian::write_u32(&mut writebuf[..], len as u32);
        Ok(())
    }

    async fn try_sign(
        &self,
        agent: A,
        mut r: Position<'_>,
        writebuf: &mut CryptoVec,
    ) -> Result<(A, bool), Error> {
        let key = {
            let blob = r.read_string()?;
            let k = self.keys.0.read().or(Err(Error::AgentFailure))?;
            if let Some((key, _constraints)) = k.get(blob) {
                key.clone()
            } else {
                return Ok((agent, false));
            }
        };
        
        let ok = agent.confirm(key.clone()).await;
        if !ok {
            return Ok((agent, false));
        }
        writebuf.push(msg::SIGN_RESPONSE);
        let data = r.read_string()?;

        // todo parse whether this is a git sign request or ssh sign request
        key.0.add_signature(writebuf, data)?;
        let len = writebuf.len();
        BigEndian::write_u32(writebuf, (len - 4) as u32);

        Ok((agent, true))
    }
}
