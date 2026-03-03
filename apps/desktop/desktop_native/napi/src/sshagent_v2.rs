//! SSH Agent napi:
//! - Wraps the agent to provide access from Electron.
//! - Sets up the callback handlers for the agent to request approval for ssh agent server
//!   operations to Electron.

#[napi]
pub mod sshagent_v2 {
    use std::sync::Arc;

    use anyhow::Context;
    use async_trait::async_trait;
    use napi::threadsafe_function::ThreadsafeFunction;
    use ssh_agent::{
        ApprovalRequester, BitwardenSSHAgent, InMemoryEncryptedKeyStore,
        SignRequest as SSHSignRequest,
    };
    use tracing::{debug, error};

    /// SSH key data, sent from Electron.
    #[napi(object)]
    pub struct SSHKeyData {
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
        pub process_name: Option<String>,
        pub is_forwarding: bool,
        pub namespace: Option<String>,
    }

    impl From<(SSHSignRequest, Option<String>)> for SignRequestData {
        fn from((sign_request, cipher_id): (SSHSignRequest, Option<String>)) -> Self {
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
    pub struct SSHAgentState {
        agent: BitwardenSSHAgent<InMemoryEncryptedKeyStore, ElectronApprovalRequester>,
    }

    /// Interface for the agent to request approval for ssh operations from Electron.
    struct ElectronApprovalRequester {
        // Callback used to request vault unlock from Electron
        unlock_callback: Arc<ThreadsafeFunction<(), bool>>,
        // Callback used to approve signing data
        sign_callback: Arc<ThreadsafeFunction<SignRequestData, bool>>,
    }

    #[async_trait]
    impl ApprovalRequester for ElectronApprovalRequester {
        async fn request_unlock(&self) -> anyhow::Result<bool> {
            debug!("Sending unlock request to Electron.");
            let is_approved = self
                .unlock_callback
                .call_async(Ok(()))
                .await
                .context("Electron unlock callback failed")?;

            debug!(%is_approved, "Unlock response from Electron.");
            Ok(is_approved)
        }

        async fn request_sign_approval(
            &self,
            sign_request: SSHSignRequest,
            cipher_id: Option<String>,
        ) -> anyhow::Result<bool> {
            let request = SignRequestData::from((sign_request, cipher_id));

            debug!(?request, "Sending sign approval request to Electron.");
            let is_approved = self
                .sign_callback
                .call_async(Ok(request))
                .await
                .context("Electron sign callback failed")?;

            debug!(%is_approved, "Sign approval response from Electron.");
            Ok(is_approved)
        }
    }

    #[napi]
    impl SSHAgentState {
        /// Creates a new [`BitwardenSSHAgent`] and starts the server.
        ///
        /// # Arguments
        ///
        /// * `unlock_callback` - Allows agent to vault unlock
        /// * `sign_callback` - Allows agent to get approval for sign requests
        #[napi(factory)]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            unlock_callback: ThreadsafeFunction<(), bool>,
            sign_callback: ThreadsafeFunction<SignRequestData, bool>,
        ) -> napi::Result<Self> {
            let approval_handler = ElectronApprovalRequester {
                unlock_callback: Arc::new(unlock_callback),
                sign_callback: Arc::new(sign_callback),
            };

            let keystore = InMemoryEncryptedKeyStore::default();

            let mut agent = ssh_agent::BitwardenSSHAgent::new(keystore, approval_handler);

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
        pub fn set_keys(&mut self, _new_keys: Vec<SSHKeyData>) -> napi::Result<()> {
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

        #[napi]
        pub fn unlock(&mut self) {
            self.agent.unlock();
        }
    }
}
