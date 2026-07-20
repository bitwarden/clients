#[napi]
pub mod autofill {
    use autofill_provider::{
        BitwardenError, ExtensionRequest, ExtensionRequestMessage, LockStatusResponse,
        NativeStatus, PasskeyAssertionRequest, PasskeyAssertionResponse,
        PasskeyAssertionWithoutUserInterfaceRequest, PasskeyRegistrationRequest,
        PasskeyRegistrationResponse, WindowHandleQueryResponse,
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

    // TODO(PM-40230): Investigate if we can define the response types on these
    // callbacks directly.
    #[napi(object, object_to_js = false)]
    pub struct AutofillIpcCallbacks {
        /// Function to execute when a passkey registration request is received.
        ///
        /// The `context` field should be stored, as the cancel_request_callback
        /// will use the same value to identify the request to be cancelled.
        #[napi(ts_type = "{ \
                    (error: null, clientId: number, sequenceNumber: number, message: PasskeyRegistrationRequest): void; \
                    (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
                }")]
        pub registration_callback:
            ThreadsafeFunction<FnArgs<(u32, u32, PasskeyRegistrationRequest)>>,

        /// Function to execute when a passkey assertion request is received.
        ///
        /// The `context` field should be stored, as the cancel_request_callback
        /// will use the same value to identify the request to be cancelled.
        #[napi(ts_type = "{ \
                    (error: null, clientId: number, sequenceNumber: number, message: PasskeyAssertionRequest): void; \
                    (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
                }")]
        pub assertion_callback: ThreadsafeFunction<FnArgs<(u32, u32, PasskeyAssertionRequest)>>,

        /// Function to execute when a passkey assertion request is received and the UI must not be
        /// shown.
        ///
        /// The `context` field should be stored, as the cancel_request_callback
        /// will use the same value to identify the request to be cancelled.
        #[napi(ts_type = "{ \
            (error: null, clientId: number, sequenceNumber: number, message: PasskeyAssertionWithoutUserInterfaceRequest): void; \
            (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
        }")]
        pub assertion_without_user_interface_callback:
            ThreadsafeFunction<FnArgs<(u32, u32, PasskeyAssertionWithoutUserInterfaceRequest)>>,

        /// Function to execute when a notification of the autofill provider's status is received.
        #[napi(ts_type = "{ \
            (error: null, clientId: number, sequenceNumber: number, message: NativeStatus): void; \
            (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
        }")]
        pub native_status_callback: ThreadsafeFunction<FnArgs<(u32, u32, NativeStatus)>>,

        /// Function to execute to retrieve the lock status of the vault.
        #[napi(ts_type = "{ \
            (error: null, clientId: number, sequenceNumber: number): void; \
            (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
        }")]
        pub lock_status_callback: ThreadsafeFunction<FnArgs<(u32, u32)>>,

        /// Function to execute to retrieve the native OS window handle of the main application.
        #[napi(ts_type = "{ \
            (error: null, clientId: number, sequenceNumber: number): void; \
            (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
        }")]
        pub window_handle_query_callback: ThreadsafeFunction<FnArgs<(u32, u32)>>,

        /// Function to cancel a request. The `message` parameter is the context
        /// string that was passed on the initial request.
        #[napi(ts_type = "{ \
            (error: null, clientId: number, sequenceNumber: number, message: string): void; \
            (error: Error, clientId: number, sequenceNumber: number, message: null): void; \
        }")]
        pub cancel_request_callback: ThreadsafeFunction<FnArgs<(u32, u32, String)>>,
    }

    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    #[napi]
    impl AutofillIpcServer {
        /// Create and start the IPC server without blocking.
        ///
        /// @param name The endpoint name to listen on. This name uniquely identifies the IPC
        /// connection and must be the same for both the server and client. @param callback
        /// The functions that will be called whenever a message of the
        /// corresponding type is received from a client.
        #[allow(clippy::unused_async)] // FIXME: Remove unused async!
        #[napi(factory)]
        pub async fn listen(name: String, callbacks: AutofillIpcCallbacks) -> napi::Result<Self> {
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
                                    let params = (client_id, msg.sequence_number);
                                    callbacks.lock_status_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::NativeStatus(native_status) => {
                                    let params = (client_id, msg.sequence_number, native_status);
                                    callbacks.native_status_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::PasskeyAssertion(assertion_request) => {
                                    let params =
                                        (client_id, msg.sequence_number, assertion_request);
                                    callbacks.assertion_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::PasskeyAssertionWithoutUserInterface(
                                    silent_assertion_request,
                                ) => {
                                    let params =
                                        (client_id, msg.sequence_number, silent_assertion_request);
                                    callbacks.assertion_without_user_interface_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::PasskeyRegistration(registration_request) => {
                                    let params =
                                        (client_id, msg.sequence_number, registration_request);
                                    callbacks.registration_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
                                }
                                ExtensionRequest::WindowHandle => {
                                    let params = (client_id, msg.sequence_number);
                                    callbacks.window_handle_query_callback.call(
                                        Ok(params.into()),
                                        ThreadsafeFunctionCallMode::NonBlocking,
                                    );
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
        pub fn complete_lock_status(
            &self,
            client_id: u32,
            sequence_number: u32,
            response: LockStatusResponse,
        ) -> napi::Result<u32> {
            let message = PasskeyMessage {
                sequence_number,
                value: Ok(response),
            };
            self.send(client_id, serde_json::to_string(&message).unwrap())
        }

        #[napi]
        pub fn complete_window_handle_query(
            &self,
            client_id: u32,
            sequence_number: u32,
            response: WindowHandleQueryResponse,
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
