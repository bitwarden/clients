#[macro_use]
extern crate napi_derive;

mod registry;

#[napi]
pub mod passwords {
    /// Fetch the stored password from the keychain.
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
    #[napi]
    pub async fn delete_password(service: String, account: String) -> napi::Result<()> {
        desktop_core::password::delete_password(&service, &account)
            .await
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    // Checks if the os secure storage is available
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
pub mod clipboards {
    #[napi]
    pub async fn read() -> napi::Result<String> {
        desktop_core::clipboard::read().map_err(|e| napi::Error::from_reason(e.to_string()))
    }

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

    impl From<desktop_core::ssh_agent::importer::SshKey> for SshKey {
        fn from(key: desktop_core::ssh_agent::importer::SshKey) -> Self {
            SshKey {
                private_key: key.private_key,
                public_key: key.public_key,
                key_fingerprint: key.key_fingerprint,
            }
        }
    }

    #[napi]
    pub enum SshKeyImportStatus {
        /// ssh key was parsed correctly and will be returned in the result
        Success,
        /// ssh key was parsed correctly but is encrypted and requires a password
        PasswordRequired,
        /// ssh key was parsed correctly, and a password was provided when calling the import, but it was incorrect
        WrongPassword,
        /// ssh key could not be parsed, either due to an incorrect / unsupported format (pkcs#8) or key type (ecdsa), or because the input is not an ssh key
        ParsingError,
        /// ssh key type is not supported (e.g. ecdsa)
        UnsupportedKeyType,
    }

    impl From<desktop_core::ssh_agent::importer::SshKeyImportStatus> for SshKeyImportStatus {
        fn from(status: desktop_core::ssh_agent::importer::SshKeyImportStatus) -> Self {
            match status {
                desktop_core::ssh_agent::importer::SshKeyImportStatus::Success => {
                    SshKeyImportStatus::Success
                }
                desktop_core::ssh_agent::importer::SshKeyImportStatus::PasswordRequired => {
                    SshKeyImportStatus::PasswordRequired
                }
                desktop_core::ssh_agent::importer::SshKeyImportStatus::WrongPassword => {
                    SshKeyImportStatus::WrongPassword
                }
                desktop_core::ssh_agent::importer::SshKeyImportStatus::ParsingError => {
                    SshKeyImportStatus::ParsingError
                }
                desktop_core::ssh_agent::importer::SshKeyImportStatus::UnsupportedKeyType => {
                    SshKeyImportStatus::UnsupportedKeyType
                }
            }
        }
    }

    #[napi(object)]
    pub struct SshKeyImportResult {
        pub status: SshKeyImportStatus,
        pub ssh_key: Option<SshKey>,
    }

    impl From<desktop_core::ssh_agent::importer::SshKeyImportResult> for SshKeyImportResult {
        fn from(result: desktop_core::ssh_agent::importer::SshKeyImportResult) -> Self {
            SshKeyImportResult {
                status: result.status.into(),
                ssh_key: result.ssh_key.map(|k| k.into()),
            }
        }
    }

    #[napi(object)]
    pub struct SshUIRequest {
        pub cipher_id: Option<String>,
        pub is_list: bool,
        pub process_name: String,
        pub is_forwarding: bool,
        pub namespace: Option<String>,
    }

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
                                println!("[SSH Agent Native Module] calling UI callback promise was rejected: {}", e);
                                let _ = auth_response_tx_arc
                                    .lock()
                                    .await
                                    .send((request.request_id, false))
                                    .expect("should be able to send auth response to agent");
                            }
                        },
                        Err(e) => {
                            println!("[SSH Agent Native Module] calling UI callback could not create promise: {}", e);
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
        )
        .await
        {
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
    pub fn import_key(encoded_key: String, password: String) -> napi::Result<SshKeyImportResult> {
        let result = desktop_core::ssh_agent::importer::import_key(encoded_key, password)
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(result.into())
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
    #[napi]
    pub async fn disable_coredumps() -> napi::Result<()> {
        desktop_core::process_isolation::disable_coredumps()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
    #[napi]
    pub async fn is_core_dumping_disabled() -> napi::Result<bool> {
        desktop_core::process_isolation::is_core_dumping_disabled()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
    #[napi]
    pub async fn disable_memory_access() -> napi::Result<()> {
        desktop_core::process_isolation::disable_memory_access()
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
    #[napi]
    pub async fn create_key(key: String, subkey: String, value: String) -> napi::Result<()> {
        crate::registry::create_key(&key, &subkey, &value)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

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
pub mod autofill {
    use desktop_core::ipc::server::{Message, MessageType};
    use napi::threadsafe_function::{
        ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode,
    };
    use serde::{de::DeserializeOwned, Deserialize, Serialize};

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
    pub struct PasskeyRegistrationRequest {
        pub rp_id: String,
        pub user_name: String,
        pub user_handle: Vec<u8>,
        pub client_data_hash: Vec<u8>,
        pub user_verification: UserVerification,
        pub supported_algorithms: Vec<i32>,
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
        pub credential_id: Vec<u8>,
        pub user_name: String,
        pub user_handle: Vec<u8>,
        pub record_identifier: Option<String>,
        pub client_data_hash: Vec<u8>,
        pub user_verification: UserVerification,
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

    #[napi]
    impl IpcServer {
        /// Create and start the IPC server without blocking.
        ///
        /// @param name The endpoint name to listen on. This name uniquely identifies the IPC connection and must be the same for both the server and client.
        /// @param callback This function will be called whenever a message is received from a client.
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
                                println!("[ERROR] Message is empty");
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
                                    println!("[ERROR] Error deserializing message1: {e}");
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
                                    println!("[ERROR] Error deserializing message2: {e}");
                                }
                            }

                            println!("[ERROR] Received an unknown message2: {message:?}");
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
pub mod crypto {
    use napi::bindgen_prelude::Buffer;

    #[napi]
    pub async fn argon2(
        secret: Buffer,
        salt: Buffer,
        iterations: u32,
        memory: u32,
        parallelism: u32,
    ) -> napi::Result<Buffer> {
        desktop_core::crypto::argon2(&secret, &salt, iterations, memory, parallelism)
            .map_err(|e| napi::Error::from_reason(e.to_string()))
            .map(|v| v.to_vec())
            .map(Buffer::from)
    }
}
