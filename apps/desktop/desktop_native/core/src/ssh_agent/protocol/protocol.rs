use futures::{Stream, StreamExt};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    select,
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::ssh_agent::{
    peerinfo::models::PeerInfo,
    protocol::{
        async_stream_wrapper::AsyncStreamWrapper,
        connection::ConnectionInfo,
        key_store::Agent,
        replies::{AgentFailure, IdentitiesReply, SshSignReply},
        requests::Request,
    },
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
                let mut stream = AsyncStreamWrapper::new(stream);
                let connection_info = ConnectionInfo::new(peer_info);
                info!("Accepted connection {} from {:?}", connection_info.id(), connection_info.peer_info());
                if let Err(e) = handle_connection(&agent, &mut stream, &connection_info).await {
                    error!("Error handling request: {e}");
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
        let span = tracing::info_span!("Connection", connection_id = connection.id());
        span.in_scope(|| info!("Waiting for request"));

        let request = match stream.read_message().await {
            Ok(request) => request,
            Err(_) => {
                span.in_scope(|| info!("Connection closed"));
                break;
            }
        };

        span.in_scope(|| info!("Request {:x?}", request));
        let Ok(request) = Request::try_from(request.as_slice()) else {
            span.in_scope(|| error!("Failed to parse request"));
            stream.write_reply(&AgentFailure::new().into()).await?;
            continue;
        };

        let response = match request {
            Request::IdentitiesRequest => {
                span.in_scope(|| info!("Received IdentitiesRequest"));
                IdentitiesReply::new(agent.list_keys().await?)
                    .encode()
                    .map_err(|e| anyhow::anyhow!("Failed to encode identities reply: {e}"))
            }
            Request::SignRequest(sign_request) => {
                span.in_scope(|| info!("Received SignRequest {:?}", sign_request));
                let private_key = agent
                    .find_private_key(sign_request.public_key())
                    .await
                    .ok()
                    .flatten();

                if let Some(private_key) = private_key {
                    SshSignReply::new(
                        &private_key,
                        &sign_request.payload_to_sign(),
                        sign_request.signing_scheme(),
                    )
                    .encode()
                } else {
                    Ok(AgentFailure::new().into())
                }
                .map_err(|e| anyhow::anyhow!("Failed to create sign reply: {e}"))
            }
        }?;

        span.in_scope(|| info!("Sending response"));
        stream.write_reply(&response).await?;
    }
    Ok(())
}
