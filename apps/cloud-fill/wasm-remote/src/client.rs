use std::sync::{Arc, Mutex};

use ap_client::{CredentialQuery, IdentityFingerprint, PskToken, RemoteClient};
use ap_relay_protocol::IdentityKeyPair;
use wasm_bindgen::prelude::*;

use crate::relay_client::{SharedSocket, WasmRelayClient, send_keepalive};
use crate::storage::{JsConnectionStorage, JsConnectionStore, ProvidedIdentity};
use crate::types::{JsCredentialData, client_error_to_js};

#[wasm_bindgen(js_name = "generateIdentity")]
pub fn generate_identity() -> Vec<u8> {
    IdentityKeyPair::generate().to_cose()
}

#[wasm_bindgen(js_name = "identityFingerprint")]
pub fn identity_fingerprint(identity_cose: &[u8]) -> Result<String, JsValue> {
    let keypair = IdentityKeyPair::from_cose(identity_cose)
        .map_err(|_| JsValue::from_str("Invalid identity"))?;
    Ok(hex::encode(keypair.identity().fingerprint().0))
}

#[wasm_bindgen]
pub struct WasmRemoteClient {
    inner: Option<RemoteClient>,
    relay_url: String,
    identity_cose: Vec<u8>,
    store: Option<JsConnectionStorage>,
    socket: SharedSocket,
}

#[wasm_bindgen]
impl WasmRemoteClient {
    #[wasm_bindgen(constructor)]
    pub fn new(relay_url: &str, identity_cose: Vec<u8>, store: JsConnectionStorage) -> Self {
        Self {
            inner: None,
            relay_url: relay_url.to_string(),
            identity_cose,
            store: Some(store),
            socket: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn connect(&mut self) -> Result<(), JsValue> {
        let store = self
            .store
            .take()
            .ok_or_else(|| JsValue::from_str("Already connected"))?;
        let identity =
            ProvidedIdentity::from_cose(&self.identity_cose).map_err(client_error_to_js)?;
        let connection_store = JsConnectionStore::load(store)
            .await
            .map_err(client_error_to_js)?;
        let relay_client = Box::new(WasmRelayClient::new(
            self.relay_url.clone(),
            Arc::clone(&self.socket),
        ));

        let handle =
            RemoteClient::connect(Box::new(identity), Box::new(connection_store), relay_client)
                .await
                .map_err(client_error_to_js)?;

        self.inner = Some(handle.client);
        drop(handle.notifications);
        Ok(())
    }

    #[wasm_bindgen(js_name = "pairWithPsk")]
    pub async fn pair_with_psk(&self, psk_token: String) -> Result<(), JsValue> {
        let client = self.connected()?;
        let parsed = PskToken::parse(&psk_token)
            .map_err(|e| JsValue::from_str(&format!("Invalid PSK token: {e}")))?;
        let (psk, fingerprint) = parsed.into_parts();
        client
            .pair_with_psk(psk, fingerprint)
            .await
            .map_err(client_error_to_js)
    }

    #[wasm_bindgen(js_name = "loadCachedConnection")]
    pub async fn load_cached_connection(&self, fingerprint_hex: String) -> Result<(), JsValue> {
        let client = self.connected()?;
        let fingerprint = IdentityFingerprint::from_hex(&fingerprint_hex)
            .map_err(|e| JsValue::from_str(&format!("Invalid fingerprint: {e}")))?;
        client
            .load_cached_connection(fingerprint)
            .await
            .map_err(client_error_to_js)
    }

    #[wasm_bindgen(js_name = "requestCredential")]
    pub async fn request_credential(&self, domain: &str) -> Result<JsCredentialData, JsValue> {
        let client = self.connected()?;
        let query = CredentialQuery::Domain(domain.to_string());
        let cred = client
            .request_credential(&query, None)
            .await
            .map_err(client_error_to_js)?;
        Ok(JsCredentialData::from(cred))
    }

    pub fn keepalive(&self) -> bool {
        send_keepalive(&self.socket)
    }

    pub fn close(&mut self) {
        self.inner.take();
        if let Ok(mut slot) = self.socket.lock() {
            if let Some(ws) = slot.take() {
                let _ = ws.close();
            }
        }
    }
}

impl WasmRemoteClient {
    fn connected(&self) -> Result<&RemoteClient, JsValue> {
        self.inner
            .as_ref()
            .ok_or_else(|| JsValue::from_str("Not connected, call connect() first"))
    }
}
