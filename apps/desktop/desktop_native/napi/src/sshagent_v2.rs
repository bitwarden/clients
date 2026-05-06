//! SSH Agent napi:
//! - Wraps the agent to provide access from Electron.
//! - Sets up the callback handlers for the agent to request approval for ssh agent server
//!   operations to Electron.

#[napi]
pub mod sshagent_v2 {
    use std::{sync::Arc, time::Duration};

    use async_trait::async_trait;
    use napi::threadsafe_function::ThreadsafeFunction;
    use ssh_agent::{
        ApprovalError, ApprovalRequester, BitwardenSSHAgent, InMemoryEncryptedKeyStore,
        SIGNamespace as SSHSIGNamespace, SignApprovalRequest as SSHSignApprovalRequest,
    };
    use tokio::time::timeout;
    use tracing::{debug, error};

    /// Timeout for Electron approval callbacks
    const APPROVAL_CALLBACK_TIMEOUT: Duration = Duration::from_secs(60);

    /// SSH key data, sent from Electron.
    // NOTE: the public key is derived from the private key.
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

    /// A sign request's SIG namespace
    #[napi(string_enum = "camelCase")]
    #[derive(Debug)]
    pub enum SIGNamespace {
        Git,
        File,
        Unsupported,
    }

    impl From<SSHSIGNamespace> for SIGNamespace {
        fn from(ns: SSHSIGNamespace) -> Self {
            match ns {
                SSHSIGNamespace::Git => Self::Git,
                SSHSIGNamespace::File => Self::File,
                SSHSIGNamespace::Unsupported => Self::Unsupported,
            }
        }
    }

    /// SSH sign request fields.
    #[napi(object)]
    #[derive(Debug)]
    pub struct SignRequest {
        pub public_key: PublicKey,
        pub process_name: Option<String>,
        pub is_forwarding: bool,
        pub namespace: Option<SIGNamespace>,
    }

    impl From<ssh_agent::SignRequest> for SignRequest {
        fn from(r: ssh_agent::SignRequest) -> Self {
            Self {
                public_key: PublicKey {
                    alg: r.public_key.alg,
                    blob: r.public_key.blob,
                },
                process_name: r.process_name,
                is_forwarding: r.is_forwarding,
                namespace: r.namespace.map(Into::into),
            }
        }
    }

    /// Data for a sign request, including vault cipher context.
    #[napi(object)]
    #[derive(Debug)]
    pub struct SignRequestData {
        pub sign_request: SignRequest,
        pub cipher_id: Option<String>,
    }

    impl From<SSHSignApprovalRequest> for SignRequestData {
        fn from(request: SSHSignApprovalRequest) -> Self {
            Self {
                sign_request: request.sign_request.into(),
                cipher_id: request.cipher_id,
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
        async fn request_unlock(&self) -> Result<bool, ApprovalError> {
            debug!("Sending unlock request to Electron.");

            let is_approved = timeout(APPROVAL_CALLBACK_TIMEOUT, async {
                self.unlock_callback
                    .call_async(Ok(()))
                    .await
                    .map_err(|e| ApprovalError::HandlerFailed(e.into()))
            })
            .await
            .map_err(|_| ApprovalError::Timeout)
            .flatten()?;

            debug!(%is_approved, "Unlock response from Electron.");
            Ok(is_approved)
        }

        async fn request_sign_approval(
            &self,
            request: SSHSignApprovalRequest,
        ) -> Result<bool, ApprovalError> {
            let request = SignRequestData::from(request);

            debug!(?request, "Sending sign approval request to Electron.");

            let is_approved = timeout(APPROVAL_CALLBACK_TIMEOUT, async {
                self.sign_callback
                    .call_async(Ok(request))
                    .await
                    .map_err(|e| ApprovalError::HandlerFailed(e.into()))
            })
            .await
            .map_err(|_| ApprovalError::Timeout)
            .flatten()?;

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
        #[napi(
            factory,
            // ts_args_type overrides the generated TypeScript parameter types. The Rust type
            // `ThreadsafeFunction<T, bool>` would generate `(arg: T) => boolean`, but these
            // callbacks return Promises. `call_async` awaits the Promise and deserializes the
            // resolved value as `bool`, so `bool` is the correct Rust type — the mismatch is
            // only in the generated TypeScript declaration.
            ts_args_type = "unlockCallback: () => Promise<boolean>,
                            signCallback: (data: SignRequestData) => Promise<boolean>"
        )]
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
