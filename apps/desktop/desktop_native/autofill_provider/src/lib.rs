#![allow(clippy::disallowed_macros)] // uniffi macros trip up clippy's evaluation
mod assertion;
mod lock_status;
mod registration;
mod window_handle_query;

#[cfg(target_os = "macos")]
use std::sync::Once;
use std::{
    collections::HashMap,
    error::Error,
    fmt::Display,
    path::PathBuf,
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

/// User verification preference for WebAuthn requests.
#[cfg_attr(target_os = "macos", derive(uniffi::Enum))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserVerification {
    Preferred,
    Required,
    Discouraged,
}

/// Coordinates representing a point on the screen.
#[cfg_attr(target_os = "macos", derive(uniffi::Record))]
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[cfg_attr(target_os = "macos", derive(uniffi::Error))]
#[derive(Debug, Serialize, Deserialize)]
pub enum BitwardenError {
    Internal(String),
    Disconnected,
}

impl Display for BitwardenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Internal(msg) => write!(f, "Internal error occurred: {msg}"),
            Self::Disconnected => {
                write!(f, "Client is disconnected from autofill IPC service")
            }
        }
    }
}

impl Error for BitwardenError {}

// These methods are named differently than the actual Uniffi traits (without
// the `on_` prefix) to avoid ambiguous trait implementations in the generated
// code.
trait Callback: Send + Sync {
    fn complete(&self, credential: serde_json::Value) -> Result<(), serde_json::Error>;
    fn error(&self, error: BitwardenError);
}

/// Store the connection status between the credential provider extension
/// and the desktop application's IPC server.
#[cfg_attr(target_os = "macos", derive(uniffi::Enum))]
#[derive(Debug)]
pub enum ConnectionStatus {
    Connected,
    Disconnected,
}

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
/// # Examples
///
/// ```no_run
/// use std::{sync::Arc, time::Duration};
///
/// use autofill_provider::{AutofillProviderClient, ConnectionStatus, TimedCallback};
///
/// fn establish_connection() -> Option<AutofillProviderClient> {
///     if !AutofillProviderClient::is_available() {
///         // Start application
///     }
///     let max_attempts = 20;
///     let delay = Duration::from_millis(300);
///
///     for attempt in 0..=max_attempts {
///         let client = AutofillProviderClient::connect();
///         if attempt != 0 {
///             // Use whatever sleep method is appropriate
///             std::thread::sleep(delay + Duration::from_millis(100 * attempt));
///         }
///         if let ConnectionStatus::Connected = client.get_connection_status() {
///             return Some(client);
///         }
///     };
///     None
/// }
///
/// if let Some(client) = establish_connection() {
///     // use client here
/// }
/// ```
#[cfg_attr(target_os = "macos", derive(uniffi::Object))]
pub struct AutofillProviderClient {
    to_server_send: tokio::sync::mpsc::Sender<String>,

    // We need to keep track of the callbacks so we can call them when we receive a response
    response_callbacks_counter: AtomicU32,
    #[allow(clippy::type_complexity)]
    response_callbacks_queue: Arc<Mutex<HashMap<u32, (Box<dyn Callback>, Instant)>>>,

    // Flag to track connection status - atomic for thread safety without locks
    connection_status: Arc<std::sync::atomic::AtomicBool>,
}

/// Store native desktop status information to use for IPC communication
/// between the application and the credential provider.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeStatus {
    key: String,
    value: String,
}

// In our callback management, 0 is a reserved sequence number indicating that a message does not
// have a callback.
const NO_CALLBACK_INDICATOR: u32 = 0;

#[cfg(not(test))]
static IPC_PATH: &str = "af";
#[cfg(test)]
static IPC_PATH: &str = "af-test";

// These methods are not currently needed in macOS and/or cannot be exported via FFI
impl AutofillProviderClient {
    /// Whether the client is immediately available for connection.
    pub fn is_available() -> bool {
        desktop_core::ipc::path(IPC_PATH).exists()
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

    fn connect_to_path(path: PathBuf) -> Self {
        let (from_server_send, mut from_server_recv) = tokio::sync::mpsc::channel(32);
        let (to_server_send, to_server_recv) = tokio::sync::mpsc::channel(32);

        let client = AutofillProviderClient {
            to_server_send,
            response_callbacks_counter: AtomicU32::new(1), /* Start at 1 since 0 is reserved for
                                                            * "no callback" scenarios */
            response_callbacks_queue: Arc::new(Mutex::new(HashMap::new())),
            connection_status: Arc::new(std::sync::atomic::AtomicBool::new(false)),
        };

        let queue = client.response_callbacks_queue.clone();
        let connection_status = client.connection_status.clone();

        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("Can't create runtime");

            rt.spawn(
                desktop_core::ipc::client::connect(path.clone(), from_server_send, to_server_recv)
                    .map(move |r| {
                        if let Err(err) = r {
                            tracing::error!(
                                ?path,
                                "Failed to connect to autofill IPC server: {err}"
                            );
                        }
                    }),
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
                            error!(error = %e, %message, "Error deserializing message");
                        }
                    };
                }
            });
        });

        client
    }
}

#[cfg_attr(target_os = "macos", uniffi::export)]
impl AutofillProviderClient {
    /// Asynchronously initiates a connection to the autofill service on the desktop client.
    ///
    /// See documentation at the top-level of [this struct][AutofillProviderClient] for usage
    /// information.
    #[cfg_attr(target_os = "macos", uniffi::constructor)]
    pub fn connect() -> Self {
        tracing::trace!("Autofill provider attempting to connect to Electron IPC...");
        let path = desktop_core::ipc::path(IPC_PATH);
        Self::connect_to_path(path)
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
        if let ConnectionStatus::Disconnected = self.get_connection_status() {
            if let Some(callback) = callback {
                callback.error(BitwardenError::Disconnected);
            }
            return;
        }
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
) -> Result<(), BitwardenError> {
    let value = serde_json::to_value(message).map_err(|err| {
        BitwardenError::Internal(format!("Could not represent message as JSON: {err}"))
    })?;
    let message = SerializedMessage::Message {
        sequence_number,
        value: Ok(value),
    };
    let json = serde_json::to_string(&message).map_err(|err| {
        BitwardenError::Internal(format!("Could not serialize message as JSON: {err}"))
    })?;
    // The OS calls us serially, and we only need 1-3 concurrent requests
    // (passkey request, cancellation, maybe user verification).
    // So it's safe to send on this thread since there should always be enough
    // room in the receiver buffer to send.
    tx.blocking_send(json)
        .map_err(|_| BitwardenError::Disconnected)?;
    Ok(())
}

/// Types of errors for callbacks.
#[derive(Debug)]
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
    /// # Examples
    ///
    /// ```no_run
    /// use std::{sync::Arc, time::Duration};
    ///
    /// use autofill_provider::{AutofillProviderClient, TimedCallback};
    ///
    /// let client = AutofillProviderClient::connect();
    /// let callback = Arc::new(TimedCallback::new());
    /// client.get_lock_status(callback.clone());
    /// match callback.wait_for_response(Duration::from_secs(3), None) {
    ///     Ok(Ok(response)) => Ok(response),
    ///     Ok(Err(err)) => Err(format!("GetLockStatus() call failed: {err}")),
    ///     Err(_) => Err(format!("GetLockStatus() call timed out")),
    /// }.unwrap();
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

#[cfg(test)]
mod tests {
    //! For debugging test failures, it may be useful to enable tracing to see
    //! the request flow more easily.  You can do that by adding the following
    //! line to the beginning of the `#[test]` function you're working on:
    //!
    //! ```no_run
    //! tracing_subscriber::fmt::init();
    //! ```
    //!
    //! After that, you can set `RUST_LOG=debug` and run `cargo test` to see the traces.

    use std::{
        path::PathBuf,
        sync::{atomic::AtomicU32, Arc},
        time::Duration,
    };

    use desktop_core::ipc::server::MessageType;
    use serde_json::{json, Value};
    use tokio::sync::mpsc;
    use tracing::Level;

    use crate::{
        AutofillProviderClient, BitwardenError, ConnectionStatus, LockStatusRequest,
        SerializedMessage, TimedCallback, IPC_PATH,
    };

    /// Generates a path for a server and client to connect with.
    ///
    /// [`AutofillProviderClient`] is currently hardcoded to use sockets from the filesystem.
    /// In order for paths not to conflict between tests, we use a counter and add it to the path
    /// name.
    fn get_server_path() -> PathBuf {
        static SERVER_COUNTER: AtomicU32 = AtomicU32::new(0);
        let counter = SERVER_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let name = format!("{}-{}", IPC_PATH, counter);
        desktop_core::ipc::path(&name)
    }

    /// Sets up an in-memory server based on the passed handler and returns a client to the server.
    fn get_client<
        F: Fn(Result<Value, BitwardenError>) -> Result<Value, BitwardenError> + Send + 'static,
    >(
        handler: F,
    ) -> AutofillProviderClient {
        let (signal_tx, signal_rx) = std::sync::mpsc::channel();
        let path = get_server_path();
        let server_path = path.clone();

        // Start server thread
        std::thread::spawn(move || {
            let _span = tracing::span!(Level::DEBUG, "server").entered();
            tracing::info!("Starting server thread");
            let (tx, mut rx) = mpsc::channel(8);
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_io()
                .build()
                .unwrap();
            rt.block_on(async move {
                tracing::debug!(?server_path, "Starting server");
                let server = desktop_core::ipc::server::Server::start(&server_path, tx).unwrap();

                // Signal to main thread that the server is ready to process messages.
                tracing::debug!("Server started");
                signal_tx.send(()).unwrap();

                // Handle incoming messages
                tracing::debug!("Waiting for messages");
                while let Some(data) = rx.recv().await {
                    tracing::debug!("Received {data:?}");
                    match data.kind {
                        MessageType::Connected => {}
                        MessageType::Disconnected => {}
                        MessageType::Message => {
                            // Deserialize and handle messages using the given handler function.
                            let msg: SerializedMessage =
                                serde_json::from_str(&data.message.unwrap()).unwrap();

                            if let SerializedMessage::Message {
                                sequence_number,
                                value,
                            } = msg
                            {
                                let response = serde_json::to_string(&SerializedMessage::Message {
                                    sequence_number,
                                    value: handler(value),
                                })
                                .unwrap();
                                server.send(response).unwrap();
                            }
                        }
                    }
                }
            });
        });

        // Wait for server to startup and client to connect to server before returning client to
        // test method.
        let _span = tracing::span!(Level::DEBUG, "client");
        tracing::debug!("Waiting for server...");
        signal_rx.recv_timeout(Duration::from_millis(1000)).unwrap();

        // This starts a background task to connect to the server.
        tracing::debug!("Starting client...");
        let client = AutofillProviderClient::connect_to_path(path.to_path_buf());

        // The client connects to the server asynchronously in a background
        // thread, so wait for client to report itself as Connected so that test
        // methods don't have to do this everytime.
        // Note, this has the potential to be flaky on a very busy server, but that's unavoidable
        // with the current API.
        tracing::debug!("Client connecting...");
        for _ in 0..20 {
            if let ConnectionStatus::Connected = client.get_connection_status() {
                break;
            }
            std::thread::sleep(Duration::from_millis(10));
        }

        assert!(matches!(
            client.get_connection_status(),
            ConnectionStatus::Connected
        ));

        client
    }

    #[test]
    fn test_client_throws_error_on_method_call_when_disconnected() {
        // There is no server running at this path, so this client should always be disconnected.
        let client = AutofillProviderClient::connect_to_path(get_server_path());

        // use an arbitrary request to test whether the client is disconnected.
        let callback = Arc::new(TimedCallback::new());
        client.get_lock_status(callback.clone());
        let response = callback
            .wait_for_response(Duration::from_millis(10), None)
            .unwrap();

        assert!(matches!(response, Err(BitwardenError::Disconnected)));
    }

    #[test]
    fn test_client_parses_get_lock_status_response_when_valid_json_is_returned() {
        // The server should expect a lock status request and return a valid response.
        let handler = |value: Result<Value, BitwardenError>| {
            let value = value.unwrap();
            if let Ok(LockStatusRequest {}) = serde_json::from_value(value.clone()) {
                Ok(json!({"isUnlocked": true}))
            } else {
                Err(BitwardenError::Internal(format!(
                    "Expected LockStatusRequest, received: {value:?}"
                )))
            }
        };

        // send a lock status request
        let client = get_client(handler);
        let callback = Arc::new(TimedCallback::new());
        client.get_lock_status(callback.clone());
        let response = callback
            .wait_for_response(Duration::from_millis(3000), None)
            .unwrap()
            .unwrap();

        assert!(response.is_unlocked);
    }
}
