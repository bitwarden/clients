//! SSH Agent napi:
//! - Wraps the agent to provide access from Electron.
//! - Sets up the callback handlers for the agent to request approval for ssh agent server
//!   operations to Electron.

#[napi]
pub mod sshagent {
    use std::{sync::Arc, time::Duration};

    use agent_access::{
        requester::{App, Requester},
        Outcome, RequestKind, Router,
    };
    use async_trait::async_trait;
    use napi::{
        bindgen_prelude::{JsValuesTupleIntoVec, Promise},
        threadsafe_function::ThreadsafeFunction,
    };
    use ssh_agent::{
        ApprovalError, ApprovalRequester, BitwardenSSHAgent, InMemoryEncryptedKeyStore,
        SIGNamespace, SignApprovalRequest, SignRequest, UnparsedSSHKeyData,
    };
    use tokio::time::timeout;
    use tracing::{debug, error};

    use crate::agent_access::agent_access::{AgentOutcome, AgentRequest, ElectronAnswerer};

    /// Timeout for the list callback; sign approvals run on the router's budget.
    const APPROVAL_CALLBACK_TIMEOUT: Duration = Duration::from_secs(60);

    /// SSH key data, sent from Electron.
    // NOTE: the public key is derived from the private key.
    #[napi(object)]
    pub struct SSHKeyData {
        pub private_key: String,
        pub name: String,
        pub cipher_id: String,
    }

    /// Wrapper for Electron to be able to interface with the agent directly.
    #[napi]
    pub struct SSHAgentState {
        agent: BitwardenSSHAgent<InMemoryEncryptedKeyStore, ElectronApprovalRequester>,
    }

    /// Interface for the agent to request approval for ssh operations from Electron.
    struct ElectronApprovalRequester {
        /// Sign approvals share the agent access router, its UI and its budget.
        router: Router,
        list_callback: Arc<ThreadsafeFunction<(), Promise<bool>>>,
    }

    async fn route_sign(
        router: &Router,
        request: SignApprovalRequest,
    ) -> Result<bool, ApprovalError> {
        let Some(cipher_id) = request.cipher_id else {
            return Ok(false);
        };
        let SignRequest {
            namespace,
            connection,
            ..
        } = request.sign_request;
        let session = connection.session_bind;
        let kind = RequestKind::SshSign {
            cipher_id,
            namespace: namespace.map(|ns| {
                match ns {
                    SIGNamespace::Git => "git",
                    SIGNamespace::File => "file",
                    SIGNamespace::Unsupported => "unsupported",
                }
                .to_owned()
            }),
            is_forwarding: session.as_ref().is_some_and(|s| s.is_forwarding),
            host_fingerprint: session.map(|s| s.host_fingerprint),
        };
        // The agent drops the peer pid, so the process name is all there is to show.
        let requester = Requester {
            app: App {
                name: connection.process_name.unwrap_or_default(),
                pid: 0,
                exe: None,
                signer: None,
            },
            chain: vec![],
            bundled_cli: false,
        };

        match router.route(String::new(), kind, requester).await {
            Outcome::Approved(_) => Ok(true),
            Outcome::Timeout => Err(ApprovalError::Timeout),
            _ => Ok(false),
        }
    }

    async fn invoke_callback<T: 'static + JsValuesTupleIntoVec>(
        callback: &ThreadsafeFunction<T, Promise<bool>>,
        arg: T,
    ) -> Result<bool, ApprovalError> {
        timeout(APPROVAL_CALLBACK_TIMEOUT, async {
            let promise = callback
                .call_async(Ok(arg))
                .await
                .map_err(|e| ApprovalError::HandlerFailed(e.into()))?;
            promise
                .await
                .map_err(|e| ApprovalError::HandlerFailed(e.into()))
        })
        .await
        .map_err(|_| ApprovalError::Timeout)
        .flatten()
    }

    #[async_trait]
    impl ApprovalRequester for ElectronApprovalRequester {
        async fn request_sign_approval(
            &self,
            request: SignApprovalRequest,
        ) -> Result<bool, ApprovalError> {
            debug!("Routing sign approval request to Electron.");

            let is_approved = route_sign(&self.router, request).await?;

            debug!(%is_approved, "Sign approval response from Electron.");

            Ok(is_approved)
        }

        async fn request_list_approval(&self) -> Result<bool, ApprovalError> {
            debug!("Sending list approval request to Electron.");

            let is_approved = invoke_callback(&self.list_callback, ()).await?;

            debug!(%is_approved, "List approval response from Electron.");

            Ok(is_approved)
        }
    }

    #[napi]
    impl SSHAgentState {
        /// Creates a new [`BitwardenSSHAgent`] and starts the server.
        ///
        /// # Arguments
        ///
        /// * `callback` - The agent access callback; answers sign approvals
        /// * `list_callback` - Allows agent to get approval for list key requests
        #[napi(
            factory,
            ts_args_type = "callback: (err: Error | null, arg: agent_access.AgentRequest) => \
                            Promise<agent_access.AgentOutcome>, listCallback: (err: Error | null) \
                            => Promise<boolean>"
        )]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            callback: ThreadsafeFunction<AgentRequest, Promise<AgentOutcome>>,
            list_callback: ThreadsafeFunction<(), Promise<bool>>,
        ) -> napi::Result<Self> {
            debug!("Creating agent and starting server.");

            let approval_handler = ElectronApprovalRequester {
                router: Router::new(Arc::new(ElectronAnswerer { callback })),
                list_callback: Arc::new(list_callback),
            };

            let keystore = InMemoryEncryptedKeyStore::default();

            let mut agent = ssh_agent::BitwardenSSHAgent::new(keystore, approval_handler);

            // TODO after PM-31827 is merged, can use simplified error conversion
            agent.start().map_err(|error| {
                error!(%error, "Failed to start the server.");
                napi::Error::from_reason(error.to_string())
            })?;

            debug!("Server started, returning agent state object.");

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

        #[napi]
        pub fn replace(&mut self, new_keys: Vec<SSHKeyData>) -> napi::Result<()> {
            let keys = new_keys
                .into_iter()
                .map(|k| UnparsedSSHKeyData {
                    private_key_pem: k.private_key,
                    name: k.name,
                    cipher_id: k.cipher_id,
                })
                .collect();

            self.agent
                .replace(ssh_agent::SSHKeyData::from_private_key_pems(keys))
                .map_err(|e| napi::Error::from_reason(e.to_string()))
        }
    }

    #[cfg(test)]
    mod tests {
        use std::sync::Mutex;

        use agent_access::{AgentRequest as RoutedRequest, Answerer};
        use ssh_agent::{ConnectionContext, PublicKey, SessionBindContext};

        use super::*;

        struct Stub(fn() -> Outcome, Mutex<Option<RoutedRequest>>);

        #[async_trait]
        impl Answerer for Stub {
            async fn answer(&self, request: RoutedRequest) -> Outcome {
                *self.1.lock().unwrap() = Some(request);
                (self.0)()
            }
        }

        async fn sign(
            outcome: fn() -> Outcome,
            cipher_id: Option<&str>,
        ) -> (Result<bool, ApprovalError>, Option<RoutedRequest>) {
            let stub = Arc::new(Stub(outcome, Mutex::new(None)));
            let request = SignApprovalRequest {
                sign_request: SignRequest {
                    public_key: PublicKey {
                        alg: "ssh-ed25519".into(),
                        blob: vec![],
                    },
                    namespace: Some(SIGNamespace::Git),
                    connection: ConnectionContext {
                        process_name: Some("git".into()),
                        session_bind: Some(SessionBindContext {
                            is_forwarding: true,
                            host_fingerprint: "SHA256:fp".into(),
                        }),
                    },
                },
                cipher_id: cipher_id.map(Into::into),
            };
            let result = route_sign(&Router::new(stub.clone()), request).await;
            let seen = stub.1.lock().unwrap().take();
            (result, seen)
        }

        #[tokio::test]
        async fn test_routes_a_sign_as_an_ssh_request_from_the_process_name() {
            let (result, seen) = sign(|| Outcome::Approved(None), Some("c1")).await;
            let seen = seen.unwrap();

            assert!(matches!(result, Ok(true)));
            assert!(matches!(
                seen.kind,
                RequestKind::SshSign { cipher_id, namespace, is_forwarding: true, host_fingerprint }
                    if cipher_id == "c1"
                        && namespace.as_deref() == Some("git")
                        && host_fingerprint.as_deref() == Some("SHA256:fp")
            ));
            assert_eq!(seen.requester.app.name, "git");
            assert!(seen.requester.chain.is_empty());
        }

        #[tokio::test]
        async fn test_only_an_approval_signs_and_a_timeout_stays_a_timeout() {
            let refusals: [fn() -> Outcome; 4] = [
                || Outcome::Denied,
                || Outcome::NotFound,
                || Outcome::Locked,
                || Outcome::Error,
            ];
            for outcome in refusals {
                assert!(matches!(sign(outcome, Some("c1")).await.0, Ok(false)));
            }
            assert!(matches!(
                sign(|| Outcome::Timeout, Some("c1")).await.0,
                Err(ApprovalError::Timeout)
            ));
        }

        #[tokio::test]
        async fn test_refuses_a_key_outside_the_vault_without_asking() {
            let (result, seen) = sign(|| Outcome::Approved(None), None).await;

            assert!(matches!(result, Ok(false)));
            assert!(seen.is_none());
        }
    }
}
