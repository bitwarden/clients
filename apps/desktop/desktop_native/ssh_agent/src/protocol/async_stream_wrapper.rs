use ssh_encoding::Decode;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use crate::protocol::replies::ReplyFrame;

pub(crate) struct AsyncStreamWrapper<PeerStream>
where
    PeerStream: AsyncRead + AsyncWrite + Send + Sync + Unpin,
{
    stream: PeerStream,
}

impl<PeerStream> AsyncStreamWrapper<PeerStream>
where
    PeerStream: AsyncRead + AsyncWrite + Send + Sync + Unpin,
{
    pub fn new(stream: PeerStream) -> Self {
        Self { stream }
    }

    pub async fn read_u32(&mut self) -> Result<u32, anyhow::Error> {
        let mut buf = [0u8; 4];
        self.stream.read_exact(&mut buf).await?;
        u32::decode(&mut buf.as_slice()).map_err(|e| anyhow::anyhow!("Failed to decode u32: {}", e))
    }

    pub async fn read_vec(&mut self, len: usize) -> Result<Vec<u8>, anyhow::Error> {
        let mut buf = vec![0u8; len];
        self.stream.read_exact(&mut buf).await?;
        Ok(buf)
    }

    pub async fn read_message(&mut self) -> Result<Vec<u8>, anyhow::Error> {
        // An SSH agent message consists of a 32 bit integer denoting the length, followed by that many bytes
        let length = self.read_u32().await? as usize;
        self.read_vec(length).await
    }

    pub async fn write_reply(&mut self, data: &ReplyFrame) -> Result<(), anyhow::Error> {
        let raw_frame: Vec<u8> = data.into();
        self.stream.write_u32(raw_frame.len() as u32).await?;
        self.stream.write_all(&raw_frame).await?;
        Ok(())
    }
}
