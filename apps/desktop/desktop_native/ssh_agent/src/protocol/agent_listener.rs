use futures::{Stream, StreamExt};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    select,
};
use tokio_util::sync::CancellationToken;
use tracing::{error, info};

use crate::{
    protocol::{
        async_stream_wrapper::AsyncStreamWrapper,
        connection::ConnectionInfo,
        key_store::Agent,
        replies::{
            AgentExtensionFailure, AgentFailure, AgentSuccess, IdentitiesReply, ReplyFrame,
            SshSignReply,
        },
        requests::Request,
    },
    transport::peer_info::PeerInfo,
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
                let mut connection_info = ConnectionInfo::new(peer_info);
                info!("Accepted connection {} from {:?}", connection_info.id(), connection_info.peer_info());
                if let Err(e) = handle_connection(&agent, &mut stream, &mut connection_info).await {
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
    connection: &mut ConnectionInfo,
) -> Result<(), anyhow::Error> {
    loop {
        let span = tracing::info_span!("Connection", connection_id = connection.id());

        let request = match stream.read_message().await {
            Ok(request) => request,
            Err(_) => {
                span.in_scope(|| info!("Connection closed"));
                break;
            }
        };

        let Ok(request) = Request::try_from(request.as_slice()) else {
            span.in_scope(|| error!("Failed to parse request"));
            stream
                .write_reply(&AgentExtensionFailure::new().into())
                .await?;
            continue;
        };

        let response = match request {
            Request::Identities => {
                span.in_scope(|| info!("Received IdentitiesRequest"));

                let Ok(true) = agent.request_can_list(connection).await else {
                    span.in_scope(|| error!("List keys request denied by UI"));
                    return stream
                        .write_reply(&AgentExtensionFailure::new().into())
                        .await;
                };

                IdentitiesReply::new(agent.list_keys().await?)
                    .encode()
                    .map_err(|e| anyhow::anyhow!("Failed to encode identities reply: {e}"))
            }
            Request::Sign(sign_request) => {
                span.in_scope(|| info!("Received SignRequest {:?}", sign_request));

                let Ok(true) = agent
                    .request_can_sign(sign_request.public_key(), connection)
                    .await
                else {
                    span.in_scope(|| error!("Sign request denied by UI"));
                    return stream.write_reply(&AgentFailure::new().into()).await;
                };

                let ssh_item = agent
                    .find_ssh_item(sign_request.public_key())
                    .await
                    .ok()
                    .flatten();

                if let Some(ssh_item) = ssh_item {
                    SshSignReply::try_create(
                        ssh_item.key_pair.private_key(),
                        sign_request.payload_to_sign(),
                        sign_request.signing_scheme(),
                    )?
                    .encode()
                } else {
                    Ok(AgentExtensionFailure::new().into())
                }
                .map_err(|e| anyhow::anyhow!("Failed to create sign reply: {e}"))
            }
            Request::SessionBind(request) => {
                span.in_scope(|| info!("Received SessionBind {:?}", request));
                connection.set_host_key(request.host_key().clone());
                info!(
                    "Bound connection {} to host {:?}",
                    connection.id(),
                    connection.host_name().unwrap_or(&"".to_string())
                );
                Ok(ReplyFrame::from(AgentSuccess::new()))
            }
        }?;
        stream.write_reply(&response).await?;
    }
    Ok(())
}
