use futures::{Stream, StreamExt};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    select,
};
use tokio_util::sync::CancellationToken;

use crate::ssh_agent::{
    agent::{
        agent::Agent,
        async_stream_wrapper::AsyncStreamWrapper,
        connection::ConnectionInfo,
        replies::{AgentFailure, AgentIdentitiesReply, AgentSignReply},
        requests::{AgentRequest, SshSignFlags},
    },
    peerinfo::models::PeerInfo,
};

pub async fn serve_listener<PeerStream, Listener>(
    mut listener: Listener,
    cancellation_token: CancellationToken,
    agent: impl Agent,
) -> Result<(), anyhow::Error>
where
    PeerStream: AsyncRead + AsyncWrite + Send + Sync + Unpin + 'static,
    Listener: Stream<Item = tokio::io::Result<(PeerStream, PeerInfo)>> + Unpin,
{
    loop {
        select! {
            _ = cancellation_token.cancelled() => {
                break;
            }
            Some(Ok((stream, peer_info))) = listener.next() => {
                println!("[SSH Agent] Accepting connection");
                let mut stream = AsyncStreamWrapper::new(stream);
                let connection_info = ConnectionInfo::new(peer_info);
                if let Err(e) = handle_connection(&agent, &mut stream, &connection_info).await {
                    eprintln!("[SSH Agent] Error handling request: {e}");
                }
            }
        }
    }
    Ok(())
}

async fn handle_connection(
    agent: &impl Agent,
    stream: &mut AsyncStreamWrapper<impl AsyncRead + AsyncWrite + Send + Sync + Unpin>,
    connection: &ConnectionInfo,
) -> Result<(), anyhow::Error> {
    loop {
        println!(
            "[SSH Agent Connection {}] Waiting for request",
            connection.id()
        );
        let request = AgentRequest::try_from(stream.read_message().await?);
        let Ok(request) = request else {
            println!(
                "[SSH Agent Connection {}] Failed to parse request with error {}",
                connection.id(),
                request.err().unwrap(),
            );
            let failure_reply = AgentFailure::new()
                .try_into()
                .expect("Should convert to failure reply");
            stream.write_reply(&failure_reply).await?;
            continue;
        };

        let response = match request {
            AgentRequest::IdentitiesRequest => {
                println!(
                    "[SSH Agent Connection {}] Received IdentitiesRequest",
                    connection.id()
                );
                AgentIdentitiesReply::new(agent.list_keys().await?)
                    .encode()
                    .map_err(|e| anyhow::anyhow!("Failed to encode identities reply: {e}"))
            }
            AgentRequest::SignRequest(sign_request) => {
                println!(
                    "[SSH Agent Connection {}] Received SignRequest {:?}",
                    connection.id(),
                    sign_request,
                );
                let private_key = agent
                    .get_private_key(sign_request.public_key)
                    .await
                    .unwrap()
                    .unwrap();
                println!(
                    "[SSH Agent Connection {}] Found private key for signing",
                    connection.id()
                );
                AgentSignReply::new(&private_key, &sign_request.payload_to_sign)
                    .encode()
                    .map_err(|e| anyhow::anyhow!("Failed to encode sign reply: {e}"))
            }
        }?;
        println!(
            "[SSH Agent Connection {}] Sending response",
            connection.id()
        );

        stream.write_reply(&response).await?;
    }
    Ok(())
}
