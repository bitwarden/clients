//! SSH Agent napi:
//! - Wraps the agent to provide access from Electron.
//! - Sets up the callback handlers for the agent to request approval for ssh agent server
//!   operations to Electron.

#[napi]
pub mod sshagent_v2 {
    use std::sync::Arc;

    use async_trait::async_trait;
    use napi::threadsafe_function::ThreadsafeFunction;
    use ssh_agent::{
        ApprovalRequester, AuthRequest as SshAuthRequest, BitwardenSshAgent,
        InMemoryEncryptedKeyStore, SignRequest as SshSignRequest,
    };
    use tracing::{debug, error};

    /// SSH key data, sent from Electron.
    #[napi(object)]
    pub struct SshKeyData {
        pub private_key: String,
        pub name: String,
        pub cipher_id: String,
    }

    /// SSH public key data
    #[napi(object)]
    #[derive(Debug, Clone)]
    pub struct PublicKey {
        pub alg: String,
        pub blob: Vec<u8>,
    }

    /// Data for a sign request
    #[napi(object)]
    #[derive(Debug)]
    pub struct SignRequestData {
        pub public_key: PublicKey,
        pub cipher_id: Option<String>,
        pub process_name: String,
        pub is_forwarding: bool,
        pub namespace: Option<String>,
    }

    impl From<(SshSignRequest, Option<String>)> for SignRequestData {
        fn from((sign_request, cipher_id): (SshSignRequest, Option<String>)) -> Self {
            Self {
                public_key: PublicKey {
                    alg: sign_request.public_key.alg,
                    blob: sign_request.public_key.blob,
                },
                cipher_id,
                process_name: sign_request.process_name,
                is_forwarding: sign_request.is_forwarding,
                namespace: sign_request.namespace,
            }
        }
    }

    /// Wrapper for Electron to be able to interface with the agent directly.
    #[napi]
    pub struct SshAgentState {
        agent: BitwardenSshAgent<InMemoryEncryptedKeyStore, ElectronApprovalRequester>,
    }

    /// Interface for the agent to request approval for ssh operations from Electron.
    struct ElectronApprovalRequester {
        // Callback used to approve listing keys
        list_callback: Arc<ThreadsafeFunction<(), bool>>,
        // Callback used to approve signing data
        sign_callback: Arc<ThreadsafeFunction<SignRequestData, bool>>,
    }

    #[async_trait]
    impl ApprovalRequester for ElectronApprovalRequester {
        async fn request(
            &self,
            auth_request: SshAuthRequest,
            cipher_id: Option<String>,
        ) -> Result<bool, anyhow::Error> {
            match auth_request {
                SshAuthRequest::List => {
                    debug!("Sending list approval request to Electron.");
                    let is_approved = self
                        .list_callback
                        .call_async(Ok(()))
                        .await
                        .map_err(|e| anyhow::anyhow!("Electron list callback failed: {e}"))?;

                    debug!(%is_approved, "List approval response from Electron.");
                    Ok(is_approved)
                }
                SshAuthRequest::Sign(sign_request) => {
                    let request = SignRequestData::from((sign_request, cipher_id));

                    debug!(?request, "Sending sign approval request to Electron.");
                    let is_approved = self
                        .sign_callback
                        .call_async(Ok(request))
                        .await
                        .map_err(|e| anyhow::anyhow!("Electron sign callback failed: {e}"))?;

                    debug!(%is_approved, "Sign approval response from Electron.");
                    Ok(is_approved)
                }
            }
        }
    }

    #[napi]
    impl SshAgentState {
        /// Creates a new [`BitwardenSshAgent`] and starts the server.
        ///
        /// # Arguments
        ///
        /// * `list_callback` - Callback for list requests
        /// * `sign_callback` - Callback for sign requests
        #[napi(factory)]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            list_callback: ThreadsafeFunction<(), bool>,
            sign_callback: ThreadsafeFunction<SignRequestData, bool>,
        ) -> napi::Result<Self> {
            let approval_handler = ElectronApprovalRequester {
                list_callback: Arc::new(list_callback),
                sign_callback: Arc::new(sign_callback),
            };

            let keystore = InMemoryEncryptedKeyStore::default();

            let mut agent = ssh_agent::BitwardenSshAgent::new(keystore, approval_handler);

            debug!("Signaling the agent to start the server.");

            // TODO after PM-31827 is merged, can use simplified error conversion
            agent.start_server().map_err(|error| {
                error!(%error, "Failed to start the server.");
                napi::Error::from_reason(error.to_string())
            })?;

            debug!("Server started, returning agent state object.");

            Ok(Self { agent })
        }

        #[napi]
        pub fn stop(&mut self) {
            self.agent.stop_server();
        }

        #[napi]
        pub fn is_running(&mut self) -> bool {
            self.agent.is_running()
        }

        #[napi]
        pub fn set_keys(&mut self, _new_keys: Vec<SshKeyData>) -> napi::Result<()> {
            todo!()
        }

        #[napi]
        pub fn clear_keys(&mut self) {
            self.agent.clear_keys();
        }

        #[napi]
        pub fn lock(&mut self) {
            self.agent.lock();
        }
    }
}
