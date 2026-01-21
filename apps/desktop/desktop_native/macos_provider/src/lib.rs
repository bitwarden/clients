#![cfg(target_os = "macos")]
#![allow(clippy::disallowed_macros)] // uniffi macros trip up clippy's evaluation

use std::{
    collections::HashMap,
    sync::{atomic::AtomicU32, Arc, Mutex, Once},
    time::Instant,
};

use futures::FutureExt;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc::Sender;
use tracing::{error, info};
use tracing_subscriber::{
    filter::{EnvFilter, LevelFilter},
    layer::SubscriberExt,
    util::SubscriberInitExt,
};

uniffi::setup_scaffolding!();

mod assertion;
mod registration;
mod user_verification;

use assertion::{
    PasskeyAssertionRequest, PasskeyAssertionWithoutUserInterfaceRequest,
    PreparePasskeyAssertionCallback,
};
use registration::{PasskeyRegistrationRequest, PreparePasskeyRegistrationCallback};

use crate::user_verification::{UserVerificationRequest, UserVerificationResponse};

static INIT: Once = Once::new();

#[derive(uniffi::Enum, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserVerification {
    Preferred,
    Required,
    Discouraged,
}

#[derive(uniffi::Record, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, uniffi::Error, Serialize, Deserialize)]
pub enum BitwardenError {
    Internal(String),
}

// TODO: These have to be named differently than the actual Uniffi traits otherwise
// the generated code will lead to ambiguous trait implementations
// These are only used internally, so it doesn't matter that much
trait Callback: Send + Sync {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error>;
    fn error(&self, error: BitwardenError);
}

#[derive(uniffi::Enum, Debug)]
/// Store the connection status between the macOS credential provider extension
/// and the desktop application's IPC server.
pub enum ConnectionStatus {
    Connected,
    Disconnected,
}

#[derive(uniffi::Object)]
pub struct MacOSProviderClient {
    to_server_send: tokio::sync::mpsc::Sender<String>,

    // We need to keep track of the callbacks so we can call them when we receive a response
    response_callbacks_counter: AtomicU32,
    #[allow(clippy::type_complexity)]
    response_callbacks_queue: Arc<Mutex<HashMap<u32, (Box<dyn Callback>, Instant)>>>,

    // Flag to track connection status - atomic for thread safety without locks
    connection_status: Arc<std::sync::atomic::AtomicBool>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Store native desktop status information to use for IPC communication
/// between the application and the macOS credential provider.
pub struct NativeStatus {
    key: String,
    value: String,
}

// In our callback management, 0 is a reserved sequence number indicating that a message does not
// have a callback.
const NO_CALLBACK_INDICATOR: u32 = 0;

#[uniffi::export]
impl MacOSProviderClient {
    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    #[uniffi::constructor]
    pub fn connect() -> Self {
        INIT.call_once(|| {
            let filter = EnvFilter::builder()
                // Everything logs at `INFO`
                .with_default_directive(LevelFilter::INFO.into())
                .from_env_lossy();

            tracing_subscriber::registry()
                .with(filter)
                .with(tracing_oslog::OsLogger::new(
                    "com.bitwarden.desktop.autofill-extension",
                    "default",
                ))
                .init();
        });

        let (from_server_send, mut from_server_recv) = tokio::sync::mpsc::channel(32);
        let (to_server_send, to_server_recv) = tokio::sync::mpsc::channel(32);
        let (host_request_handler_tx, mut host_request_handler_rx) = tokio::sync::mpsc::channel(32);
        let to_server_send2 = to_server_send.clone();

        let client = MacOSProviderClient {
            to_server_send,
            response_callbacks_counter: AtomicU32::new(1), /* Start at 1 since 0 is reserved for
                                                            * "no callback" scenarios */
            response_callbacks_queue: Arc::new(Mutex::new(HashMap::new())),
            connection_status: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        };

        let path = desktop_core::ipc::path("af");

        let queue = client.response_callbacks_queue.clone();
        let connection_status = client.connection_status.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Can't create runtime");

            rt.spawn(
                desktop_core::ipc::client::connect(path, from_server_send, to_server_recv)
                    .map(|r| r.map_err(|e| e.to_string())),
            );

            rt.spawn(async move {
                while let Some(message) = host_request_handler_rx.recv().await {
                    handle_host_request(&to_server_send2, message).await;
                }
            });

            rt.block_on(async move {
                while let Some(message) = from_server_recv.recv().await {
                    tracing::debug!(?message, "Received message");
                    match serde_json::from_str::<SerializedMessage>(&message) {
                        Ok(SerializedMessage::Command(CommandMessage::Connected)) => {
                            info!("Connected to server");
                            connection_status.store(true, std::sync::atomic::Ordering::Relaxed);
                        }
                        Ok(SerializedMessage::Command(CommandMessage::Disconnected)) => {
                            info!("Disconnected from server");
                            connection_status.store(false, std::sync::atomic::Ordering::Relaxed);
                        }
                        Ok(SerializedMessage::HostRequest(message)) => {
                            let sequence_number = message.sequence_number;
                            tracing::debug!(%sequence_number, "Received request");
                            if let Err(err) = host_request_handler_tx.send(message).await {
                                tracing::error!(
                                    "Failed to pass message to host request handler: {err}"
                                );
                            }
                        }
                        Ok(SerializedMessage::Message {
                            sequence_number,
                            value,
                        }) => match queue.lock().unwrap().remove(&sequence_number) {
                            Some((cb, request_start_time)) => {
                                info!(
                                    "Time to process request: {:?}",
                                    request_start_time.elapsed()
                                );
                                match value {
                                    Ok(value) => {
                                        if let Err(e) = cb.complete(value) {
                                            error!(error = %e, "Error deserializing message");
                                        }
                                    }
                                    Err(e) => {
                                        error!(error = ?e, "Error processing message");
                                        cb.error(e)
                                    }
                                }
                            }
                            None => {
                                error!(sequence_number, "No callback found for sequence number")
                            }
                        },
                        Err(e) => {
                            error!(error = %e, "Error deserializing message");
                        }
                    };
                }
            });
        });

        client
    }

    pub fn send_native_status(&self, key: String, value: String) {
        let status = NativeStatus { key, value };
        self.send_message(ExtensionRequest::NativeStatus(status), None);
    }

    pub fn prepare_passkey_registration(
        &self,
        request: PasskeyRegistrationRequest,
        callback: Arc<dyn PreparePasskeyRegistrationCallback>,
    ) {
        self.send_message(
            ExtensionRequest::PasskeyRegistration(request),
            Some(Box::new(callback)),
        );
    }

    pub fn prepare_passkey_assertion(
        &self,
        request: PasskeyAssertionRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(
            ExtensionRequest::PasskeyAssertion(request),
            Some(Box::new(callback)),
        );
    }

    pub fn prepare_passkey_assertion_without_user_interface(
        &self,
        request: PasskeyAssertionWithoutUserInterfaceRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(
            ExtensionRequest::PasskeyAssertionWithoutUserInterface(request),
            Some(Box::new(callback)),
        );
    }

    pub fn get_connection_status(&self) -> ConnectionStatus {
        let is_connected = self
            .connection_status
            .load(std::sync::atomic::Ordering::Relaxed);
        if is_connected {
            ConnectionStatus::Connected
        } else {
            ConnectionStatus::Disconnected
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "command", content = "params", rename_all = "camelCase")]
enum CommandMessage {
    Connected,
    Disconnected,
}

/// Requests from the extension to the host.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExtensionRequestMessage {
    sequence_number: u32,
    #[serde(flatten)]
    value: ExtensionRequest,
}

/// Requests from the extension to the host.
#[derive(Serialize)]
#[serde(tag = "request", content = "params", rename_all = "camelCase")]
enum ExtensionRequest {
    NativeStatus(NativeStatus),
    PasskeyAssertion(PasskeyAssertionRequest),
    PasskeyAssertionWithoutUserInterface(PasskeyAssertionWithoutUserInterfaceRequest),
    PasskeyRegistration(PasskeyRegistrationRequest),
}

/// Requests from the host to the provider.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostRequestMessage {
    sequence_number: u32,
    #[serde(flatten)]
    request: HostRequest,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "request", content = "params", rename_all = "camelCase")]
enum HostRequest {
    UserVerification(UserVerificationRequest),
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HostResponseMessage {
    sequence_number: u32,
    #[serde(flatten)]
    response: Result<HostResponse, String>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "response", content = "value", rename_all = "camelCase")]
enum HostResponse {
    UserVerification(UserVerificationResponse),
}

#[derive(Serialize, Deserialize)]
#[serde(untagged, rename_all = "camelCase")]
enum SerializedMessage {
    Command(CommandMessage),
    HostRequest(HostRequestMessage),
    #[serde(rename_all = "camelCase")]
    Message {
        sequence_number: u32,
        value: Result<serde_json::Value, BitwardenError>,
    },
}

impl MacOSProviderClient {
    #[allow(clippy::unwrap_used)]
    fn add_callback(&self, callback: Box<dyn Callback>) -> u32 {
        let sequence_number = self
            .response_callbacks_counter
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        self.response_callbacks_queue
            .lock()
            .expect("response callbacks queue mutex should not be poisoned")
            .insert(sequence_number, (callback, Instant::now()));

        sequence_number
    }

    #[allow(clippy::unwrap_used)]
    fn send_message(&self, message: ExtensionRequest, callback: Option<Box<dyn Callback>>) {
        let sequence_number = if let Some(callback) = callback {
            self.add_callback(callback)
        } else {
            NO_CALLBACK_INDICATOR
        };

        let message = serde_json::to_string(&ExtensionRequestMessage {
            sequence_number,
            value: message,
        })
        .expect("Can't serialize message");
        tracing::debug!(%message, "Sending message to host");

        if let Err(e) = self.to_server_send.blocking_send(message) {
            // Make sure we remove the callback from the queue if we can't send the message
            if sequence_number != NO_CALLBACK_INDICATOR {
                if let Some((callback, _)) = self
                    .response_callbacks_queue
                    .lock()
                    .expect("response callbacks queue mutex should not be poisoned")
                    .remove(&sequence_number)
                {
                    callback.error(BitwardenError::Internal(format!(
                        "Error sending message: {e}"
                    )));
                }
            }
        }
    }
}

/// Handles requests from the host to the provider.
async fn handle_host_request(to_server_send: &Sender<String>, message: HostRequestMessage) {
    let sequence_number = message.sequence_number;
    let response = match message.request {
        uv_request @ HostRequest::UserVerification { .. } => {
            tracing::debug!("Received UV request: {uv_request:?}");
            Ok(HostResponse::UserVerification(UserVerificationResponse {
                user_verified: true,
            }))
        }
    };
    let message = serde_json::to_string(&HostResponseMessage {
        sequence_number,
        response,
    })
    .expect("Can't serialize message");

    if let Err(e) = to_server_send.send(message).await {
        error!(%sequence_number, "Could not send response back to host: {e}");
    }
}

#[cfg(test)]
mod tests {
    use serde_json::Value;

    use crate::{
        assertion::PasskeyAssertionRequest,
        registration::PasskeyRegistrationRequest,
        user_verification::{UserVerificationRequest, UserVerificationResponse},
        ExtensionRequest, ExtensionRequestMessage, HostRequest, HostResponse, HostResponseMessage,
        Position,
    };

    use super::{HostRequestMessage, SerializedMessage};

    #[test]
    fn test_deserialize_host_request() {
        let json = r#"{
            "sequenceNumber": 1,
            "request": "userVerification",
            "params": {
                "transactionId": 0,
                "displayHint": "Verify it's you to overwrite a credential",
                "username": "bw-ii-plugin1"
            }
        }"#;
        let value = serde_json::from_str::<serde_json::Value>(&json).unwrap();
        let message = serde_json::from_value::<SerializedMessage>(value).unwrap();
        assert!(matches!(
            message,
            SerializedMessage::HostRequest(HostRequestMessage {
                sequence_number: 1,
                request: HostRequest::UserVerification(UserVerificationRequest {
                    transaction_id: 0,
                    ..
                }),
            }),
        ));
    }

    #[test]
    fn test_serialize_host_response() {
        let message = HostResponseMessage {
            sequence_number: 7,
            response: Ok(HostResponse::UserVerification(UserVerificationResponse {
                user_verified: true,
            })),
        };
        let json = serde_json::to_string(&message).unwrap();
        let value: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["sequenceNumber"], 7);
        assert_eq!(value["Ok"]["response"], "userVerification");
        assert_eq!(value["Ok"]["value"]["userVerified"], true);
    }

    #[test]
    fn test_serialize_extension_request() {
        let message = ExtensionRequestMessage {
            sequence_number: 42,
            value: ExtensionRequest::PasskeyAssertion(PasskeyAssertionRequest {
                rp_id: "example.com".to_string(),
                client_data_hash: vec![1; 32],
                user_verification: crate::UserVerification::Preferred,
                allowed_credentials: vec![vec![4; 8]],
                window_xy: Position { x: 100, y: 200 },
            }),
        };
        let json = serde_json::to_string(&message).unwrap();
        let value: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(value["sequenceNumber"], 42);
        assert_eq!(value["request"], "passkeyAssertion");
        let request: PasskeyAssertionRequest =
            serde_json::from_value(value.as_object().unwrap().get("params").unwrap().clone())
                .unwrap();
        assert_eq!(request.rp_id, "example.com");
    }

    #[test]
    fn test_deserialize_extension_response() {
        let json = r#"{
            "sequenceNumber": 1,
            "value": {
                "Ok": {
                    "rpId": "webauthn.io",
                    "clientDataHash": [156, 40, 76, 228, 28, 215, 79, 194, 237, 160, 250, 176, 57, 185, 247, 83, 247, 175, 218, 126, 161, 115, 202, 31, 71, 77, 49, 113, 197, 203, 88, 90],
                    "credentialId": [68, 161, 162, 129, 42, 70, 71, 239, 163, 98, 224, 14, 37, 190, 19, 70],
                    "attestationObject": [163, 99, 102, 109, 116, 100, 110, 111, 110, 101, 103, 97, 116, 116, 83, 116, 109, 116, 160, 104, 97, 117, 116, 104, 68, 97, 116, 97, 88, 148, 116, 166, 234, 146, 19, 201, 156, 47, 116, 178, 36, 146, 179, 32, 207, 64, 38, 42, 148, 193, 169, 80, 160, 57, 127, 41, 37, 11, 96, 132, 30, 240, 93, 0, 0, 0, 0, 213, 72, 130, 110, 121, 180, 219, 64, 163, 216, 17, 17, 111, 126, 131, 73, 0, 16, 68, 161, 162, 129, 42, 70, 71, 239, 163, 98, 224, 14, 37, 190, 19, 70, 165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 204, 69, 19, 156, 78, 44, 190, 84, 242, 39, 36, 208, 150, 253, 237, 217, 249, 181, 225, 233, 218, 51, 252, 30, 63, 228, 232, 116, 70, 69, 107, 137, 34, 88, 32, 102, 120, 26, 113, 188, 129, 247, 29, 166, 195, 112, 151, 177, 248, 83, 120, 132, 188, 128, 160, 113, 89, 2, 141, 8, 190, 110, 6, 220, 5, 181, 96]
                }
            }
        }"#;
        let message = serde_json::from_str::<SerializedMessage>(&json).unwrap();
        if let SerializedMessage::Message {
            sequence_number: 1,
            value: Ok(value),
        } = message
        {
            assert_eq!(value["rpId"], "webauthn.io");
        } else {
            panic!("Does not match");
        }
    }
}
