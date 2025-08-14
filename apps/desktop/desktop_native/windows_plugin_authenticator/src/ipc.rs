use std::sync::Mutex;
use tokio::sync::{mpsc, oneshot};

use crate::types::*;
use crate::util::debug_log;

/// Global channel sender for request notifications
static REQUEST_SENDER: Mutex<Option<mpsc::UnboundedSender<RequestEvent>>> = Mutex::new(None);

/// Sets the channel sender for request notifications
pub fn set_request_sender(sender: mpsc::UnboundedSender<RequestEvent>) {
    match REQUEST_SENDER.lock() {
        Ok(mut tx) => {
            *tx = Some(sender);
            debug_log("Passkey request callback registered");
        }
        Err(e) => {
            debug_log(&format!("Failed to register passkey callback: {:?}", e));
        }
    }
}

/// Sends a passkey request and waits for response
pub fn send_passkey_request(
    request_type: RequestType,
    request_json: String,
    rpid: &str,
) -> Option<PasskeyResponse> {
    let request_desc = match &request_type {
        RequestType::Assertion => format!("assertion request for {}", rpid),
        RequestType::Registration => format!("registration request for {}", rpid),
        RequestType::Sync => format!("sync request for {}", rpid),
    };

    debug_log(&format!("Passkey {}", request_desc));

    if let Ok(tx_guard) = REQUEST_SENDER.lock() {
        if let Some(sender) = tx_guard.as_ref() {
            let (response_tx, response_rx) = oneshot::channel();
            let event = RequestEvent {
                request_type,
                request_json,
                response_sender: response_tx,
            };

            if let Ok(()) = sender.send(event) {
                // Wait for response from TypeScript callback
                match response_rx.blocking_recv() {
                    Ok(response) => {
                        debug_log(&format!("Received callback response {:?}", response));
                        Some(response)
                    }
                    Err(_) => {
                        debug_log("No response from callback");
                        None
                    }
                }
            } else {
                debug_log("Failed to send event to callback");
                None
            }
        } else {
            debug_log("No callback registered for passkey requests");
            None
        }
    } else {
        None
    }
}
