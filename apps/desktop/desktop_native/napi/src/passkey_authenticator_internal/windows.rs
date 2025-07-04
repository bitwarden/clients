use anyhow::{anyhow, Result};
use napi::{bindgen_prelude::Promise, threadsafe_function::{
    ErrorStrategy::CalleeHandled, ThreadsafeFunction, ThreadsafeFunctionCallMode,
}, JsObject};
use tokio::sync::mpsc;
use serde_json;
use windows_plugin_authenticator::util;

// Simple wrapper for passing JSON strings to TypeScript
#[napi(object)]
#[derive(Debug)]
pub struct PasskeyRequestEvent {
    pub request_type: String,
    pub request_json: String,
}

pub fn register() -> Result<()> {
    windows_plugin_authenticator::register().map_err(|e| anyhow!(e))?;

    Ok(())
}

pub async fn on_request(
    callback: ThreadsafeFunction<PasskeyRequestEvent, CalleeHandled>,
) -> napi::Result<String> {
    let (tx, mut rx) = mpsc::unbounded_channel();
    
    // Set the sender in the Windows plugin authenticator
    windows_plugin_authenticator::set_request_sender(tx);
    
    // Spawn task to handle incoming events
    tokio::spawn(async move {
        while let Some(event) = rx.recv().await {
            // The request is already serialized as JSON in the event
            let request_json = event.request_json;
            
            // Get the request type as a string
            let request_type = match event.request_type {
                windows_plugin_authenticator::RequestType::Assertion => "assertion".to_string(),
                windows_plugin_authenticator::RequestType::Registration => "registration".to_string(),
                windows_plugin_authenticator::RequestType::Sync => "sync".to_string(),
            };
            
            let napi_event = PasskeyRequestEvent { request_type, request_json };
            
            // Call the callback asynchronously and capture the return value
            let promise_result: Result<Promise<String>, napi::Error> = callback.call_async(Ok(napi_event)).await;
            // awai promse

            match promise_result {
                Ok(promise_result) => match promise_result.await {
                    Ok(result) => {
                    util::message(&format!("CALLBACK COMPLETED WITH RESPONSE: {}", result));
                    // Parse the JSON response directly back to Rust enum
                    let response: windows_plugin_authenticator::PasskeyResponse = match serde_json::from_str(&result) {
                        Ok(resp) => resp,
                        Err(e) => windows_plugin_authenticator::PasskeyResponse::Error {
                            message: format!("JSON parse error: {}", e),
                        }
                    };
                    let _ = event.response_sender.send(response);
                }
                Err(e) => {
                    eprintln!("Error calling passkey callback inner: {}", e);
                    let _ = event.response_sender.send(windows_plugin_authenticator::PasskeyResponse::Error {
                        message: format!("Inner Callback error: {}", e),
                    });

                }
            }
                Err(e) => {
                    eprintln!("Error calling passkey callback: {}", e);
                    let _ = event.response_sender.send(windows_plugin_authenticator::PasskeyResponse::Error {
                        message: format!("Callback error: {}", e),
                    });
                }
            }
        }
    });
    
    Ok("Event listener registered successfully".to_string())
}
