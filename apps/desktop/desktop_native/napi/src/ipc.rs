#[napi]
pub mod ipc {
    use desktop_core::ipc::server::{Message, MessageType};
    use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};

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
    pub struct NativeIpcServer {
        server: desktop_core::ipc::server::Server,
    }

    #[napi]
    impl NativeIpcServer {
        /// Create and start the IPC server without blocking.
        ///
        /// @param name The endpoint name to listen on. This name uniquely identifies the IPC
        /// connection and must be the same for both the server and client. @param callback
        /// This function will be called whenever a message is received from a client.
        #[allow(clippy::unused_async)] // FIXME: Remove unused async!
        #[napi(factory)]
        pub async fn listen(
            name: String,
            #[napi(ts_arg_type = "(error: null | Error, message: IpcMessage) => void")]
            callback: ThreadsafeFunction<IpcMessage>,
        ) -> napi::Result<Self> {
            let (send, mut recv) = tokio::sync::mpsc::channel::<Message>(32);
            tokio::spawn(async move {
                while let Some(message) = recv.recv().await {
                    callback.call(Ok(message.into()), ThreadsafeFunctionCallMode::NonBlocking);
                }
            });

            let paths = desktop_core::ipc::all_paths(&name);

            let server =
                desktop_core::ipc::server::Server::start(paths.clone(), send).map_err(|e| {
                    napi::Error::from_reason(format!(
                        "Error listening to server - Path: {paths:?} - Error: {e:?}"
                    ))
                })?;

            Ok(NativeIpcServer { server })
        }

        /// Return the paths to the IPC server.
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

        /// Send a message over the IPC server to all the connected clients
        ///
        /// @return The number of clients that the message was sent to. Note that the number of
        /// messages actually received may be less, as some clients could disconnect before
        /// receiving the message.
        #[napi]
        pub fn send(&self, message: String) -> napi::Result<u32> {
            self.server
                .send(message)
                .map_err(|e| napi::Error::from_reason(format!("Error sending message: {e:?}")))
                // NAPI doesn't support u64 or usize, so we need to convert to u32
                .map(|u| u32::try_from(u).unwrap_or_default())
        }
    }
}
