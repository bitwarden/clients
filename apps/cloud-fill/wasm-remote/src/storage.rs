//! Connection store backed by an async JavaScript object, so a service worker can persist
//! sessions in `chrome.storage` (a service worker has neither `window` nor `localStorage`).
//!
//! The JS object implements `load(): Promise<string | null>` and `save(json: string): Promise<void>`
//! and owns where the JSON is kept. The identity key pair is passed in as COSE bytes.

use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

use ap_client::error::ClientError;
use ap_client::{ConnectionInfo, ConnectionStore, ConnectionUpdate, IdentityProvider};
use ap_noise::{MultiDeviceTransport, PersistentTransportState};
use ap_relay_protocol::{IdentityFingerprint, IdentityKeyPair};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    /// JS persistence callbacks supplied by the service worker.
    pub type JsConnectionStorage;

    #[wasm_bindgen(method, catch)]
    async fn load(this: &JsConnectionStorage) -> Result<JsValue, JsValue>;

    #[wasm_bindgen(method, catch)]
    async fn save(this: &JsConnectionStorage, json: &str) -> Result<JsValue, JsValue>;
}

/// The wasm module runs on one thread and these values never leave it. The traits we implement
/// require `Send + Sync` for the native targets that share them.
struct AssertSend<T>(T);

// SAFETY: single-threaded wasm32 target, see above.
unsafe impl<T> Send for AssertSend<T> {}
// SAFETY: single-threaded wasm32 target, see above.
unsafe impl<T> Sync for AssertSend<T> {}

struct SendFuture<F>(F);

// SAFETY: single-threaded wasm32 target, see above.
unsafe impl<F> Send for SendFuture<F> {}

impl<F: Future> Future for SendFuture<F> {
    type Output = F::Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output> {
        // SAFETY: the inner future is never moved out of the pinned wrapper.
        unsafe { self.map_unchecked_mut(|s| &mut s.0).poll(cx) }
    }
}

pub struct ProvidedIdentity {
    keypair: IdentityKeyPair,
}

impl ProvidedIdentity {
    pub fn from_cose(cose_bytes: &[u8]) -> Result<Self, ClientError> {
        let keypair = IdentityKeyPair::from_cose(cose_bytes).map_err(|_| {
            ClientError::IdentityStorageFailed("Failed to parse identity from COSE".to_string())
        })?;
        Ok(Self { keypair })
    }
}

#[async_trait]
impl IdentityProvider for ProvidedIdentity {
    async fn identity(&self) -> IdentityKeyPair {
        self.keypair.clone()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ConnectionRecord {
    remote_fingerprint: IdentityFingerprint,
    cached_at: u64,
    last_connected_at: u64,
    #[serde(default)]
    transport_state: Option<Vec<u8>>,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct ConnectionCacheData {
    connections: Vec<ConnectionRecord>,
}

fn record_to_info(record: &ConnectionRecord) -> ConnectionInfo {
    let transport_state = record.transport_state.as_ref().and_then(|bytes| {
        PersistentTransportState::from_bytes(bytes)
            .map(MultiDeviceTransport::from)
            .ok()
    });
    ConnectionInfo {
        fingerprint: record.remote_fingerprint,
        name: record.name.clone(),
        cached_at: record.cached_at,
        last_connected_at: record.last_connected_at,
        transport_state,
    }
}

fn info_to_record(info: &ConnectionInfo) -> Result<ConnectionRecord, ClientError> {
    let transport_bytes = match &info.transport_state {
        Some(transport) => Some(
            PersistentTransportState::from(transport)
                .to_bytes()
                .map_err(|e| {
                    ClientError::NoiseProtocol(format!("Failed to serialize transport state: {e}"))
                })?,
        ),
        None => None,
    };
    Ok(ConnectionRecord {
        remote_fingerprint: info.fingerprint,
        cached_at: info.cached_at,
        last_connected_at: info.last_connected_at,
        transport_state: transport_bytes,
        name: info.name.clone(),
    })
}

pub struct JsConnectionStore {
    js: AssertSend<JsConnectionStorage>,
    data: ConnectionCacheData,
}

impl JsConnectionStore {
    pub async fn load(js: JsConnectionStorage) -> Result<Self, ClientError> {
        let loaded = js
            .load()
            .await
            .map_err(|_| ClientError::ConnectionCache("Failed to read stored sessions".into()))?;
        let data = match loaded.as_string() {
            Some(json) => serde_json::from_str(&json).unwrap_or_else(|e| {
                tracing::warn!("Corrupt connection cache, resetting: {e}");
                ConnectionCacheData::default()
            }),
            None => ConnectionCacheData::default(),
        };
        Ok(Self {
            js: AssertSend(js),
            data,
        })
    }

    async fn persist(&self) -> Result<(), ClientError> {
        let json = serde_json::to_string(&self.data)
            .map_err(|e| ClientError::ConnectionCache(format!("Serialization failed: {e}")))?;
        SendFuture(self.js.0.save(&json))
            .await
            .map_err(|_| ClientError::ConnectionCache("Failed to write stored sessions".into()))?;
        Ok(())
    }
}

#[async_trait]
impl ConnectionStore for JsConnectionStore {
    async fn get(&self, fingerprint: &IdentityFingerprint) -> Option<ConnectionInfo> {
        self.data
            .connections
            .iter()
            .find(|s| s.remote_fingerprint == *fingerprint)
            .map(record_to_info)
    }

    async fn save(&mut self, connection: ConnectionInfo) -> Result<(), ClientError> {
        let record = info_to_record(&connection)?;
        if let Some(existing) = self
            .data
            .connections
            .iter_mut()
            .find(|s| s.remote_fingerprint == connection.fingerprint)
        {
            *existing = record;
        } else {
            self.data.connections.push(record);
        }
        self.persist().await
    }

    async fn update(&mut self, update: ConnectionUpdate) -> Result<(), ClientError> {
        if let Some(connection) = self
            .data
            .connections
            .iter_mut()
            .find(|s| s.remote_fingerprint == update.fingerprint)
        {
            connection.last_connected_at = update.last_connected_at;
            self.persist().await
        } else {
            Err(ClientError::ConnectionCache(
                "Connection not found".to_string(),
            ))
        }
    }

    async fn list(&self) -> Vec<ConnectionInfo> {
        self.data.connections.iter().map(record_to_info).collect()
    }
}
