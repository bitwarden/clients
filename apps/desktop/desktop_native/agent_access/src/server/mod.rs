//! Accepts local clients and serves one wire v1 exchange per connection.

pub(crate) mod listener;

use std::{sync::Arc, time::Duration};

use tokio::{
    io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader},
    sync::Semaphore,
    time::timeout,
};
use tokio_util::sync::CancellationToken;
use tracing::{debug, error, info, warn};

use crate::{
    protocol::{
        parse_request, Request, Response, Status, Versioned, MAX_REQUEST_LEN, PROTOCOL_VERSION,
    },
    requester,
    router::{Outcome, RequestKind, Router},
    server::listener::{Connection, Listener},
};

/// A request line must arrive promptly; approval time is not counted here.
const READ_TIMEOUT: Duration = Duration::from_secs(10);

/// Requests waiting on the user at once; more are refused rather than queued as dialogs.
const MAX_IN_FLIGHT: usize = 8;

/// Some accept errors persist (EMFILE); don't spin on them.
const ACCEPT_BACKOFF: Duration = Duration::from_millis(100);

pub(crate) async fn serve<L: Listener>(
    mut listener: L,
    router: Arc<Router>,
    token: CancellationToken,
) {
    let in_flight = Arc::new(Semaphore::new(MAX_IN_FLIGHT));
    loop {
        tokio::select! {
            () = token.cancelled() => {
                debug!("agent listener cancelled");
                return;
            }
            result = listener.accept() => match result {
                Ok(connection) => {
                    let (router, token, in_flight) = (router.clone(), token.clone(), in_flight.clone());
                    tokio::spawn(async move {
                        tokio::select! {
                            () = token.cancelled() => {}
                            () = handle_connection(connection, &router, &in_flight) => {}
                        }
                    });
                }
                Err(error) => {
                    error!(%error, "agent accept failed");
                    tokio::time::sleep(ACCEPT_BACKOFF).await;
                }
            },
        }
    }
}

/// One exchange per connection, so an approved connection can't be reused for a second request.
async fn handle_connection<S>(connection: Connection<S>, router: &Router, in_flight: &Semaphore)
where
    S: AsyncRead + AsyncWrite + Send + Unpin,
{
    let Connection { stream, peer_pid } = connection;
    let mut stream = BufReader::new(stream);

    let mut line = String::new();
    let mut bounded = (&mut stream).take(MAX_REQUEST_LEN as u64);
    match timeout(READ_TIMEOUT, bounded.read_line(&mut line)).await {
        Ok(Ok(0)) => return,
        Ok(Ok(_)) => {}
        Ok(Err(error)) => return warn!(%error, "failed to read an agent request"),
        Err(_) => return debug!("agent client sent no request in time"),
    }

    let response = match parse_request(&line) {
        Err(error) => Response::Error {
            status: Status::Error,
            error: error.into(),
        },
        Ok(request) => match in_flight.try_acquire() {
            Ok(_permit) => process(request, peer_pid, router).await,
            Err(_) => answer(&request, Outcome::Error, Some("too many pending requests")),
        },
    };

    if let Err(error) = write_response(stream.get_mut(), &response).await {
        warn!(%error, "failed to write an agent response");
    }
}

async fn process(request: Request, peer_pid: Option<u32>, router: &Router) -> Response {
    let Some(pid) = peer_pid else {
        return answer(
            &request,
            Outcome::Error,
            Some("could not identify the requesting process"),
        );
    };
    let requester = match tokio::task::spawn_blocking(move || requester::resolve(pid)).await {
        Ok(requester) => requester,
        Err(error) => {
            error!(%error, "requester lookup panicked");
            return answer(&request, Outcome::Error, None);
        }
    };

    let (request_id, kind) = match request.clone() {
        Request::CredentialRequest {
            request_id,
            query,
            purpose,
        } => (request_id, RequestKind::Credential { query, purpose }),
        Request::ApprovalRequest { request_id, prompt } => {
            (request_id, RequestKind::Approval { prompt })
        }
    };

    info!(app = %requester.app.name, "agent request");
    let outcome = router.route(request_id, kind, requester).await;
    answer(&request, outcome, None)
}

fn answer(request: &Request, outcome: Outcome, error: Option<&str>) -> Response {
    let request_id = request.request_id().to_owned();
    let (status, credential) = match outcome {
        Outcome::Approved(credential) => (Status::Approved, credential),
        Outcome::Denied => (Status::Denied, None),
        Outcome::NotFound => (Status::NotFound, None),
        Outcome::Locked => (Status::Locked, None),
        Outcome::Timeout => (Status::Timeout, None),
        Outcome::Error => (Status::Error, None),
    };
    let error = error.map(str::to_owned);

    match request {
        Request::CredentialRequest { .. } if status == Status::Approved && credential.is_none() => {
            error!("an approved credential request carried no credential");
            Response::CredentialResponse {
                request_id,
                status: Status::Error,
                credential: None,
                error,
            }
        }
        Request::CredentialRequest { .. } => Response::CredentialResponse {
            request_id,
            status,
            credential,
            error,
        },
        Request::ApprovalRequest { .. } => Response::ApprovalResponse {
            request_id,
            status,
            error,
        },
    }
}

async fn write_response<S: AsyncWrite + Unpin>(
    stream: &mut S,
    response: &Response,
) -> anyhow::Result<()> {
    let mut encoded = serde_json::to_vec(&Versioned {
        v: PROTOCOL_VERSION,
        response,
    })?;
    encoded.push(b'\n');

    stream.write_all(&encoded).await?;
    stream.flush().await?;
    Ok(())
}
