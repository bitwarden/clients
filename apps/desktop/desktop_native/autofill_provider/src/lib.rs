#![allow(clippy::disallowed_macros)] // uniffi macros trip up clippy's evaluation
mod assertion;
mod lock_status;
mod registration;
mod util;
mod window_handle_query;

#[cfg(target_os = "macos")]
use std::sync::Once;
use std::{
    collections::HashMap,
    error::Error,
    fmt::Display,
    sync::{
        atomic::AtomicU32,
        mpsc::{self, Receiver, RecvTimeoutError, Sender},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};

pub use assertion::{
    PasskeyAssertionRequest, PasskeyAssertionResponse, PasskeyAssertionWithoutUserInterfaceRequest,
    PreparePasskeyAssertionCallback,
};
use futures::FutureExt;
pub use lock_status::LockStatusResponse;
pub use registration::{
    PasskeyRegistrationRequest, PasskeyRegistrationResponse, PreparePasskeyRegistrationCallback,
};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tracing::{error, info};
#[cfg(target_os = "macos")]
use tracing_subscriber::{
    filter::{EnvFilter, LevelFilter},
    layer::SubscriberExt,
    util::SubscriberInitExt,
};
pub use window_handle_query::WindowHandleQueryResponse;

use crate::{
    lock_status::{GetLockStatusCallback, LockStatusRequest},
    window_handle_query::{GetWindowHandleQueryCallback, WindowHandleQueryRequest},
};

#[cfg(target_os = "macos")]
uniffi::setup_scaffolding!();

#[cfg(target_os = "macos")]
static INIT: Once = Once::new();

#[cfg_attr(target_os = "macos", derive(uniffi::Enum))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// User verification preference for WebAuthn requests.
pub enum UserVerification {
    Preferred,
    Required,
    Discouraged,
}

#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
/// Coordinates representing a point on the screen.
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[cfg_attr(target_os = "macos", derive(uniffi::Error))]
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

#[cfg_attr(target_os = "macos", derive(uniffi::Enum))]
#[derive(Debug)]
/// Store the connection status between the credential provider extension
/// and the desktop application's IPC server.
pub enum ConnectionStatus {
    Connected,
    Disconnected,
}

#[cfg_attr(target_os = "macos", derive(uniffi::Object))]
/// A client to send and receive messages to the autofill service on the desktop
/// client.
///
/// # Usage
///
/// In order to accommodate desktop app startup delays and non-blocking
/// requirements for native providers, this initialization of the client is
/// non-blocking. When calling [`AutofillProviderClient::connect()`], the
/// connection is not established immediately, but may be established later in
/// the background or may fail to be established.
///
/// Before calling [`AutofillProviderClient::connect()`], first check whether
/// the desktop app is running with [`AutofillProviderClient::is_available`],
/// and attempt to start it if it is not running. Then, attempt to connect, retrying as necessary.
/// Before calling any other methods, check the connection status using
/// [`AutofillProviderClient::get_connection_status()`].
///
/// # Example
///
/// ```no_run
/// fn establish_connection() -> Option<Client> {
///     if !AutofillProviderClient::is_available() {
///         // Start application
///     }
///     let max_attempts = 20;
///     let delay_ms = Duration::from_millis(300);
///
///     for attempt in 0..=max_attempts {
///         let client = AutofillProviderClient::connect();
///         if attempt != 0 {
///             // Use whatever sleep method is appropriate
///             std::thread::sleep(delay + 100 * attempt);
///         }
///         if let ConnectionStatus::Connected = client.get_connection_status() {
///             return client;
///         }
///     };
/// }
///
/// if let Some(client) = establish_connection() {
///     // use client here
/// }
/// ```
pub struct AutofillProviderClient {
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
/// between the application and the credential provider.
pub struct NativeStatus {
    key: String,
    value: String,
}

// In our callback management, 0 is a reserved sequence number indicating that a message does not
// have a callback.
const NO_CALLBACK_INDICATOR: u32 = 0;

// These methods are not currently needed in macOS and/or cannot be exported via FFI
impl AutofillProviderClient {
    /// Whether the client is immediately available for connection.
    pub fn is_available() -> bool {
        desktop_core::ipc::path("af").exists()
    }

    /// Request the desktop client's lock status.
    pub fn get_lock_status(&self, callback: Arc<dyn GetLockStatusCallback>) {
        self.send_message(LockStatusRequest {}, Some(Box::new(callback)));
    }

    /// Requests details about the desktop client's native window.
    pub fn get_window_handle(&self, callback: Arc<dyn GetWindowHandleQueryCallback>) {
        self.send_message(
            WindowHandleQueryRequest::default(),
            Some(Box::new(callback)),
        );
    }
}

#[cfg_attr(target_os = "macos", uniffi::export)]
impl AutofillProviderClient {
    #[cfg_attr(target_os = "macos", uniffi::constructor)]
    /// Asynchronously initiates a connection to the autofill service on the desktop client.
    ///
    /// See documentation at the top-level of [this struct][AutofillProviderClient] for usage information.
    pub fn connect() -> Self {
        tracing::trace!("Autofill provider attempting to connect to Electron IPC...");

        let (from_server_send, mut from_server_recv) = tokio::sync::mpsc::channel(32);
        let (to_server_send, to_server_recv) = tokio::sync::mpsc::channel(32);

        let client = AutofillProviderClient {
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
                        }) => match queue.lock().expect("not poisoned").remove(&sequence_number) {
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
                                        cb.error(e);
                                    }
                                }
                            }
                            None => {
                                error!(sequence_number, "No callback found for sequence number");
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

    /// Send a one-way key-value message to the desktop client.
    pub fn send_native_status(&self, key: String, value: String) {
        let status = NativeStatus { key, value };
        self.send_message(status, None);
    }

    /// Send a request to create a new passkey to the desktop client.
    pub fn prepare_passkey_registration(
        &self,
        request: PasskeyRegistrationRequest,
        callback: Arc<dyn PreparePasskeyRegistrationCallback>,
    ) {
        self.send_message(request, Some(Box::new(callback)));
    }

    /// Send a request to assert a passkey to the desktop client.
    pub fn prepare_passkey_assertion(
        &self,
        request: PasskeyAssertionRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(request, Some(Box::new(callback)));
    }

    /// Send a request to assert a passkey, without prompting the user, to the desktop client.
    pub fn prepare_passkey_assertion_without_user_interface(
        &self,
        request: PasskeyAssertionWithoutUserInterfaceRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(request, Some(Box::new(callback)));
    }

    /// Return the status this client's connection to the desktop client.
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

#[cfg(target_os = "macos")]
#[uniffi::export]
pub fn initialize_logging() {
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

impl AutofillProviderClient {
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

        if let Err(e) = send_message_helper(sequence_number, message, &self.to_server_send) {
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

// Wrapped in Result<> to allow using ? for clarity.
fn send_message_helper(
    sequence_number: u32,
    message: impl Serialize + DeserializeOwned,
    tx: &tokio::sync::mpsc::Sender<String>,
) -> Result<(), String> {
    let value = serde_json::to_value(message)
        .map_err(|err| format!("Could not represent message as JSON: {err}"))?;
    let message = SerializedMessage::Message {
        sequence_number,
        value: Ok(value),
    };
    let json = serde_json::to_string(&message)
        .map_err(|err| format!("Could not serialize message as JSON: {err}"))?;
    tx.blocking_send(json)
        .map_err(|err| format!("Error sending message: {err}"))?;
    Ok(())
}

#[derive(Debug)]
/// Types of errors for callbacks.
pub enum CallbackError {
    Timeout,
    Cancelled,
}

impl Display for CallbackError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Timeout => f.write_str("Callback timed out"),
            Self::Cancelled => f.write_str("Callback cancelled"),
        }
    }
}
impl std::error::Error for CallbackError {}

type CallbackResponse<T> = Result<T, BitwardenError>;

/// An implementation of a callback handler that can take a deadline.
pub struct TimedCallback<T> {
    tx: Arc<Mutex<Option<Sender<CallbackResponse<T>>>>>,
    rx: Arc<Mutex<Receiver<CallbackResponse<T>>>>,
}

impl<T: Send + 'static> Default for TimedCallback<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Send + 'static> TimedCallback<T> {
    /// Instantiates a new callback handler.
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        Self {
            tx: Arc::new(Mutex::new(Some(tx))),
            rx: Arc::new(Mutex::new(rx)),
        }
    }

    /// Block the current thread until either a response is received, or the
    /// specified timeout has passed.
    ///
    /// # Usage
    /// ```
    /// let callback = Arc::new(TimedCallback::new());
    /// client.get_lock_status(callback.clone());
    /// match callback.wait_for_response(Duration::from_secs(3), None) {
    ///     Ok(Ok(response)) => Ok(response),
    ///     Ok(Err(err)) => Err(format!("GetLockStatus() call failed: {err}").into()),
    ///     Err(_) => Err(format!("GetLockStatus() call timed out").into()),
    /// }
    /// ```
    pub fn wait_for_response(
        &self,
        timeout: Duration,
        cancellation_token: Option<Receiver<()>>,
    ) -> Result<Result<T, BitwardenError>, CallbackError> {
        let (tx, rx) = mpsc::channel();
        if let Some(cancellation_token) = cancellation_token {
            let tx2 = tx.clone();
            let cancellation_token = Mutex::new(cancellation_token);
            std::thread::spawn(move || {
                if let Ok(()) = cancellation_token
                    .lock()
                    .expect("not poisoned")
                    .recv_timeout(timeout)
                {
                    tracing::debug!("Forwarding cancellation");
                    _ = tx2.send(Err(CallbackError::Cancelled));
                }
            });
        }
        let response_rx = self.rx.clone();
        std::thread::spawn(move || {
            if let Ok(response) = response_rx
                .lock()
                .expect("not poisoned")
                .recv_timeout(timeout)
            {
                _ = tx.send(Ok(response));
            }
        });
        match rx.recv_timeout(timeout) {
            Ok(Ok(response)) => Ok(response),
            Ok(err @ Err(CallbackError::Cancelled)) => {
                tracing::debug!("Received cancellation, dropping.");
                err
            }
            Ok(err @ Err(CallbackError::Timeout)) => {
                tracing::warn!("Request timed out, dropping.");
                err
            }
            Err(RecvTimeoutError::Timeout) => Err(CallbackError::Timeout),
            Err(_) => Err(CallbackError::Cancelled),
        }
    }

    fn send(&self, response: Result<T, BitwardenError>) {
        match self.tx.lock().expect("not poisoned").take() {
            Some(tx) => {
                if tx.send(response).is_err() {
                    tracing::error!("Windows provider channel closed before receiving IPC response from Electron");
                }
            }
            None => {
                tracing::error!("Callback channel used before response: multi-threading issue?");
            }
        }
    }
}

impl PreparePasskeyRegistrationCallback for TimedCallback<PasskeyRegistrationResponse> {
    fn on_complete(&self, credential: PasskeyRegistrationResponse) {
        self.send(Ok(credential));
    }

    fn on_error(&self, error: BitwardenError) {
        self.send(Err(error));
    }
}
    }
}
