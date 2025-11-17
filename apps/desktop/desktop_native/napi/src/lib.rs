#[macro_use]
extern crate napi_derive;

mod passkey_authenticator_internal;
mod registry;

#[napi]
pub mod passwords {
    /// The error message returned when a password is not found during retrieval or deletion.
    #[napi]
    pub const PASSWORD_NOT_FOUND: &str = desktop_core::password::PASSWORD_NOT_FOUND;

    /// Fetch the stored password from the keychain.
    /// Throws {@link Error} with message {@link PASSWORD_NOT_FOUND} if the password does not exist.
    #[napi]
    pub async fn get_password(service: String, account: String) -> napi::Result<String> {
        desktop_core::password::get_password(&service, &account)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Save the password to the keychain. Adds an entry if none exists otherwise updates the existing entry.
    #[napi]
    pub async fn set_password(
        service: String,
        account: String,
        password: String,
    ) -> napi::Result<()> {
        desktop_core::password::set_password(&service, &account, &password)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Delete the stored password from the keychain.
    /// Throws {@link Error} with message {@link PASSWORD_NOT_FOUND} if the password does not exist.
    #[napi]
    pub async fn delete_password(service: String, account: String) -> napi::Result<()> {
        desktop_core::password::delete_password(&service, &account)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Checks if the os secure storage is available
    #[napi]
    pub async fn is_available() -> napi::Result<bool> {
        desktop_core::password::is_available()
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod biometrics {
    use desktop_core::biometric::{Biometric, BiometricTrait};

    // Prompt for biometric confirmation
    #[napi]
    pub async fn prompt(
        hwnd: napi::bindgen_prelude::Buffer,
        message: String,
    ) -> napi::Result<bool> {
        Biometric::prompt(hwnd.into(), message)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn available() -> napi::Result<bool> {
        Biometric::available()
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn set_biometric_secret(
        service: String,
        account: String,
        secret: String,
        key_material: Option<KeyMaterial>,
        iv_b64: String,
    ) -> napi::Result<String> {
        Biometric::set_biometric_secret(
            &service,
            &account,
            &secret,
            key_material.map(|m| m.into()),
            &iv_b64,
        )
        .await
        .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Retrieves the biometric secret for the given service and account.
    /// Throws Error with message [`passwords::PASSWORD_NOT_FOUND`] if the secret does not exist.
    #[napi]
    pub async fn get_biometric_secret(
        service: String,
        account: String,
        key_material: Option<KeyMaterial>,
    ) -> napi::Result<String> {
        Biometric::get_biometric_secret(&service, &account, key_material.map(|m| m.into()))
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    /// Derives key material from biometric data. Returns a string encoded with a
    /// base64 encoded key and the base64 encoded challenge used to create it
    /// separated by a `|` character.
    ///
    /// If the iv is provided, it will be used as the challenge. Otherwise a random challenge will be generated.
    ///
    /// `format!("<key_base64>|<iv_base64>")`
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn derive_key_material(iv: Option<String>) -> napi::Result<OsDerivedKey> {
        Biometric::derive_key_material(iv.as_deref())
            .map(|k| k.into())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi(object)]
    pub struct KeyMaterial {
        pub os_key_part_b64: String,
        pub client_key_part_b64: Option<String>,
    }

    impl From<KeyMaterial> for desktop_core::biometric::KeyMaterial {
        fn from(km: KeyMaterial) -> Self {
            desktop_core::biometric::KeyMaterial {
                os_key_part_b64: km.os_key_part_b64,
                client_key_part_b64: km.client_key_part_b64,
            }
        }
    }

    #[napi(object)]
    pub struct OsDerivedKey {
        pub key_b64: String,
        pub iv_b64: String,
    }

    impl From<desktop_core::biometric::OsDerivedKey> for OsDerivedKey {
        fn from(km: desktop_core::biometric::OsDerivedKey) -> Self {
            OsDerivedKey {
                key_b64: km.key_b64,
                iv_b64: km.iv_b64,
            }
        }
    }
}

#[napi]
pub mod biometrics_v2 {
    use desktop_core::biometric_v2::BiometricTrait;

    #[napi]
    pub struct BiometricLockSystem {
        inner: desktop_core::biometric_v2::BiometricLockSystem,
    }

    #[napi]
    pub fn init_biometric_system() -> napi::Result<BiometricLockSystem> {
        Ok(BiometricLockSystem {
            inner: desktop_core::biometric_v2::BiometricLockSystem::new(),
        })
    }

    #[napi]
    pub async fn authenticate(
        biometric_lock_system: &BiometricLockSystem,
        hwnd: napi::bindgen_prelude::Buffer,
        message: String,
    ) -> napi::Result<bool> {
        biometric_lock_system
            .inner
            .authenticate(hwnd.into(), message)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn authenticate_available(
        biometric_lock_system: &BiometricLockSystem,
    ) -> napi::Result<bool> {
        biometric_lock_system
            .inner
            .authenticate_available()
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn enroll_persistent(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
        key: napi::bindgen_prelude::Buffer,
    ) -> napi::Result<()> {
        biometric_lock_system
            .inner
            .enroll_persistent(&user_id, &key)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn provide_key(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
        key: napi::bindgen_prelude::Buffer,
    ) -> napi::Result<()> {
        biometric_lock_system
            .inner
            .provide_key(&user_id, &key)
            .await;
        Ok(())
    }

    #[napi]
    pub async fn unlock(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
        hwnd: napi::bindgen_prelude::Buffer,
    ) -> napi::Result<napi::bindgen_prelude::Buffer> {
        biometric_lock_system
            .inner
            .unlock(&user_id, hwnd.into())
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
            .map(|v| v.into())
    }

    #[napi]
    pub async fn unlock_available(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
    ) -> napi::Result<bool> {
        biometric_lock_system
            .inner
            .unlock_available(&user_id)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn has_persistent(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
    ) -> napi::Result<bool> {
        biometric_lock_system
            .inner
            .has_persistent(&user_id)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn unenroll(
        biometric_lock_system: &BiometricLockSystem,
        user_id: String,
    ) -> napi::Result<()> {
        biometric_lock_system
            .inner
            .unenroll(&user_id)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod clipboards {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn read() -> napi::Result<String> {
        desktop_core::clipboard::read().map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn write(text: String, password: bool) -> napi::Result<()> {
        desktop_core::clipboard::write(&text, password)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod sshagent {
    use std::sync::Arc;

    use napi::{
        bindgen_prelude::Promise,
        threadsafe_function::{ErrorStrategy::CalleeHandled, ThreadsafeFunction},
    };
    use tokio::{self, sync::Mutex};
    use tracing::error;

    #[napi]
    pub struct SshAgentState {
        state: desktop_core::ssh_agent::BitwardenDesktopAgent,
    }

    #[napi(object)]
    pub struct PrivateKey {
        pub private_key: String,
        pub name: String,
        pub cipher_id: String,
    }

    #[napi(object)]
    pub struct SshKey {
        pub private_key: String,
        pub public_key: String,
        pub key_fingerprint: String,
    }

    #[napi(object)]
    pub struct SshUIRequest {
        pub cipher_id: Option<String>,
        pub is_list: bool,
        pub process_name: String,
        pub is_forwarding: bool,
        pub namespace: Option<String>,
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn serve(
        callback: ThreadsafeFunction<SshUIRequest, CalleeHandled>,
    ) -> napi::Result<SshAgentState> {
        let (auth_request_tx, mut auth_request_rx) =
            tokio::sync::mpsc::channel::<desktop_core::ssh_agent::SshAgentUIRequest>(32);
        let (auth_response_tx, auth_response_rx) =
            tokio::sync::broadcast::channel::<(u32, bool)>(32);
        let auth_response_tx_arc = Arc::new(Mutex::new(auth_response_tx));
        tokio::spawn(async move {
            let _ = auth_response_rx;

            while let Some(request) = auth_request_rx.recv().await {
                let cloned_response_tx_arc = auth_response_tx_arc.clone();
                let cloned_callback = callback.clone();
                tokio::spawn(async move {
                    let auth_response_tx_arc = cloned_response_tx_arc;
                    let callback = cloned_callback;
                    let promise_result: Result<Promise<bool>, napi::Error> = callback
                        .call_async(Ok(SshUIRequest {
                            cipher_id: request.cipher_id,
                            is_list: request.is_list,
                            process_name: request.process_name,
                            is_forwarding: request.is_forwarding,
                            namespace: request.namespace,
                        }))
                        .await;
                    match promise_result {
                        Ok(promise_result) => match promise_result.await {
                            Ok(result) => {
                                let _ = auth_response_tx_arc
                                    .lock()
                                    .await
                                    .send((request.request_id, result))
                                    .expect("should be able to send auth response to agent");
                            }
                            Err(e) => {
                                error!(error = %e, "Calling UI callback promise was rejected");
                                let _ = auth_response_tx_arc
                                    .lock()
                                    .await
                                    .send((request.request_id, false))
                                    .expect("should be able to send auth response to agent");
                            }
                        },
                        Err(e) => {
                            error!(error = %e, "Calling UI callback could not create promise");
                            let _ = auth_response_tx_arc
                                .lock()
                                .await
                                .send((request.request_id, false))
                                .expect("should be able to send auth response to agent");
                        }
                    }
                });
            }
        });

        match desktop_core::ssh_agent::BitwardenDesktopAgent::start_server(
            auth_request_tx,
            Arc::new(Mutex::new(auth_response_rx)),
        ) {
            Ok(state) => Ok(SshAgentState { state }),
            Err(e) => Err(napi::Error::from_reason(e.to_string())),
        }
    }

    #[napi]
    pub fn stop(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state.stop();
        Ok(())
    }

    #[napi]
    pub fn is_running(agent_state: &mut SshAgentState) -> bool {
        let bitwarden_agent_state = agent_state.state.clone();
        bitwarden_agent_state.is_running()
    }

    #[napi]
    pub fn set_keys(
        agent_state: &mut SshAgentState,
        new_keys: Vec<PrivateKey>,
    ) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state
            .set_keys(
                new_keys
                    .iter()
                    .map(|k| (k.private_key.clone(), k.name.clone(), k.cipher_id.clone()))
                    .collect(),
            )
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(())
    }

    #[napi]
    pub fn lock(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state
            .lock()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn clear_keys(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state
            .clear_keys()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod processisolations {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn disable_coredumps() -> napi::Result<()> {
        desktop_core::process_isolation::disable_coredumps()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn is_core_dumping_disabled() -> napi::Result<bool> {
        desktop_core::process_isolation::is_core_dumping_disabled()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn isolate_process() -> napi::Result<()> {
        desktop_core::process_isolation::isolate_process()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod powermonitors {
    use napi::{
        threadsafe_function::{
            ErrorStrategy::CalleeHandled, ThreadsafeFunction, ThreadsafeFunctionCallMode,
        },
        tokio,
    };

    #[napi]
    pub async fn on_lock(callback: ThreadsafeFunction<(), CalleeHandled>) -> napi::Result<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(32);
        desktop_core::powermonitor::on_lock(tx)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        tokio::spawn(async move {
            while let Some(()) = rx.recv().await {
                callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
            }
        });
        Ok(())
    }

    #[napi]
    pub async fn is_lock_monitor_available() -> napi::Result<bool> {
        Ok(desktop_core::powermonitor::is_lock_monitor_available().await)
    }
}

#[napi]
pub mod windows_registry {
    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn create_key(key: String, subkey: String, value: String) -> napi::Result<()> {
        crate::registry::create_key(&key, &subkey, &value)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn delete_key(key: String, subkey: String) -> napi::Result<()> {
        crate::registry::delete_key(&key, &subkey)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod ipc {
    use desktop_core::ipc::server::{Message, MessageType};
    use napi::threadsafe_function::{
        ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode,
    };

    #[napi(object)]
    pub struct IpcMessage {
        pub client_id: u32,
        pub kind: IpcMessageType,
        pub message: Option<String>,
    }

    impl From<Message> for IpcMessage {
        fn from(message: Message) -> Self {
            IpcMessage {
                client_id: message.client_id,
                kind: message.kind.into(),
                message: message.message,
            }
        }
    }

    #[napi]
    pub enum IpcMessageType {
        Connected,
        Disconnected,
        Message,
    }

    impl From<MessageType> for IpcMessageType {
        fn from(message_type: MessageType) -> Self {
            match message_type {
                MessageType::Connected => IpcMessageType::Connected,
                MessageType::Disconnected => IpcMessageType::Disconnected,
                MessageType::Message => IpcMessageType::Message,
            }
        }
    }

    #[napi]
    pub struct IpcServer {
        server: desktop_core::ipc::server::Server,
    }

    #[napi]
    impl IpcServer {
        /// Create and start the IPC server without blocking.
        ///
        /// @param name The endpoint name to listen on. This name uniquely identifies the IPC connection and must be the same for both the server and client.
        /// @param callback This function will be called whenever a message is received from a client.
        #[allow(clippy::unused_async)] // FIXME: Remove unused async!
        #[napi(factory)]
        pub async fn listen(
            name: String,
            #[napi(ts_arg_type = "(error: null | Error, message: IpcMessage) => void")]
            callback: ThreadsafeFunction<IpcMessage, ErrorStrategy::CalleeHandled>,
        ) -> napi::Result<Self> {
            let (send, mut recv) = tokio::sync::mpsc::channel::<Message>(32);
            tokio::spawn(async move {
                while let Some(message) = recv.recv().await {
                    callback.call(Ok(message.into()), ThreadsafeFunctionCallMode::NonBlocking);
                }
            });

            let path = desktop_core::ipc::path(&name);

            let server = desktop_core::ipc::server::Server::start(&path, send).map_err(|e| {
                napi::Error::from_reason(format!(
                    "Error listening to server - Path: {path:?} - Error: {e} - {e:?}"
                ))
            })?;

            Ok(IpcServer { server })
        }

        /// Return the path to the IPC server.
        #[napi]
        pub fn get_path(&self) -> String {
            self.server.path.to_string_lossy().to_string()
        }

        /// Stop the IPC server.
        #[napi]
        pub fn stop(&self) -> napi::Result<()> {
            self.server.stop();
            Ok(())
        }

        /// Send a message over the IPC server to all the connected clients
        ///
        /// @return The number of clients that the message was sent to. Note that the number of messages
        /// actually received may be less, as some clients could disconnect before receiving the message.
        #[napi]
        pub fn send(&self, message: String) -> napi::Result<u32> {
            self.server
                .send(message)
                .map_err(|e| {
                    napi::Error::from_reason(format!("Error sending message - Error: {e} - {e:?}"))
                })
                // NAPI doesn't support u64 or usize, so we need to convert to u32
                .map(|u| u32::try_from(u).unwrap_or_default())
        }
    }
}

#[napi]
pub mod autostart {
    #[napi]
    pub async fn set_autostart(autostart: bool, params: Vec<String>) -> napi::Result<()> {
        desktop_core::autostart::set_autostart(autostart, params)
            .await
            .map_err(|e| napi::Error::from_reason(format!("Error setting autostart - {e} - {e:?}")))
    }
}

#[napi]
pub mod autofill {
    use desktop_core::ipc::server::{Message, MessageType};
    use napi::threadsafe_function::{
        ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode,
    };
    use serde::{de::DeserializeOwned, Deserialize, Serialize};
    use tracing::error;

    #[napi]
    pub async fn run_command(value: String) -> napi::Result<String> {
        desktop_core::autofill::run_command(value)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[derive(Debug, serde::Serialize, serde:: Deserialize)]
    pub enum BitwardenError {
        Internal(String),
    }

    #[napi(string_enum)]
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub enum UserVerification {
        #[napi(value = "preferred")]
        Preferred,
        #[napi(value = "required")]
        Required,
        #[napi(value = "discouraged")]
        Discouraged,
    }

    #[derive(Serialize, Deserialize)]
    #[serde(bound = "T: Serialize + DeserializeOwned")]
    pub struct PasskeyMessage<T: Serialize + DeserializeOwned> {
        pub sequence_number: u32,
        pub value: Result<T, BitwardenError>,
    }

    #[napi(object)]
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct Position {
        pub x: i32,
        pub y: i32,
    }

    #[napi(object)]
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PasskeyRegistrationRequest {
        pub rp_id: String,
        pub user_name: String,
        pub user_handle: Vec<u8>,
        pub client_data_hash: Vec<u8>,
        pub user_verification: UserVerification,
        pub supported_algorithms: Vec<i32>,
        pub window_xy: Position,
    }

    #[napi(object)]
    #[derive(Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PasskeyRegistrationResponse {
        pub rp_id: String,
        pub client_data_hash: Vec<u8>,
        pub credential_id: Vec<u8>,
        pub attestation_object: Vec<u8>,
    }

    #[napi(object)]
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PasskeyAssertionRequest {
        pub rp_id: String,
        pub client_data_hash: Vec<u8>,
        pub user_verification: UserVerification,
        pub allowed_credentials: Vec<Vec<u8>>,
        pub window_xy: Position,
        //extension_input: Vec<u8>, TODO: Implement support for extensions
    }

    #[napi(object)]
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PasskeyAssertionWithoutUserInterfaceRequest {
        pub rp_id: String,
        pub credential_id: Vec<u8>,
        pub user_name: String,
        pub user_handle: Vec<u8>,
        pub record_identifier: Option<String>,
        pub client_data_hash: Vec<u8>,
        pub user_verification: UserVerification,
        pub window_xy: Position,
    }

    #[napi(object)]
    #[derive(Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct PasskeyAssertionResponse {
        pub rp_id: String,
        pub user_handle: Vec<u8>,
        pub signature: Vec<u8>,
        pub client_data_hash: Vec<u8>,
        pub authenticator_data: Vec<u8>,
        pub credential_id: Vec<u8>,
    }

    #[napi]
    pub struct IpcServer {
        server: desktop_core::ipc::server::Server,
    }

    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    #[napi]
    impl IpcServer {
        /// Create and start the IPC server without blocking.
        ///
        /// @param name The endpoint name to listen on. This name uniquely identifies the IPC connection and must be the same for both the server and client.
        /// @param callback This function will be called whenever a message is received from a client.
        #[allow(clippy::unused_async)] // FIXME: Remove unused async!
        #[napi(factory)]
        pub async fn listen(
            name: String,
            // Ideally we'd have a single callback that has an enum containing the request values,
            // but NAPI doesn't support that just yet
            #[napi(
                ts_arg_type = "(error: null | Error, clientId: number, sequenceNumber: number, message: PasskeyRegistrationRequest) => void"
            )]
            registration_callback: ThreadsafeFunction<
                (u32, u32, PasskeyRegistrationRequest),
                ErrorStrategy::CalleeHandled,
            >,
            #[napi(
                ts_arg_type = "(error: null | Error, clientId: number, sequenceNumber: number, message: PasskeyAssertionRequest) => void"
            )]
            assertion_callback: ThreadsafeFunction<
                (u32, u32, PasskeyAssertionRequest),
                ErrorStrategy::CalleeHandled,
            >,
            #[napi(
                ts_arg_type = "(error: null | Error, clientId: number, sequenceNumber: number, message: PasskeyAssertionWithoutUserInterfaceRequest) => void"
            )]
            assertion_without_user_interface_callback: ThreadsafeFunction<
                (u32, u32, PasskeyAssertionWithoutUserInterfaceRequest),
                ErrorStrategy::CalleeHandled,
            >,
        ) -> napi::Result<Self> {
            let (send, mut recv) = tokio::sync::mpsc::channel::<Message>(32);
            tokio::spawn(async move {
                while let Some(Message {
                    client_id,
                    kind,
                    message,
                }) = recv.recv().await
                {
                    match kind {
                        // TODO: We're ignoring the connection and disconnection messages for now
                        MessageType::Connected | MessageType::Disconnected => continue,
                        MessageType::Message => {
                            let Some(message) = message else {
                                error!("Message is empty");
                                continue;
                            };

                            match serde_json::from_str::<PasskeyMessage<PasskeyAssertionRequest>>(
                                &message,
                            ) {
                                Ok(msg) => {
                                    let value = msg
                                        .value
                                        .map(|value| (client_id, msg.sequence_number, value))
                                        .map_err(|e| napi::Error::from_reason(format!("{e:?}")));

                                    assertion_callback
                                        .call(value, ThreadsafeFunctionCallMode::NonBlocking);
                                    continue;
                                }
                                Err(e) => {
                                    error!(error = %e, "Error deserializing message1");
                                }
                            }

                            match serde_json::from_str::<
                                PasskeyMessage<PasskeyAssertionWithoutUserInterfaceRequest>,
                            >(&message)
                            {
                                Ok(msg) => {
                                    let value = msg
                                        .value
                                        .map(|value| (client_id, msg.sequence_number, value))
                                        .map_err(|e| napi::Error::from_reason(format!("{e:?}")));

                                    assertion_without_user_interface_callback
                                        .call(value, ThreadsafeFunctionCallMode::NonBlocking);
                                    continue;
                                }
                                Err(e) => {
                                    error!(error = %e, "Error deserializing message1");
                                }
                            }

                            match serde_json::from_str::<PasskeyMessage<PasskeyRegistrationRequest>>(
                                &message,
                            ) {
                                Ok(msg) => {
                                    let value = msg
                                        .value
                                        .map(|value| (client_id, msg.sequence_number, value))
                                        .map_err(|e| napi::Error::from_reason(format!("{e:?}")));
                                    registration_callback
                                        .call(value, ThreadsafeFunctionCallMode::NonBlocking);
                                    continue;
                                }
                                Err(e) => {
                                    error!(error = %e, "Error deserializing message2");
                                }
                            }

                            error!(message, "Received an unknown message2");
                        }
                    }
                }
            });

            let path = desktop_core::ipc::path(&name);

            let server = desktop_core::ipc::server::Server::start(&path, send).map_err(|e| {
                napi::Error::from_reason(format!(
                    "Error listening to server - Path: {path:?} - Error: {e} - {e:?}"
                ))
            })?;

            Ok(IpcServer { server })
        }

        /// Return the path to the IPC server.
        #[napi]
        pub fn get_path(&self) -> String {
            self.server.path.to_string_lossy().to_string()
        }

        /// Stop the IPC server.
        #[napi]
        pub fn stop(&self) -> napi::Result<()> {
            self.server.stop();
            Ok(())
        }

        #[napi]
        pub fn complete_registration(
            &self,
            client_id: u32,
            sequence_number: u32,
            response: PasskeyRegistrationResponse,
        ) -> napi::Result<u32> {
            let message = PasskeyMessage {
                sequence_number,
                value: Ok(response),
            };
            self.send(client_id, serde_json::to_string(&message).unwrap())
        }

        #[napi]
        pub fn complete_assertion(
            &self,
            client_id: u32,
            sequence_number: u32,
            response: PasskeyAssertionResponse,
        ) -> napi::Result<u32> {
            let message = PasskeyMessage {
                sequence_number,
                value: Ok(response),
            };
            self.send(client_id, serde_json::to_string(&message).unwrap())
        }

        #[napi]
        pub fn complete_error(
            &self,
            client_id: u32,
            sequence_number: u32,
            error: String,
        ) -> napi::Result<u32> {
            let message: PasskeyMessage<()> = PasskeyMessage {
                sequence_number,
                value: Err(BitwardenError::Internal(error)),
            };
            self.send(client_id, serde_json::to_string(&message).unwrap())
        }

        // TODO: Add a way to send a message to a specific client?
        fn send(&self, _client_id: u32, message: String) -> napi::Result<u32> {
            self.server
                .send(message)
                .map_err(|e| {
                    napi::Error::from_reason(format!("Error sending message - Error: {e} - {e:?}"))
                })
                // NAPI doesn't support u64 or usize, so we need to convert to u32
                .map(|u| u32::try_from(u).unwrap_or_default())
        }
    }
}

#[napi]
pub mod passkey_authenticator {
    #[napi]
    pub fn register() -> napi::Result<()> {
        crate::passkey_authenticator_internal::register().map_err(|e| {
            napi::Error::from_reason(format!("Passkey registration failed - Error: {e} - {e:?}"))
        })
    }
}

#[napi]
pub mod logging {
    //! `logging` is the interface between the native desktop's usage of the `tracing` crate
    //!  for logging, to intercept events and write to the JS space.
    //!
    //! # Example
    //!
    //! [Elec] 14:34:03.517 › [NAPI] [INFO] desktop_core::ssh_agent::platform_ssh_agent: Starting SSH Agent server {socket=/Users/foo/.bitwarden-ssh-agent.sock}

    use std::fmt::Write;
    use std::sync::OnceLock;

    use napi::threadsafe_function::{
        ErrorStrategy::CalleeHandled, ThreadsafeFunction, ThreadsafeFunctionCallMode,
    };
    use tracing::Level;
    use tracing_subscriber::fmt::format::{DefaultVisitor, Writer};
    use tracing_subscriber::{
        filter::{EnvFilter, LevelFilter},
        layer::SubscriberExt,
        util::SubscriberInitExt,
        Layer,
    };

    struct JsLogger(OnceLock<ThreadsafeFunction<(LogLevel, String), CalleeHandled>>);
    static JS_LOGGER: JsLogger = JsLogger(OnceLock::new());

    #[napi]
    pub enum LogLevel {
        Trace,
        Debug,
        Info,
        Warn,
        Error,
    }

    impl From<&Level> for LogLevel {
        fn from(level: &Level) -> Self {
            match *level {
                Level::TRACE => LogLevel::Trace,
                Level::DEBUG => LogLevel::Debug,
                Level::INFO => LogLevel::Info,
                Level::WARN => LogLevel::Warn,
                Level::ERROR => LogLevel::Error,
            }
        }
    }

    // JsLayer lets us intercept events and write them to the JS Logger.
    struct JsLayer;

    impl<S> Layer<S> for JsLayer
    where
        S: tracing::Subscriber,
    {
        // This function builds a log message buffer from the event data and
        // calls the JS logger with it.
        //
        // For example, this log call:
        //
        // ```
        // mod supreme {
        //   mod module {
        //     let foo = "bar";
        //     info!(best_variable_name = %foo, "Foo done it again.");
        //   }
        // }
        // ```
        //
        // , results in the following string:
        //
        // [INFO] supreme::module: Foo done it again. {best_variable_name=bar}
        fn on_event(
            &self,
            event: &tracing::Event<'_>,
            _ctx: tracing_subscriber::layer::Context<'_, S>,
        ) {
            let mut buffer = String::new();

            // create the preamble text that precedes the message and vars. e.g.:
            //     [INFO] desktop_core::ssh_agent::platform_ssh_agent:
            let level = event.metadata().level().as_str();
            let module_path = event.metadata().module_path().unwrap_or_default();

            write!(&mut buffer, "[{level}] {module_path}:")
                .expect("Failed to write tracing event to buffer");

            let writer = Writer::new(&mut buffer);

            // DefaultVisitor adds the message and variables to the buffer
            let mut visitor = DefaultVisitor::new(writer, false);
            event.record(&mut visitor);

            let msg = (event.metadata().level().into(), buffer);

            if let Some(logger) = JS_LOGGER.0.get() {
                let _ = logger.call(Ok(msg), ThreadsafeFunctionCallMode::NonBlocking);
            };
        }
    }

    #[napi]
    pub fn init_napi_log(js_log_fn: ThreadsafeFunction<(LogLevel, String), CalleeHandled>) {
        let _ = JS_LOGGER.0.set(js_log_fn);

        let filter = EnvFilter::builder()
            // set the default log level to INFO.
            .with_default_directive(LevelFilter::INFO.into())
            // parse directives from the RUST_LOG environment variable,
            // overriding the default directive for matching targets.
            .from_env_lossy();

        // With the `tracing-log` feature enabled for the `tracing_subscriber`,
        // the registry below will initialize a log compatibility layer, which allows
        // the subscriber to consume log::Records as though they were tracing Events.
        // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/util/trait.SubscriberInitExt.html#method.init
        tracing_subscriber::registry()
            .with(filter)
            .with(JsLayer)
            .init();
    }
}

#[napi]
pub mod chromium_importer {
    use chromium_importer::{
        chromium::{
            DefaultInstalledBrowserRetriever, LoginImportResult as _LoginImportResult,
            ProfileInfo as _ProfileInfo,
        },
        metadata::NativeImporterMetadata as _NativeImporterMetadata,
    };
    use std::collections::HashMap;

    #[napi(object)]
    pub struct ProfileInfo {
        pub id: String,
        pub name: String,
    }

    #[napi(object)]
    pub struct Login {
        pub url: String,
        pub username: String,
        pub password: String,
        pub note: String,
    }

    #[napi(object)]
    pub struct LoginImportFailure {
        pub url: String,
        pub username: String,
        pub error: String,
    }

    #[napi(object)]
    pub struct LoginImportResult {
        pub login: Option<Login>,
        pub failure: Option<LoginImportFailure>,
    }

    #[napi(object)]
    pub struct NativeImporterMetadata {
        pub id: String,
        pub loaders: Vec<&'static str>,
        pub instructions: &'static str,
    }

    impl From<_LoginImportResult> for LoginImportResult {
        fn from(l: _LoginImportResult) -> Self {
            match l {
                _LoginImportResult::Success(l) => LoginImportResult {
                    login: Some(Login {
                        url: l.url,
                        username: l.username,
                        password: l.password,
                        note: l.note,
                    }),
                    failure: None,
                },
                _LoginImportResult::Failure(l) => LoginImportResult {
                    login: None,
                    failure: Some(LoginImportFailure {
                        url: l.url,
                        username: l.username,
                        error: l.error,
                    }),
                },
            }
        }
    }

    impl From<_ProfileInfo> for ProfileInfo {
        fn from(p: _ProfileInfo) -> Self {
            ProfileInfo {
                id: p.folder,
                name: p.name,
            }
        }
    }

    impl From<_NativeImporterMetadata> for NativeImporterMetadata {
        fn from(m: _NativeImporterMetadata) -> Self {
            NativeImporterMetadata {
                id: m.id,
                loaders: m.loaders,
                instructions: m.instructions,
            }
        }
    }

    #[napi]
    /// Returns OS aware metadata describing supported Chromium based importers as a JSON string.
    pub fn get_metadata() -> HashMap<String, NativeImporterMetadata> {
        chromium_importer::metadata::get_supported_importers::<DefaultInstalledBrowserRetriever>()
            .into_iter()
            .map(|(browser, metadata)| (browser, NativeImporterMetadata::from(metadata)))
            .collect()
    }

    #[napi]
    pub fn get_available_profiles(browser: String) -> napi::Result<Vec<ProfileInfo>> {
        chromium_importer::chromium::get_available_profiles(&browser)
            .map(|profiles| profiles.into_iter().map(ProfileInfo::from).collect())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub async fn import_logins(
        browser: String,
        profile_id: String,
    ) -> napi::Result<Vec<LoginImportResult>> {
        chromium_importer::chromium::import_logins(&browser, &profile_id)
            .await
            .map(|logins| logins.into_iter().map(LoginImportResult::from).collect())
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}

#[napi]
pub mod autotype {
    #[napi]
    pub fn get_foreground_window_title() -> napi::Result<String, napi::Status> {
        autotype::get_foreground_window_title().map_err(|_| {
            napi::Error::from_reason(
                "Autotype Error: failed to get foreground window title".to_string(),
            )
        })
    }

    #[napi]
    pub fn type_input(
        input: Vec<u16>,
        keyboard_shortcut: Vec<String>,
    ) -> napi::Result<(), napi::Status> {
        autotype::type_input(input, keyboard_shortcut).map_err(|_| {
            napi::Error::from_reason("Autotype Error: failed to type input".to_string())
        })
    }
}

#[napi]
pub mod navigator_credentials {
    use napi::bindgen_prelude::Uint8Array;

    #[napi(string_enum)]
    pub enum UserVerification {
        Preferred,
        Required,
        Discouraged,
    }

    impl From<UserVerification> for fido2_client::UserVerification {
        fn from(val: UserVerification) -> Self {
            match val {
                UserVerification::Preferred => fido2_client::UserVerification::Preferred,
                UserVerification::Required => fido2_client::UserVerification::Required,
                UserVerification::Discouraged => fido2_client::UserVerification::Discouraged,
            }
        }
    }

    #[napi(object)]
    pub struct PrfConfig {
        pub first: Uint8Array,
        pub second: Option<Uint8Array>,
    }

    impl From<PrfConfig> for fido2_client::PrfConfig {
        fn from(val: PrfConfig) -> Self {
            fido2_client::PrfConfig {
                first: val.first.to_vec(),
                second: val.second.map(|s| s.to_vec()),
            }
        }
    }

    #[napi(object)]
    pub struct PublicKeyCredentialRequestOptions {
        pub challenge: Uint8Array,
        pub timeout: i64,
        pub rp_id: String,
        pub user_verification: UserVerification,
        pub allow_credentials: Vec<Uint8Array>,
        pub prf: Option<PrfConfig>,
    }

    impl TryInto<fido2_client::PublicKeyCredentialRequestOptions>
        for PublicKeyCredentialRequestOptions
    {
        type Error = napi::Error;

        fn try_into(self) -> Result<fido2_client::PublicKeyCredentialRequestOptions, Self::Error> {
            Ok(fido2_client::PublicKeyCredentialRequestOptions {
                challenge: self.challenge.to_vec(),
                timeout: self.timeout as u64,
                rp_id: self.rp_id,
                user_verification: self.user_verification.into(),
                allow_credentials: self.allow_credentials.iter().map(|c| c.to_vec()).collect(),
                prf: self.prf.map(|p| p.into()),
            })
        }
    }

    #[napi(object)]
    pub struct AuthenticatorAssertionResponse {
        pub authenticator_data: Uint8Array,
        pub client_data_json: Uint8Array,
        pub signature: Uint8Array,
        pub user_handle: Uint8Array,
    }

    impl From<fido2_client::AuthenticatorAssertionResponse> for AuthenticatorAssertionResponse {
        fn from(response: fido2_client::AuthenticatorAssertionResponse) -> Self {
            AuthenticatorAssertionResponse {
                authenticator_data: Uint8Array::from(response.authenticator_data),
                client_data_json: Uint8Array::from(response.client_data_json),
                signature: Uint8Array::from(response.signature),
                user_handle: Uint8Array::from(response.user_handle),
            }
        }
    }

    #[napi(object)]
    pub struct PublicKeyCredential {
        pub authenticator_attachment: String,
        pub id: String,
        pub raw_id: Uint8Array,
        pub response: AuthenticatorAssertionResponse,
        pub r#type: String,
        pub prf: Option<Uint8Array>,
    }

    impl From<fido2_client::PublicKeyCredential> for PublicKeyCredential {
        fn from(val: fido2_client::PublicKeyCredential) -> Self {
            PublicKeyCredential {
                authenticator_attachment: val.authenticator_attachment,
                id: val.id,
                raw_id: Uint8Array::from(val.raw_id),
                response: val.response.into(),
                r#type: val.r#type,
                prf: val.prf.map(Uint8Array::from),
            }
        }
    }

    #[napi]
    pub fn get(
        assertion_options: PublicKeyCredentialRequestOptions,
    ) -> napi::Result<PublicKeyCredential> {
        let options: fido2_client::PublicKeyCredentialRequestOptions =
            assertion_options.try_into()?;
        fido2_client::fido2_client::get(options)
            .map_err(|e| napi::Error::from_reason(format!("FIDO2 Authentication failed: {:?}", e)))
            .map(|credential| credential.into())
    }

    #[napi]
    pub fn available() -> bool {
        fido2_client::fido2_client::available()
    }
}
