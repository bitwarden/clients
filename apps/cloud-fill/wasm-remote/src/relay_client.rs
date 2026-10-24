use ap_client::RelayClient;
use ap_client::error::ClientError;
use ap_relay_client::IncomingMessage;
use ap_relay_protocol::{
    Challenge, IdentityFingerprint, IdentityKeyPair, Messages, RendezvousCode,
};
use async_trait::async_trait;
use std::sync::{Arc, Mutex};
use tokio::sync::{mpsc, oneshot};
use wasm_bindgen::closure::Closure;
use wasm_bindgen::prelude::*;
use web_sys::{CloseEvent, ErrorEvent, MessageEvent, WebSocket};

pub struct WasmRelayClient {
    url: String,
    ws: Option<WebSocket>,
    shared_ws: SharedSocket,
}

pub type SharedSocket = Arc<Mutex<Option<WebSocket>>>;

pub fn send_keepalive(socket: &SharedSocket) -> bool {
    let guard = match socket.lock() {
        Ok(guard) => guard,
        Err(_) => return false,
    };
    match guard.as_ref() {
        Some(ws) if ws.ready_state() == WebSocket::OPEN => ws.send_with_str("{}").is_ok(),
        _ => false,
    }
}

type AuthSender = Arc<Mutex<Option<oneshot::Sender<Result<(), ClientError>>>>>;

fn fail_auth(auth_tx: &AuthSender, message: String) {
    if let Some(tx) = auth_tx.lock().expect("auth_tx lock").take() {
        let _ = tx.send(Err(ClientError::ConnectionFailed(message)));
    }
}

fn handle_auth_challenge(
    ws: &WebSocket,
    identity: &IdentityKeyPair,
    challenge: &Challenge,
    auth_done: &Mutex<bool>,
    auth_tx: &AuthSender,
) {
    let response = challenge.sign(identity);
    let auth_msg = Messages::AuthResponse(identity.identity(), response);
    let json = match serde_json::to_string(&auth_msg) {
        Ok(json) => json,
        Err(e) => {
            fail_auth(auth_tx, format!("Auth serialization error: {e}"));
            return;
        }
    };
    if let Err(e) = ws.send_with_str(&json) {
        tracing::error!("Failed to send auth response: {e:?}");
        fail_auth(auth_tx, "Failed to send auth response".to_string());
        return;
    }
    *auth_done.lock().expect("auth_done lock") = true;
    if let Some(tx) = auth_tx.lock().expect("auth_tx lock").take() {
        let _ = tx.send(Ok(()));
    }
}

impl WasmRelayClient {
    pub fn new(url: String, shared_ws: SharedSocket) -> Self {
        Self {
            url,
            ws: None,
            shared_ws,
        }
    }

    fn send_json(&self, msg: &Messages) -> Result<(), ClientError> {
        let ws = self
            .ws
            .as_ref()
            .ok_or_else(|| ClientError::ConnectionFailed("Not connected".to_string()))?;
        if ws.ready_state() != WebSocket::OPEN {
            return Err(ClientError::ConnectionFailed(
                "Relay connection is closed".to_string(),
            ));
        }
        let json = serde_json::to_string(msg)
            .map_err(|e| ClientError::ConnectionFailed(format!("Serialization error: {e}")))?;
        ws.send_with_str(&json)
            .map_err(|e| ClientError::ConnectionFailed(format!("WebSocket send error: {e:?}")))?;
        Ok(())
    }
}

#[async_trait]
impl RelayClient for WasmRelayClient {
    async fn connect(
        &mut self,
        identity: IdentityKeyPair,
    ) -> Result<mpsc::UnboundedReceiver<IncomingMessage>, ClientError> {
        let ws = WebSocket::new(&self.url).map_err(|e| {
            ClientError::ConnectionFailed(format!("Failed to create WebSocket: {e:?}"))
        })?;

        let (open_tx, open_rx) = oneshot::channel::<Result<(), ClientError>>();
        let (auth_tx, auth_rx) = oneshot::channel::<Result<(), ClientError>>();
        let (incoming_tx, incoming_rx) = mpsc::unbounded_channel::<IncomingMessage>();
        let incoming_tx = Arc::new(Mutex::new(Some(incoming_tx)));

        let open_tx = Arc::new(Mutex::new(Some(open_tx)));
        let auth_tx = Arc::new(Mutex::new(Some(auth_tx)));

        {
            let open_tx = Arc::clone(&open_tx);
            let cb = Closure::once(move |_: JsValue| {
                if let Some(tx) = open_tx.lock().expect("open_tx lock poisoned").take() {
                    let _ = tx.send(Ok(()));
                }
            });
            ws.set_onopen(Some(cb.as_ref().unchecked_ref()));
            cb.forget();
        }

        {
            let open_tx = Arc::clone(&open_tx);
            let cb = Closure::once(move |_: ErrorEvent| {
                if let Some(tx) = open_tx.lock().expect("open_tx err lock poisoned").take() {
                    let _ = tx.send(Err(ClientError::ConnectionFailed(
                        "WebSocket connection error".to_string(),
                    )));
                }
            });
            ws.set_onerror(Some(cb.as_ref().unchecked_ref()));
            cb.forget();
        }

        open_rx
            .await
            .map_err(|_| ClientError::ConnectionFailed("Open channel dropped".to_string()))?
            .map_err(|e| ClientError::ConnectionFailed(e.to_string()))?;

        ws.set_onopen(None);
        ws.set_onerror(None);
        {
            let ws_clone = ws.clone();
            let auth_tx = Arc::clone(&auth_tx);
            let auth_done = Arc::new(Mutex::new(false));
            let incoming_tx = Arc::clone(&incoming_tx);
            let forward = move |message: IncomingMessage| {
                if let Ok(guard) = incoming_tx.lock() {
                    if let Some(tx) = guard.as_ref() {
                        let _ = tx.send(message);
                    }
                }
            };

            let cb = Closure::wrap(Box::new(move |event: MessageEvent| {
                let text = match event.data().as_string() {
                    Some(t) => t,
                    None => return,
                };

                let parsed: Messages = match serde_json::from_str(&text) {
                    Ok(m) => m,
                    Err(e) => {
                        tracing::warn!("Failed to parse relay message: {e}");
                        return;
                    }
                };

                let is_auth_done = *auth_done.lock().expect("auth_done lock poisoned");
                if !is_auth_done {
                    match parsed {
                        Messages::AuthChallenge(challenge) => {
                            handle_auth_challenge(
                                &ws_clone, &identity, &challenge, &auth_done, &auth_tx,
                            );
                        }
                        _ => {
                            tracing::warn!("Expected AuthChallenge, got: {parsed:?}");
                            fail_auth(&auth_tx, "Expected AuthChallenge".to_string());
                        }
                    }
                } else {
                    match parsed {
                        Messages::Send {
                            source,
                            destination,
                            payload,
                        } => {
                            if let Some(source) = source {
                                forward(IncomingMessage::Send {
                                    source,
                                    destination,
                                    payload,
                                });
                            }
                        }
                        Messages::RendezvousInfo(code) => {
                            forward(IncomingMessage::RendezvousInfo(code));
                        }
                        Messages::IdentityInfo {
                            fingerprint,
                            identity,
                        } => {
                            forward(IncomingMessage::IdentityInfo {
                                fingerprint,
                                identity,
                            });
                        }
                        _ => {
                            tracing::debug!("Ignoring post-auth message: {parsed:?}");
                        }
                    }
                }
            }) as Box<dyn FnMut(MessageEvent)>);
            ws.set_onmessage(Some(cb.as_ref().unchecked_ref()));
            cb.forget();
        }

        {
            let cb = Closure::wrap(Box::new(move |_: ErrorEvent| {
                tracing::error!("WebSocket error");
            }) as Box<dyn FnMut(ErrorEvent)>);
            ws.set_onerror(Some(cb.as_ref().unchecked_ref()));
            cb.forget();
        }

        {
            let incoming_tx = Arc::clone(&incoming_tx);
            let cb = Closure::wrap(Box::new(move |event: CloseEvent| {
                tracing::info!(
                    "WebSocket closed: code={}, reason={}",
                    event.code(),
                    event.reason()
                );
                if let Ok(mut guard) = incoming_tx.lock() {
                    guard.take();
                }
            }) as Box<dyn FnMut(CloseEvent)>);
            ws.set_onclose(Some(cb.as_ref().unchecked_ref()));
            cb.forget();
        }

        auth_rx
            .await
            .map_err(|_| ClientError::ConnectionFailed("Auth channel dropped".to_string()))?
            .map_err(|e| ClientError::ConnectionFailed(e.to_string()))?;

        if let Ok(mut slot) = self.shared_ws.lock() {
            *slot = Some(ws.clone());
        }
        self.ws = Some(ws);
        Ok(incoming_rx)
    }

    async fn request_rendezvous(&self) -> Result<(), ClientError> {
        self.send_json(&Messages::GetRendezvous)
    }

    async fn request_identity(&self, code: RendezvousCode) -> Result<(), ClientError> {
        self.send_json(&Messages::GetIdentity(code))
    }

    async fn send_to(
        &self,
        fingerprint: IdentityFingerprint,
        data: Vec<u8>,
    ) -> Result<(), ClientError> {
        self.send_json(&Messages::Send {
            source: None,
            destination: fingerprint,
            payload: data,
        })
    }

    async fn disconnect(&mut self) -> Result<(), ClientError> {
        if let Ok(mut slot) = self.shared_ws.lock() {
            slot.take();
        }
        if let Some(ws) = self.ws.take() {
            ws.set_onopen(None);
            ws.set_onmessage(None);
            ws.set_onerror(None);
            ws.set_onclose(None);
            let _ = ws.close();
        }
        Ok(())
    }
}
