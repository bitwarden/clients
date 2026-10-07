//! Agent access napi: starts the local listener and answers every routed request through one
//! Electron callback.

#[napi]
pub mod agent_access {
    use std::{collections::HashMap, sync::Arc, time::UNIX_EPOCH};

    use agent_access::{
        protocol, requester, AgentRequest as RoutedRequest, Answerer, BitwardenCredentialAgent,
        Outcome, RequestKind, Router,
    };
    use async_trait::async_trait;
    use napi::{bindgen_prelude::Promise, threadsafe_function::ThreadsafeFunction};
    use tracing::{error, warn};

    #[napi(object)]
    pub struct AgentRequest {
        pub kind: AgentRequestKind,
        pub requester: Requester,
        /// Epoch ms after which nobody waits for the answer.
        pub deadline: f64,
    }

    #[napi(discriminant = "type", discriminant_case = "camelCase")]
    pub enum AgentRequestKind {
        Credential {
            query: CredentialQuery,
            purpose: Option<Purpose>,
        },
        Approval {
            title: String,
            body: Option<String>,
        },
        SshSign {
            cipher_id: String,
            namespace: Option<String>,
            is_forwarding: bool,
            host_fingerprint: Option<String>,
        },
    }

    /// Exactly one field is set, as on the wire.
    #[napi(object)]
    pub struct CredentialQuery {
        pub domain: Option<String>,
        pub id: Option<String>,
        pub search: Option<String>,
    }

    /// Client-reported; display only.
    #[napi(object)]
    pub struct Purpose {
        pub command: Option<String>,
        pub env: HashMap<String, String>,
    }

    #[napi(object)]
    pub struct Requester {
        pub app: RequesterApp,
        /// From the socket peer upwards.
        pub chain: Vec<ProcessHop>,
        /// The peer is the `bw-access` shipped with this app.
        pub bundled_cli: bool,
    }

    #[napi(object)]
    pub struct RequesterApp {
        pub name: String,
        pub pid: u32,
        pub exe: Option<String>,
        pub signer: Option<Signer>,
    }

    #[napi(object)]
    pub struct ProcessHop {
        pub pid: u32,
        pub name: String,
        pub exe: Option<String>,
        pub signer: Option<Signer>,
    }

    #[napi(object)]
    pub struct Signer {
        pub kind: SignerKind,
        pub id: Option<String>,
        pub organization: Option<String>,
        pub valid: bool,
    }

    #[napi(string_enum = "camelCase")]
    pub enum SignerKind {
        DeveloperId,
        Platform,
        AdHoc,
        Other,
    }

    #[napi(object)]
    pub struct AgentOutcome {
        pub status: OutcomeStatus,
        /// Only for an approved credential request.
        pub credential: Option<Credential>,
    }

    #[napi(string_enum = "camelCase")]
    pub enum OutcomeStatus {
        Approved,
        Denied,
        NotFound,
        Locked,
        Timeout,
        Error,
    }

    #[napi(object)]
    pub struct Credential {
        pub username: Option<String>,
        pub password: Option<String>,
        pub totp: Option<String>,
        pub uri: Option<String>,
        pub credential_id: Option<String>,
    }

    /// The desktop answerer; the router owns the timeout, so this waits as long as it is polled.
    pub(crate) struct ElectronAnswerer {
        pub(crate) callback: ThreadsafeFunction<AgentRequest, Promise<AgentOutcome>>,
    }

    #[async_trait]
    impl Answerer for ElectronAnswerer {
        async fn answer(&self, request: RoutedRequest) -> Outcome {
            let promise = match self.callback.call_async(Ok(request.into())).await {
                Ok(promise) => promise,
                Err(error) => {
                    error!(%error, "agent callback failed");
                    return Outcome::Error;
                }
            };
            match promise.await {
                Ok(outcome) => outcome.into(),
                Err(error) => {
                    warn!(%error, "agent callback rejected");
                    Outcome::Error
                }
            }
        }
    }

    #[napi]
    pub struct AgentAccessState {
        agent: BitwardenCredentialAgent,
    }

    #[napi]
    impl AgentAccessState {
        /// Starts the listener; every request is answered through `callback`.
        #[napi(factory)]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            callback: ThreadsafeFunction<AgentRequest, Promise<AgentOutcome>>,
        ) -> napi::Result<Self> {
            let router = Router::new(Arc::new(ElectronAnswerer { callback }));
            let mut agent = BitwardenCredentialAgent::new(Arc::new(router));

            agent.start().map_err(|error| {
                error!(%error, "Failed to start the agent listener.");
                napi::Error::from_reason(error.to_string())
            })?;

            Ok(Self { agent })
        }

        #[napi]
        pub fn stop(&mut self) {
            self.agent.stop();
        }

        #[napi]
        pub fn is_running(&self) -> bool {
            self.agent.is_running()
        }
    }

    impl From<RoutedRequest> for AgentRequest {
        fn from(request: RoutedRequest) -> Self {
            let kind = match request.kind {
                RequestKind::Credential { query, purpose } => AgentRequestKind::Credential {
                    query: query.into(),
                    purpose: purpose.map(|p| Purpose {
                        command: p.command,
                        env: p.env.into_iter().collect(),
                    }),
                },
                RequestKind::Approval { prompt } => AgentRequestKind::Approval {
                    title: prompt.title,
                    body: prompt.body,
                },
                RequestKind::SshSign {
                    cipher_id,
                    namespace,
                    is_forwarding,
                    host_fingerprint,
                } => AgentRequestKind::SshSign {
                    cipher_id,
                    namespace,
                    is_forwarding,
                    host_fingerprint,
                },
            };
            let deadline = request
                .deadline
                .duration_since(UNIX_EPOCH)
                .map_or(0.0, |d| d.as_millis() as f64);

            Self {
                kind,
                requester: request.requester.into(),
                deadline,
            }
        }
    }

    impl From<protocol::CredentialQuery> for CredentialQuery {
        fn from(query: protocol::CredentialQuery) -> Self {
            let (mut domain, mut id, mut search) = (None, None, None);
            match query {
                protocol::CredentialQuery::Domain(value) => domain = Some(value),
                protocol::CredentialQuery::Id(value) => id = Some(value),
                protocol::CredentialQuery::Search(value) => search = Some(value),
            }
            Self { domain, id, search }
        }
    }

    impl From<requester::Requester> for Requester {
        fn from(requester: requester::Requester) -> Self {
            let app = requester.app;
            Self {
                app: RequesterApp {
                    name: app.name,
                    pid: app.pid,
                    exe: app.exe,
                    signer: app.signer.map(Into::into),
                },
                chain: requester
                    .chain
                    .into_iter()
                    .map(|hop| ProcessHop {
                        pid: hop.pid,
                        name: hop.name,
                        exe: hop.exe,
                        signer: hop.signer.map(Into::into),
                    })
                    .collect(),
                bundled_cli: requester.bundled_cli,
            }
        }
    }

    impl From<requester::Signer> for Signer {
        fn from(signer: requester::Signer) -> Self {
            Self {
                kind: match signer.kind {
                    requester::SignerKind::DeveloperId => SignerKind::DeveloperId,
                    requester::SignerKind::Platform => SignerKind::Platform,
                    requester::SignerKind::AdHoc => SignerKind::AdHoc,
                    requester::SignerKind::Other => SignerKind::Other,
                },
                id: signer.id,
                organization: signer.organization,
                valid: signer.valid,
            }
        }
    }

    impl From<AgentOutcome> for Outcome {
        fn from(outcome: AgentOutcome) -> Self {
            match outcome.status {
                OutcomeStatus::Approved => {
                    Outcome::Approved(outcome.credential.map(|c| protocol::CredentialData {
                        username: c.username,
                        password: c.password,
                        totp: c.totp,
                        uri: c.uri,
                        credential_id: c.credential_id,
                        domain: None,
                    }))
                }
                OutcomeStatus::Denied => Outcome::Denied,
                OutcomeStatus::NotFound => Outcome::NotFound,
                OutcomeStatus::Locked => Outcome::Locked,
                OutcomeStatus::Timeout => Outcome::Timeout,
                OutcomeStatus::Error => Outcome::Error,
            }
        }
    }
}
