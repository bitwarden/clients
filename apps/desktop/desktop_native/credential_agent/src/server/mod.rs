//! Accepts credential agent clients and serves the newline-delimited JSON protocol.

pub(crate) mod listener;
mod peer_info;

use std::sync::Arc;

use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

use crate::{
    protocol::{Action, Request, Response, MAX_REQUEST_LEN, PROTOCOL_VERSION},
    provider::{CredentialOutcome, CredentialProvider, CredentialRequest},
    server::listener::{Connection, Listener},
};

/// Runs the accept loop until `token` is cancelled, handling each client on its own task.
pub(crate) async fn serve<L, P>(mut listener: L, provider: Arc<P>, token: CancellationToken)
where
    L: Listener,
    P: CredentialProvider,
{
    loop {
        tokio::select! {
            () = token.cancelled() => {
                debug!("credential agent listener cancelled");
                return;
            }
            result = listener.accept() => match result {
                Ok(connection) => {
                    let provider = provider.clone();
                    let token = token.clone();
                    tokio::spawn(async move { handle_connection(connection, provider, token).await; });
                }
                // Accept failures are typically transient; keep the agent alive.
                Err(error) => error!(%error, "credential agent accept failed"),
            },
        }
    }
}

/// Serves a single request/response exchange, then closes the connection.
///
/// One exchange per connection keeps the lifetime of an approval unambiguous: a client
/// cannot reuse an approved connection to ask for a second, unapproved credential.
async fn handle_connection<S, P>(
    connection: Connection<S>,
    provider: Arc<P>,
    token: CancellationToken,
) where
    S: AsyncRead + AsyncWrite + Send + Unpin,
    P: CredentialProvider,
{
    let Connection { stream, peer } = connection;
    let mut stream = BufReader::new(stream);

    let mut line = String::new();
    // `take` bounds the read so a client cannot make us buffer without limit.
    let mut bounded = (&mut stream).take(MAX_REQUEST_LEN as u64);
    let read = tokio::select! {
        () = token.cancelled() => return,
        read = bounded.read_line(&mut line) => read,
    };
    drop(bounded);

    let response = match read {
        Ok(0) => {
            debug!("client disconnected before sending a request");
            return;
        }
        Ok(_) => process(&line, peer, &provider).await,
        Err(error) => {
            warn!(%error, "failed to read the credential request");
            return;
        }
    };

    if let Err(error) = write_response(stream.get_mut(), &response).await {
        warn!(%error, "failed to write the credential response");
    }
}

async fn process<P: CredentialProvider>(
    line: &str,
    peer: crate::provider::PeerContext,
    provider: &Arc<P>,
) -> Response {
    let request: Request = match serde_json::from_str(line) {
        Ok(request) => request,
        Err(error) => {
            warn!(%error, "malformed credential request");
            return Response::error("malformed request");
        }
    };

    if request.version != PROTOCOL_VERSION {
        return Response::error(format!(
            "unsupported protocol version {}, expected {PROTOCOL_VERSION}",
            request.version
        ));
    }

    let Action::GetCredential(query) = request.action;

    if query.is_empty() {
        return Response::error("the request must specify a uri or a name");
    }

    info!(
        peer_process = peer.process_name.as_deref().unwrap_or("unknown"),
        "credential requested"
    );

    match provider
        .request_credential(CredentialRequest { query, peer })
        .await
    {
        Ok(CredentialOutcome::Granted(credential)) => Response::Ok {
            credential: *credential,
        },
        Ok(CredentialOutcome::Denied) => Response::Denied,
        Ok(CredentialOutcome::NotFound) => Response::NotFound,
        Err(error) => {
            error!(%error, "credential lookup failed");
            Response::error(error.to_string())
        }
    }
}

async fn write_response<S: AsyncWrite + Unpin>(
    stream: &mut S,
    response: &Response,
) -> anyhow::Result<()> {
    let mut encoded = serde_json::to_vec(response)?;
    encoded.push(b'\n');

    stream.write_all(&encoded).await?;
    stream.flush().await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use async_trait::async_trait;

    use super::*;
    use crate::{
        protocol::Credential,
        provider::{PeerContext, ProviderError},
    };

    struct StubProvider {
        outcome: fn() -> Result<CredentialOutcome, ProviderError>,
    }

    #[async_trait]
    impl CredentialProvider for StubProvider {
        async fn request_credential(
            &self,
            _request: CredentialRequest,
        ) -> Result<CredentialOutcome, ProviderError> {
            (self.outcome)()
        }
    }

    fn provider(outcome: fn() -> Result<CredentialOutcome, ProviderError>) -> Arc<StubProvider> {
        Arc::new(StubProvider { outcome })
    }

    fn granted() -> Result<CredentialOutcome, ProviderError> {
        Ok(CredentialOutcome::Granted(Box::new(Credential {
            cipher_id: "cipher".to_string(),
            name: "GitHub".to_string(),
            username: Some("me".to_string()),
            password: Some("hunter2".to_string()),
            totp: None,
        })))
    }

    #[tokio::test]
    async fn test_grants_a_valid_request() {
        let line = r#"{"version":1,"action":"getCredential","uri":"https://github.com"}"#;

        let response = process(line, PeerContext::default(), &provider(granted)).await;

        let Response::Ok { credential } = response else {
            panic!("expected a granted response, got {response:?}");
        };
        assert_eq!(credential.name, "GitHub");
    }

    #[tokio::test]
    async fn test_rejects_an_unsupported_version() {
        let line = r#"{"version":99,"action":"getCredential","name":"GitHub"}"#;

        let response = process(line, PeerContext::default(), &provider(granted)).await;

        let Response::Error { message } = response else {
            panic!("expected an error response, got {response:?}");
        };
        assert!(message.contains("unsupported protocol version"));
    }

    #[tokio::test]
    async fn test_rejects_a_query_without_selectors() {
        let line = r#"{"version":1,"action":"getCredential"}"#;

        let response = process(line, PeerContext::default(), &provider(granted)).await;

        assert!(matches!(response, Response::Error { .. }));
    }

    #[tokio::test]
    async fn test_rejects_malformed_json() {
        let response = process("not json", PeerContext::default(), &provider(granted)).await;

        let Response::Error { message } = response else {
            panic!("expected an error response, got {response:?}");
        };
        assert_eq!(message, "malformed request");
    }

    #[tokio::test]
    async fn test_propagates_a_denial() {
        let line = r#"{"version":1,"action":"getCredential","name":"GitHub"}"#;

        let response = process(
            line,
            PeerContext::default(),
            &provider(|| Ok(CredentialOutcome::Denied)),
        )
        .await;

        assert!(matches!(response, Response::Denied));
    }

    #[tokio::test]
    async fn test_reports_a_provider_timeout_without_leaking_internals() {
        let line = r#"{"version":1,"action":"getCredential","name":"GitHub"}"#;

        let response = process(
            line,
            PeerContext::default(),
            &provider(|| Err(ProviderError::Timeout)),
        )
        .await;

        let Response::Error { message } = response else {
            panic!("expected an error response, got {response:?}");
        };
        assert!(message.contains("timed out"));
    }
}
