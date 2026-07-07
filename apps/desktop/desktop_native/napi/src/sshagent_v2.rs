//! SSH Agent napi:
//! - Wraps the agent to provide access from Electron.
//! - Sets up the callback handlers for the agent to request approval for ssh agent server
//!   operations to Electron.

#[napi]
pub mod sshagent_v2 {
    use std::{sync::Arc, time::Duration};

    use async_trait::async_trait;
    use napi::{
        bindgen_prelude::{JsValuesTupleIntoVec, Promise},
        threadsafe_function::ThreadsafeFunction,
    };
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
        pub host_fingerprint: Option<String>,
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
                host_fingerprint: r.host_fingerprint,
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
        sign_callback: Arc<ThreadsafeFunction<SignRequestData, Promise<bool>>>,
        list_callback: Arc<ThreadsafeFunction<(), Promise<bool>>>,
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
            request: SSHSignApprovalRequest,
        ) -> Result<bool, ApprovalError> {
            debug!("Sending sign approval request to Electron.");

            let is_approved =
                invoke_callback(&self.sign_callback, SignRequestData::from(request)).await?;

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
        /// * `sign_callback` - Allows agent to get approval for sign requests
        /// * `list_callback` - Allows agent to get approval for list key requests
        #[napi(factory)]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            sign_callback: ThreadsafeFunction<SignRequestData, Promise<bool>>,
            list_callback: ThreadsafeFunction<(), Promise<bool>>,
        ) -> napi::Result<Self> {
            debug!("Creating agent and starting server.");

            let approval_handler = ElectronApprovalRequester {
                sign_callback: Arc::new(sign_callback),
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
            let parsed = new_keys
                .into_iter()
                .map(|k| {
                    ssh_agent::SSHKeyData::from_private_key_pem(&k.private_key, k.name, k.cipher_id)
                        .map_err(|e| napi::Error::from_reason(e.to_string()))
                })
                .collect::<napi::Result<Vec<_>>>()?;

            self.agent
                .replace(parsed)
                .map_err(|e| napi::Error::from_reason(e.to_string()))
        }
    }
}
