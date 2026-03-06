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
        ApprovalRequester, BitwardenSSHAgent, InMemoryEncryptedKeyStore, PublicKey as SSHPublicKey,
        SignApprovalRequest as SSHSignApprovalRequest, SignRequest as SSHSignRequest,
        SignRequestNamespace as SSHSignRequestNamespace,
    };
    use tracing::{debug, error};

    /// SSH key data, sent from Electron.
    // NOTE: the public key is derived from the private key.
    #[napi(object)]
    pub struct SSHKeyData {
        pub private_key: String,
        pub name: String,
        pub cipher_id: String,
    }

    napi_mirrors! {
        "sshagent_v2" => {
            string_enum SignRequestNamespace from SSHSignRequestNamespace {
                Git, File, Unsupported,
            }
            object PublicKey from SSHPublicKey {
                alg: String,
                blob: Vec<u8>,
            }
            object SignRequest from SSHSignRequest {
                public_key: PublicKey,
                process_name: Option<String>,
                is_forwarding: bool,
                namespace: Option<SignRequestNamespace>,
            }
            object SignRequestData from SSHSignApprovalRequest {
                sign_request: SignRequest,
                cipher_id: Option<String>,
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
            request: SSHSignApprovalRequest,
        ) -> anyhow::Result<bool> {
            let request = SignRequestData::from(request);

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
        pub fn is_running(&self) -> bool {
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
