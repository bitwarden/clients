//! SSH Agent napi:
//! - Wraps the agent to provide access from Electron.
//! - Sets up the callback handlers for the agent to request approval for ssh agent server
//!   operations to Electron.

#[napi]
pub mod sshagent {
    use std::{sync::Arc, time::Duration};

    use async_trait::async_trait;
    use napi::{
        bindgen_prelude::{JsValuesTupleIntoVec, Promise},
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
    };
    use ssh_agent::{
        Activity as SSHActivity, ActivityObserver, ActivityOperation as SSHActivityOperation,
        ActivityOutcome as SSHActivityOutcome, ApprovalError, ApprovalRequester, BitwardenSSHAgent,
        InMemoryEncryptedKeyStore, SIGNamespace as SSHSIGNamespace,
        SignApprovalRequest as SSHSignApprovalRequest, StartError, UnparsedSSHKeyData,
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
        /// The nearest AI agent above the requesting process, e.g. `claude`.
        pub ai_agent: Option<String>,
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
                process_name: r.connection.process_name,
                ai_agent: r.connection.ai_agent,
                is_forwarding: r
                    .connection
                    .session_bind
                    .as_ref()
                    .is_some_and(|s| s.is_forwarding),
                namespace: r.namespace.map(Into::into),
                host_fingerprint: r.connection.session_bind.map(|s| s.host_fingerprint),
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

    /// An agent operation a peer requested.
    #[napi(string_enum = "camelCase")]
    #[derive(Debug)]
    pub enum ActivityOperation {
        List,
        Sign,
    }

    /// How the agent answered an operation.
    #[napi(string_enum = "camelCase")]
    #[derive(Debug)]
    pub enum ActivityOutcome {
        Allowed,
        Denied,
        Failed,
    }

    impl From<SSHActivityOutcome> for ActivityOutcome {
        fn from(outcome: SSHActivityOutcome) -> Self {
            match outcome {
                SSHActivityOutcome::Allowed => Self::Allowed,
                SSHActivityOutcome::Denied => Self::Denied,
                SSHActivityOutcome::Failed => Self::Failed,
            }
        }
    }

    /// One answered agent operation and the process that requested it.
    #[napi(object)]
    #[derive(Debug)]
    pub struct ActivityData {
        pub operation: ActivityOperation,
        pub outcome: ActivityOutcome,
        pub cipher_id: Option<String>,
        pub namespace: Option<SIGNamespace>,
        pub process_name: Option<String>,
        /// The requesting process's command line, e.g. `ssh -t example.com`.
        pub command: Option<String>,
        /// The nearest app above the requesting process, e.g. `claude`.
        pub caller_app: Option<String>,
        /// The outermost app above the requesting process, e.g. `iTerm2`.
        pub host_app: Option<String>,
        /// The nearest AI agent above the requesting process, e.g. `claude`.
        pub ai_agent: Option<String>,
        /// The server an `ssh` process logs in to, e.g. `git@github.com`.
        pub destination: Option<String>,
        pub is_forwarding: bool,
        pub host_fingerprint: Option<String>,
    }

    impl From<SSHActivity> for ActivityData {
        fn from(activity: SSHActivity) -> Self {
            let (operation, cipher_id, namespace) = match activity.operation {
                SSHActivityOperation::List => (ActivityOperation::List, None, None),
                SSHActivityOperation::Sign {
                    cipher_id,
                    namespace,
                } => (ActivityOperation::Sign, cipher_id, namespace),
            };
            let connection = activity.connection;

            Self {
                operation,
                outcome: activity.outcome.into(),
                cipher_id,
                namespace: namespace.map(Into::into),
                process_name: connection.process_name,
                command: connection.command,
                caller_app: connection.caller_app,
                host_app: connection.host_app,
                ai_agent: connection.ai_agent,
                destination: connection.destination,
                is_forwarding: connection
                    .session_bind
                    .as_ref()
                    .is_some_and(|s| s.is_forwarding),
                host_fingerprint: connection.session_bind.map(|s| s.host_fingerprint),
            }
        }
    }

    /// Returns the address the agent binds: the Unix socket path (honouring
    /// `BITWARDEN_SSH_AUTH_SOCK` and the Flatpak data directory) or the Windows pipe name.
    ///
    /// Uses the same resolution as the server itself, so it is valid even when the agent is not
    /// running. Throws if the address cannot be resolved (for example no home directory); the
    /// error text never contains a path.
    #[napi]
    pub fn get_socket_address() -> napi::Result<String> {
        ssh_agent::socket_address().map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Resolves to `true` if a client can connect to `address` (Unix socket path or Windows pipe
    /// name) within a short timeout.
    ///
    /// Connects only; no SSH agent protocol message is sent, so no approval prompt is
    /// triggered on the listening agent.
    #[napi]
    pub async fn probe_address(address: String) -> bool {
        ssh_agent::probe_address(&address).await
    }

    /// Maps a [`StartError`] to a JS `Error` whose message is the stable error code.
    fn start_error_to_napi(error: &StartError) -> napi::Error {
        napi::Error::new(napi::Status::GenericFailure, error.code())
    }

    /// Wrapper for Electron to be able to interface with the agent directly.
    #[napi]
    pub struct SSHAgentState {
        agent: BitwardenSSHAgent<
            InMemoryEncryptedKeyStore,
            ElectronApprovalRequester,
            ElectronActivityObserver,
        >,
    }

    /// Forwards the agent's activity to Electron, without waiting for it.
    struct ElectronActivityObserver {
        callback: ThreadsafeFunction<ActivityData, ()>,
    }

    impl ActivityObserver for ElectronActivityObserver {
        fn observe(&self, activity: SSHActivity) {
            let status = self.callback.call(
                Ok(ActivityData::from(activity)),
                ThreadsafeFunctionCallMode::NonBlocking,
            );
            if status != napi::Status::Ok {
                error!(?status, "Failed to send SSH agent activity to Electron.");
            }
        }
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
        /// Rejects with an `Error` whose `message` is exactly one of `"address-in-use"`,
        /// `"permission-denied"` or `"unknown"` when the server cannot start. The message never
        /// contains a path, pipe name or key material.
        ///
        /// # Arguments
        ///
        /// * `sign_callback` - Allows agent to get approval for sign requests
        /// * `list_callback` - Allows agent to get approval for list key requests
        /// * `activity_callback` - Receives every answered request and the process that sent it
        #[napi(factory)]
        #[allow(clippy::unused_async)]
        pub async fn serve(
            sign_callback: ThreadsafeFunction<SignRequestData, Promise<bool>>,
            list_callback: ThreadsafeFunction<(), Promise<bool>>,
            activity_callback: ThreadsafeFunction<ActivityData, ()>,
        ) -> napi::Result<Self> {
            debug!("Creating agent and starting server.");

            let approval_handler = ElectronApprovalRequester {
                sign_callback: Arc::new(sign_callback),
                list_callback: Arc::new(list_callback),
            };

            let keystore = InMemoryEncryptedKeyStore::default();

            let activity_observer = ElectronActivityObserver {
                callback: activity_callback,
            };

            let mut agent =
                ssh_agent::BitwardenSSHAgent::new(keystore, approval_handler, activity_observer);

            agent.start().map_err(|error| {
                // `StartError` never contains the socket path or pipe name.
                error!(%error, source = ?std::error::Error::source(&error), "Failed to start the server.");
                start_error_to_napi(&error)
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
}
