//! Credential agent napi:
//! - Wraps the agent so Electron can start and stop it.
//! - Bridges each incoming credential request to Electron, which applies the user's approval
//!   setting, prompts if required, and resolves it against the vault.

#[napi]
pub mod credential_agent {
    use std::time::Duration;

    use async_trait::async_trait;
    use credential_agent::{
        BitwardenCredentialAgent, CredentialOutcome as AgentCredentialOutcome, CredentialProvider,
        CredentialRequest as AgentCredentialRequest, ProviderError,
    };
    use napi::{bindgen_prelude::Promise, threadsafe_function::ThreadsafeFunction};
    use tokio::time::timeout;
    use tracing::{debug, error};

    /// How long Electron has to resolve a request before the client is told it timed out.
    /// Generous, because it covers the user reading and answering the approval prompt.
    const REQUEST_CALLBACK_TIMEOUT: Duration = Duration::from_secs(60);

    /// A credential request handed to Electron.
    #[napi(object)]
    #[derive(Debug)]
    pub struct CredentialRequest {
        pub uri: Option<String>,
        pub name: Option<String>,
        /// The process that opened the connection, when it could be resolved.
        pub process_name: Option<String>,
        pub process_id: Option<u32>,
    }

    impl From<AgentCredentialRequest> for CredentialRequest {
        fn from(request: AgentCredentialRequest) -> Self {
            Self {
                uri: request.query.uri,
                name: request.query.name,
                process_name: request.peer.process_name,
                process_id: request.peer.pid,
            }
        }
    }

    /// Electron's answer. `credential` is set only when `status` is `granted`.
    #[napi(object)]
    pub struct CredentialResponse {
        pub status: CredentialStatus,
        pub credential: Option<Credential>,
    }

    #[napi(string_enum = "camelCase")]
    #[derive(Debug)]
    pub enum CredentialStatus {
        Granted,
        Denied,
        NotFound,
    }

    #[napi(object)]
    pub struct Credential {
        pub cipher_id: String,
        pub name: String,
        pub username: Option<String>,
        pub password: Option<String>,
        pub totp: Option<String>,
    }

    /// Resolves requests by calling back into Electron.
    struct ElectronCredentialProvider {
        callback: ThreadsafeFunction<CredentialRequest, Promise<CredentialResponse>>,
    }

    #[async_trait]
    impl CredentialProvider for ElectronCredentialProvider {
        async fn request_credential(
            &self,
            request: AgentCredentialRequest,
        ) -> Result<AgentCredentialOutcome, ProviderError> {
            debug!("Sending credential request to Electron.");

            let response = timeout(REQUEST_CALLBACK_TIMEOUT, async {
                let promise = self
                    .callback
                    .call_async(Ok(request.into()))
                    .await
                    .map_err(|e| ProviderError::Failed(e.into()))?;

                promise.await.map_err(|e| ProviderError::Failed(e.into()))
            })
            .await
            .map_err(|_| ProviderError::Timeout)??;

            debug!(status = ?response.status, "Credential response from Electron.");

            Ok(match response.status {
                CredentialStatus::Denied => AgentCredentialOutcome::Denied,
                CredentialStatus::NotFound => AgentCredentialOutcome::NotFound,
                CredentialStatus::Granted => match response.credential {
                    Some(credential) => {
                        AgentCredentialOutcome::Granted(Box::new(credential_agent::Credential {
                            cipher_id: credential.cipher_id,
                            name: credential.name,
                            username: credential.username,
                            password: credential.password,
                            totp: credential.totp,
                        }))
                    }
                    // A granted response without a credential is a bug on the Electron side;
                    // refuse rather than hand the client a half-answer.
                    None => {
                        error!("Electron granted a credential request without a credential.");
                        AgentCredentialOutcome::NotFound
                    }
                },
            })
        }
    }

    /// Wrapper for Electron to interface with the agent directly.
    #[napi]
    pub struct CredentialAgentState {
        agent: BitwardenCredentialAgent<ElectronCredentialProvider>,
    }

    #[napi]
    impl CredentialAgentState {
        /// Creates the agent and starts its listener.
        ///
        /// # Arguments
        ///
        /// * `request_callback` - Resolves a credential request, including user approval.
        #[napi(factory)]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            request_callback: ThreadsafeFunction<CredentialRequest, Promise<CredentialResponse>>,
        ) -> napi::Result<Self> {
            let provider = ElectronCredentialProvider {
                callback: request_callback,
            };

            let mut agent = BitwardenCredentialAgent::new(provider);

            agent.start().map_err(|error| {
                error!(%error, "Failed to start the credential agent.");
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
}
