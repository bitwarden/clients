#![cfg(target_os = "macos")]
#![allow(clippy::disallowed_macros)] // uniffi macros trip up clippy's evaluation

use std::{
    collections::HashMap,
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

uniffi::setup_scaffolding!();

mod assertion;
mod registration;

use assertion::{
    PasskeyAssertionRequest, PasskeyAssertionWithoutUserInterfaceRequest,
    PreparePasskeyAssertionCallback,
};
use registration::{PasskeyRegistrationRequest, PreparePasskeyRegistrationCallback};

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

#[derive(uniffi::Object)]
pub struct MacOSProviderClient {
    to_server_send: tokio::sync::mpsc::Sender<String>,

    // We need to keep track of the callbacks so we can call them when we receive a response
    response_callbacks_counter: AtomicU32,
    #[allow(clippy::type_complexity)]
    response_callbacks_queue: Arc<Mutex<HashMap<u32, (Box<dyn Callback>, Instant)>>>,
}

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

        let client = MacOSProviderClient {
            to_server_send,
            response_callbacks_counter: AtomicU32::new(0),
            response_callbacks_queue: Arc::new(Mutex::new(HashMap::new())),
        };

        let path = desktop_core::ipc::path("af");

        let queue = client.response_callbacks_queue.clone();

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
                        }
                        Ok(SerializedMessage::Command(CommandMessage::Disconnected)) => {
                            info!("Disconnected from server");
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

    pub fn prepare_passkey_registration(
        &self,
        request: PasskeyRegistrationRequest,
        callback: Arc<dyn PreparePasskeyRegistrationCallback>,
    ) {
        self.send_message(request, Box::new(callback));
    }

    pub fn prepare_passkey_assertion(
        &self,
        request: PasskeyAssertionRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(request, Box::new(callback));
    }

    pub fn prepare_passkey_assertion_without_user_interface(
        &self,
        request: PasskeyAssertionWithoutUserInterfaceRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.send_message(request, Box::new(callback));
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

impl MacOSProviderClient {
    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    fn add_callback(&self, callback: Box<dyn Callback>) -> u32 {
        let sequence_number = self
            .response_callbacks_counter
            .fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        self.response_callbacks_queue
            .lock()
            .unwrap()
            .insert(sequence_number, (callback, Instant::now()));

        sequence_number
    }

    // FIXME: Remove unwraps! They panic and terminate the whole application.
    #[allow(clippy::unwrap_used)]
    fn send_message(
        &self,
        message: impl Serialize + DeserializeOwned,
        callback: Box<dyn Callback>,
    ) {
        let sequence_number = self.add_callback(callback);

        let message = serde_json::to_string(&SerializedMessage::Message {
            sequence_number,
            value: Ok(serde_json::to_value(message).unwrap()),
        })
        .expect("Can't serialize message");

        if let Err(e) = self.to_server_send.blocking_send(message) {
            // Make sure we remove the callback from the queue if we can't send the message
            if let Some((cb, _)) = self
                .response_callbacks_queue
                .lock()
                .unwrap()
                .remove(&sequence_number)
            {
                cb.error(BitwardenError::Internal(format!(
                    "Error sending message: {e}"
                )));
            }
        }
    }
}
