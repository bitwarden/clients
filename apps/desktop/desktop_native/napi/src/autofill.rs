#[napi]
pub mod autofill {
    use desktop_core::ipc::server::{Message, MessageType};
    use napi::{
        bindgen_prelude::FnArgs,
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
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
        pub excluded_credentials: Vec<Vec<u8>>,
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
    #[derive(Debug, Serialize, Deserialize)]
    #[serde(rename_all = "camelCase")]
    pub struct NativeStatus {
        pub key: String,
        pub value: String,
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
    pub struct AutofillIpcServer {
        server: desktop_core::ipc::server::Server,
    }

    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    #[napi]
    impl AutofillIpcServer {
        /// Create and start the IPC server without blocking.
        ///
        /// @param name The endpoint name to listen on. This name uniquely identifies the IPC
        /// connection and must be the same for both the server and client. @param callback
        /// This function will be called whenever a message is received from a client.
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
                FnArgs<(u32, u32, PasskeyRegistrationRequest)>,
            >,
            #[napi(
                ts_arg_type = "(error: null | Error, clientId: number, sequenceNumber: number, message: PasskeyAssertionRequest) => void"
            )]
            assertion_callback: ThreadsafeFunction<
                FnArgs<(u32, u32, PasskeyAssertionRequest)>,
            >,
            #[napi(
                ts_arg_type = "(error: null | Error, clientId: number, sequenceNumber: number, message: PasskeyAssertionWithoutUserInterfaceRequest) => void"
            )]
            assertion_without_user_interface_callback: ThreadsafeFunction<
                FnArgs<(u32, u32, PasskeyAssertionWithoutUserInterfaceRequest)>,
            >,
            #[napi(
                ts_arg_type = "(error: null | Error, clientId: number, sequenceNumber: number, message: NativeStatus) => void"
            )]
            native_status_callback: ThreadsafeFunction<(u32, u32, NativeStatus)>,
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
                                        .map(|value| (client_id, msg.sequence_number, value).into())
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
                                        .map(|value| (client_id, msg.sequence_number, value).into())
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
                                        .map(|value| (client_id, msg.sequence_number, value).into())
                                        .map_err(|e| napi::Error::from_reason(format!("{e:?}")));
                                    registration_callback
                                        .call(value, ThreadsafeFunctionCallMode::NonBlocking);
                                    continue;
                                }
                                Err(e) => {
                                    error!(error = %e, "Error deserializing message2");
                                }
                            }

                            match serde_json::from_str::<PasskeyMessage<NativeStatus>>(&message) {
                                Ok(msg) => {
                                    let value = msg
                                        .value
                                        .map(|value| (client_id, msg.sequence_number, value))
                                        .map_err(|e| napi::Error::from_reason(format!("{e:?}")));
                                    native_status_callback
                                        .call(value, ThreadsafeFunctionCallMode::NonBlocking);
                                    continue;
                                }
                                Err(error) => {
                                    error!(%error, "Unable to deserialze native status.");
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

            Ok(AutofillIpcServer { server })
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
