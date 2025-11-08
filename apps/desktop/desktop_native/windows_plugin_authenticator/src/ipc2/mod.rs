use std::{
    collections::HashMap,
    error::Error,
    fmt::Display,
    sync::{atomic::AtomicU32, Arc, Mutex, Once},
    time::Instant,
};

use futures::FutureExt;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tracing::{error, info};
use tracing_subscriber::{
    filter::{EnvFilter, LevelFilter},
    layer::SubscriberExt,
    util::SubscriberInitExt,
};

mod assertion;
mod registration;

pub use assertion::{
    PasskeyAssertionRequest, PasskeyAssertionResponse, PasskeyAssertionWithoutUserInterfaceRequest,
    PreparePasskeyAssertionCallback,
};
pub use registration::{
    PasskeyRegistrationRequest, PasskeyRegistrationResponse, PreparePasskeyRegistrationCallback,
};

use crate::util::debug_log;

static INIT: Once = Once::new();

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserVerification {
    Preferred,
    Required,
    Discouraged,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum BitwardenError {
    Internal(String),
}

impl Display for BitwardenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Internal(msg) => write!(f, "Internal error occurred: {msg}"),
        }
    }
}

impl Error for BitwardenError {}

// TODO: These have to be named differently than the actual Uniffi traits otherwise
// the generated code will lead to ambiguous trait implementations
// These are only used internally, so it doesn't matter that much
trait Callback: Send + Sync {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error>;
    fn error(&self, error: BitwardenError);
}

#[derive(Debug)]
/// Store the connection status between the Windows credential provider extension
/// and the desktop application's IPC server.
pub enum ConnectionStatus {
    Connected,
    Disconnected,
}

pub struct WindowsProviderClient {
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
/// between the application and the Windows credential provider.
pub struct NativeStatus {
    key: String,
    value: String,
}

// In our callback management, 0 is a reserved sequence number indicating that a message does not have a callback.
const NO_CALLBACK_INDICATOR: u32 = 0;

impl WindowsProviderClient {
    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    pub fn connect() -> Self {
        debug_log("YO!");
        INIT.call_once(|| {
            /*
            let filter = EnvFilter::builder()
                .with_default_directive(LevelFilter::DEBUG.into())
                .from_env_lossy();

            let log_file_path = "C:\\temp\\bitwarden_windows_passkey_provider.log";
            debug_log(&format!("Trying to set up log file at {log_file_path}"));
            // FIXME: Remove unwrap
            let file = std::fs::File::options()
                .append(true)
                .open(log_file_path)
                .unwrap();
            let log_file = tracing_subscriber::fmt::layer().with_writer(file);
            tracing_subscriber::registry()
                .with(filter)
                .with(log_file)
                .init();
            */
        });
        tracing::debug!("Windows COM server trying to connect to Electron IPC...");

        let (from_server_send, mut from_server_recv) = tokio::sync::mpsc::channel(32);
        let (to_server_send, to_server_recv) = tokio::sync::mpsc::channel(32);

        let client = WindowsProviderClient {
            to_server_send,
            response_callbacks_counter: AtomicU32::new(1), // Start at 1 since 0 is reserved for "no callback" scenarios
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

            rt.block_on(async move {
                while let Some(message) = from_server_recv.recv().await {
                    match serde_json::from_str::<SerializedMessage>(&message) {
                        Ok(SerializedMessage::Command(CommandMessage::Connected)) => {
                            info!("Connected to server");
                            connection_status.store(true, std::sync::atomic::Ordering::Relaxed);
                        }
                        Ok(SerializedMessage::Command(CommandMessage::Disconnected)) => {
                            info!("Disconnected from server");
                            connection_status.store(false, std::sync::atomic::Ordering::Relaxed);
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
        self.send_message(status, None);
    }

    pub fn prepare_passkey_registration(
        &self,
        request: PasskeyRegistrationRequest,
        callback: Arc<dyn PreparePasskeyRegistrationCallback>,
    ) {
        self.send_message(request, Some(Box::new(callback)));
    }

    pub fn prepare_passkey_assertion(
        &self,
        request: PasskeyAssertionRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(request, Some(Box::new(callback)));
    }

    pub fn prepare_passkey_assertion_without_user_interface(
        &self,
        request: PasskeyAssertionWithoutUserInterfaceRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(request, Some(Box::new(callback)));
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

#[derive(Serialize, Deserialize)]
#[serde(tag = "command", rename_all = "camelCase")]
enum CommandMessage {
    Connected,
    Disconnected,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged, rename_all = "camelCase")]
enum SerializedMessage {
    Command(CommandMessage),
    Message {
        sequence_number: u32,
        value: Result<serde_json::Value, BitwardenError>,
    },
}

impl WindowsProviderClient {
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
    fn send_message(
        &self,
        message: impl Serialize + DeserializeOwned,
        callback: Option<Box<dyn Callback>>,
    ) {
        let sequence_number = if let Some(callback) = callback {
            self.add_callback(callback)
        } else {
            NO_CALLBACK_INDICATOR
        };

        let message = serde_json::to_string(&SerializedMessage::Message {
            sequence_number,
            value: Ok(serde_json::to_value(message).unwrap()),
        })
        .expect("Can't serialize message");

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
