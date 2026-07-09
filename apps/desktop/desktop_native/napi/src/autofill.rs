#[napi]
pub mod autofill {
    use autofill_provider::{
        BitwardenError, ExtensionRequest, ExtensionRequestMessage, NativeStatus,
        PasskeyAssertionRequest, PasskeyAssertionResponse,
        PasskeyAssertionWithoutUserInterfaceRequest, PasskeyRegistrationRequest,
        PasskeyRegistrationResponse,
    };
    use desktop_core::ipc::server::{Message, MessageType};
    use napi::{
        bindgen_prelude::FnArgs,
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
    };
    use serde::{de::DeserializeOwned, Deserialize, Serialize};
    use tracing::error;

    #[napi]
    pub async fn run_command(value: String) -> napi::Result<String> {
        Ok(desktop_core::autofill::run_command(value).await?)
    }

    #[derive(Serialize, Deserialize)]
    #[serde(bound = "T: Serialize + DeserializeOwned")]
    pub struct PasskeyMessage<T: Serialize + DeserializeOwned> {
        pub sequence_number: u32,
        pub value: Result<T, BitwardenError>,
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
            native_status_callback: ThreadsafeFunction<
                FnArgs<(u32, u32, NativeStatus)>,
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

                            let msg =
                                match serde_json::from_str::<ExtensionRequestMessage>(&message) {
                                    Ok(msg) => msg,
                                    Err(error) => {
                                        error!(
                                            %error,
                                            %message,
                                            "Received an unknown message from extension"
                                        );
                                        continue;
                                    }
                                };
                            match msg.request {
                                ExtensionRequest::LockStatus => {
                                    let _params = (client_id, msg.sequence_number);
                                    todo!("Add lock_status_callback");
                                    /*
                                    lock_status_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    */
                                }
                                ExtensionRequest::NativeStatus(native_status) => {
                                    let params = (client_id, msg.sequence_number, native_status);
                                    native_status_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::PasskeyAssertion(assertion_request) => {
                                    let params =
                                        (client_id, msg.sequence_number, assertion_request);
                                    assertion_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::PasskeyAssertionWithoutUserInterface(
                                    silent_assertion_request,
                                ) => {
                                    let params =
                                        (client_id, msg.sequence_number, silent_assertion_request);
                                    assertion_without_user_interface_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::PasskeyRegistration(registration_request) => {
                                    let params =
                                        (client_id, msg.sequence_number, registration_request);
                                    registration_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::WindowHandle => {
                                    let _params = (client_id, msg.sequence_number);
                                    todo!("Add window_handle_callback");
                                    /*
                                    window_handle_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    */
                                }
                            }
                        }
                    }
                }
            });

            let paths = desktop_core::ipc::all_paths(&name);

            let server =
                desktop_core::ipc::server::Server::start(paths.clone(), send).map_err(|e| {
                    napi::Error::from_reason(format!(
                        "Error listening to server - Paths: {paths:?} - Error: {e:?}"
                    ))
                })?;

            Ok(AutofillIpcServer { server })
        }

        /// Return the path to the IPC server.
        #[napi]
        pub fn get_paths(&self) -> Vec<String> {
            self.server
                .paths
                .iter()
                .filter_map(|p| p.to_string_lossy().into_owned().into())
                .collect()
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
                .map_err(|e| napi::Error::from_reason(format!("Error sending message: {e:?}")))
                // NAPI doesn't support u64 or usize, so we need to convert to u32
                .map(|u| u32::try_from(u).unwrap_or_default())
        }
    }
}
