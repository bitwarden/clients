//! Adapters implementing `ap_client`'s storage traits on top of the host-provided
//! [`KvStorage`], mirroring the on-disk formats `ap-cli` uses (`ap-cli/src/storage/*.rs`) so
//! the two stay compatible in shape even though the backing store differs (file vs. host KV).
//!
//! - Identity is stored as base64(COSE bytes) under key `"identity"` — the same COSE bytes
//!   `ap-cli`'s `FileIdentityStorage` writes to disk, just base64-encoded so they fit in a
//!   string-valued KV entry.
//! - Connections and PSKs are stored as JSON arrays under `"connections"` / `"psks"`,
//!   structurally identical to `ap-cli`'s `ConnectionCacheData` / `PskStoreData`.
//!
//! None of these types ever see decrypted vault data — they only move identity key material,
//! transport session state, and PSK bytes, all of which `ap_client` treats as opaque.

use std::sync::Arc;

use ap_client::{
    ClientError, ConnectionInfo, ConnectionStore, ConnectionUpdate, IdentityProvider, PskEntry,
    PskStore,
};
use ap_noise::{MultiDeviceTransport, PersistentTransportState, Psk};
use ap_relay_protocol::{IdentityFingerprint, IdentityKeyPair};
use async_trait::async_trait;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as AsyncMutex;
use tracing::debug;

use crate::callbacks::KvStorage;
use crate::error::AgentAccessError;

// ---------------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------------

const IDENTITY_KEY: &str = "identity";

/// `IdentityProvider` backed by [`KvStorage`].
///
/// `ap_client::IdentityProvider::identity()` is infallible, so the keypair is loaded (or
/// generated and persisted) once here, at construction time, rather than on every call.
pub struct KvIdentityProvider {
    keypair: IdentityKeyPair,
}

impl KvIdentityProvider {
    /// Loads the identity from `storage`, generating and persisting a new one if none exists.
    pub async fn load_or_generate(storage: &dyn KvStorage) -> Result<Self, AgentAccessError> {
        let keypair = match storage
            .get(IDENTITY_KEY)
            .await
            .map_err(AgentAccessError::Storage)?
        {
            Some(encoded) => {
                let cose_bytes = STANDARD
                    .decode(encoded)
                    .map_err(|_| AgentAccessError::InvalidStoredData)?;
                IdentityKeyPair::from_cose(&cose_bytes)
                    .map_err(|_| AgentAccessError::InvalidStoredData)?
            }
            None => {
                debug!("No stored agent access identity found, generating a new one");
                let keypair = IdentityKeyPair::generate();
                let encoded = STANDARD.encode(keypair.to_cose());
                storage
                    .set(IDENTITY_KEY, Some(&encoded))
                    .await
                    .map_err(AgentAccessError::Storage)?;
                keypair
            }
        };

        Ok(Self { keypair })
    }

    /// The 64-char hex identity fingerprint, computed once so callers don't need to keep a
    /// reference to the provider after `ap_client::UserClient::connect` takes ownership of it.
    pub fn fingerprint_hex(&self) -> String {
        self.keypair.identity().fingerprint().to_hex()
    }
}

#[async_trait]
impl IdentityProvider for KvIdentityProvider {
    async fn identity(&self) -> IdentityKeyPair {
        self.keypair.clone()
    }
}

// ---------------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------------

const CONNECTIONS_KEY: &str = "connections";

/// On-disk/at-rest shape for one cached connection — mirrors `ap-cli`'s `ConnectionRecord`.
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
    #[serde(default)]
    connections: Vec<ConnectionRecord>,
}

fn record_to_info(record: &ConnectionRecord) -> Option<ConnectionInfo> {
    let transport_state = match &record.transport_state {
        Some(bytes) => match PersistentTransportState::from_bytes(bytes) {
            Ok(state) => Some(MultiDeviceTransport::from(state)),
            Err(_) => {
                debug!("Discarding cached connection with unreadable transport state");
                return None;
            }
        },
        None => None,
    };

    Some(ConnectionInfo {
        fingerprint: record.remote_fingerprint,
        name: record.name.clone(),
        cached_at: record.cached_at,
        last_connected_at: record.last_connected_at,
        transport_state,
    })
}

fn info_to_record(info: &ConnectionInfo) -> Result<ConnectionRecord, ClientError> {
    let transport_state = match &info.transport_state {
        Some(transport) => Some(
            PersistentTransportState::from(transport)
                .to_bytes()
                .map_err(|e| ClientError::NoiseProtocol(e.to_string()))?,
        ),
        None => None,
    };

    Ok(ConnectionRecord {
        remote_fingerprint: info.fingerprint,
        cached_at: info.cached_at,
        last_connected_at: info.last_connected_at,
        transport_state,
        name: info.name.clone(),
    })
}

/// Summary of a cached connection for the `listConnections()` napi surface — omits the opaque
/// transport state, which is internal to `ap_client`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConnectionSummary {
    pub fingerprint: String,
    pub name: Option<String>,
    pub cached_at: u64,
    pub last_connected_at: u64,
}

/// `ConnectionStore` adapter over [`KvStorage`], with an in-memory cache and write-through
/// persistence.
///
/// Cheaply `Clone`-able: clones share the same cache and backing storage (`Arc`s all the way
/// down). `ap_client::UserClient::connect` takes ownership of a `Box<dyn ConnectionStore>`, so
/// [`crate::DesktopAgentAccess`] keeps a second clone for `list_summaries`/`remove`, which have
/// no equivalent on the `ap_client::UserClient` handle.
#[derive(Clone)]
pub struct KvConnectionStore {
    storage: Arc<dyn KvStorage>,
    cache: Arc<AsyncMutex<Vec<ConnectionRecord>>>,
}

impl KvConnectionStore {
    pub async fn load(storage: Arc<dyn KvStorage>) -> Result<Self, AgentAccessError> {
        let cache = match storage
            .get(CONNECTIONS_KEY)
            .await
            .map_err(AgentAccessError::Storage)?
        {
            Some(json) => {
                serde_json::from_str::<ConnectionCacheData>(&json)
                    .map_err(|_| AgentAccessError::InvalidStoredData)?
                    .connections
            }
            None => Vec::new(),
        };

        Ok(Self {
            storage,
            cache: Arc::new(AsyncMutex::new(cache)),
        })
    }

    async fn persist(&self, cache: &[ConnectionRecord]) -> Result<(), AgentAccessError> {
        let data = ConnectionCacheData {
            connections: cache.to_vec(),
        };
        let json = serde_json::to_string(&data).map_err(|_| AgentAccessError::InvalidStoredData)?;
        self.storage
            .set(CONNECTIONS_KEY, Some(&json))
            .await
            .map_err(AgentAccessError::Storage)
    }

    /// Summaries of all cached connections, for the `listConnections()` napi surface.
    pub async fn list_summaries(&self) -> Vec<ConnectionSummary> {
        self.cache
            .lock()
            .await
            .iter()
            .map(|r| ConnectionSummary {
                fingerprint: r.remote_fingerprint.to_hex(),
                name: r.name.clone(),
                cached_at: r.cached_at,
                last_connected_at: r.last_connected_at,
            })
            .collect()
    }

    /// Removes a cached connection by its hex identity fingerprint. Returns `true` if a
    /// connection was removed.
    ///
    /// `ap_client::ConnectionStore` has no first-class removal API, so per the integration
    /// plan this filters the in-memory cache and persists the result — the same pattern
    /// `save`/`update` already use.
    pub async fn remove(&self, fingerprint_hex: &str) -> Result<bool, AgentAccessError> {
        let fingerprint = IdentityFingerprint::from_hex(fingerprint_hex)
            .map_err(|_| AgentAccessError::InvalidFingerprint)?;

        let mut cache = self.cache.lock().await;
        let before = cache.len();
        cache.retain(|r| r.remote_fingerprint != fingerprint);
        let removed = cache.len() != before;

        if removed {
            let snapshot = cache.clone();
            drop(cache);
            self.persist(&snapshot).await?;
        }

        Ok(removed)
    }
}

#[async_trait]
impl ConnectionStore for KvConnectionStore {
    async fn get(&self, fingerprint: &IdentityFingerprint) -> Option<ConnectionInfo> {
        self.cache
            .lock()
            .await
            .iter()
            .find(|r| r.remote_fingerprint == *fingerprint)
            .and_then(record_to_info)
    }

    async fn save(&mut self, connection: ConnectionInfo) -> Result<(), ClientError> {
        let record = info_to_record(&connection)?;

        let mut cache = self.cache.lock().await;
        if let Some(existing) = cache
            .iter_mut()
            .find(|r| r.remote_fingerprint == connection.fingerprint)
        {
            *existing = record;
        } else {
            cache.push(record);
        }

        let snapshot = cache.clone();
        drop(cache);
        self.persist(&snapshot)
            .await
            .map_err(|_| ClientError::ConnectionCache("failed to persist connection".to_string()))
    }

    async fn update(&mut self, update: ConnectionUpdate) -> Result<(), ClientError> {
        let mut cache = self.cache.lock().await;
        let Some(record) = cache
            .iter_mut()
            .find(|r| r.remote_fingerprint == update.fingerprint)
        else {
            return Err(ClientError::ConnectionNotFound);
        };
        record.last_connected_at = update.last_connected_at;

        let snapshot = cache.clone();
        drop(cache);
        self.persist(&snapshot)
            .await
            .map_err(|_| ClientError::ConnectionCache("failed to persist connection".to_string()))
    }

    async fn list(&self) -> Vec<ConnectionInfo> {
        self.cache
            .lock()
            .await
            .iter()
            .filter_map(record_to_info)
            .collect()
    }
}

// ---------------------------------------------------------------------------------
// PSKs
// ---------------------------------------------------------------------------------

const PSKS_KEY: &str = "psks";

/// On-disk/at-rest shape for one stored PSK — mirrors `ap-cli`'s `PskRecord`. The PSK itself
/// is hex-encoded via `Psk::to_hex`/`Psk::from_hex`, the same encoding used on the wire.
#[derive(Clone, Serialize, Deserialize)]
struct PskRecord {
    psk_id: String,
    psk_hex: String,
    #[serde(default)]
    name: Option<String>,
    created_at: u64,
}

impl std::fmt::Debug for PskRecord {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PskRecord")
            .field("psk_id", &self.psk_id)
            .field("psk_hex", &"[REDACTED]")
            .field("name", &self.name)
            .field("created_at", &self.created_at)
            .finish()
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct PskStoreData {
    #[serde(default)]
    psks: Vec<PskRecord>,
}

fn record_to_entry(record: &PskRecord) -> Option<PskEntry> {
    let psk = Psk::from_hex(&record.psk_hex).ok()?;
    Some(PskEntry {
        psk_id: record.psk_id.clone(),
        psk,
        name: record.name.clone(),
        created_at: record.created_at,
    })
}

fn entry_to_record(entry: &PskEntry) -> PskRecord {
    PskRecord {
        psk_id: entry.psk_id.clone(),
        psk_hex: entry.psk.to_hex(),
        name: entry.name.clone(),
        created_at: entry.created_at,
    }
}

/// `PskStore` adapter over [`KvStorage`], with an in-memory cache and write-through
/// persistence. Unlike [`KvConnectionStore`], this isn't shared with the napi surface (there's
/// no `listPsks`/`removePsk` in the Phase A contract), so it stays private to `start()`.
pub struct KvPskStore {
    storage: Arc<dyn KvStorage>,
    cache: Vec<PskRecord>,
}

impl KvPskStore {
    pub async fn load(storage: Arc<dyn KvStorage>) -> Result<Self, AgentAccessError> {
        let cache = match storage
            .get(PSKS_KEY)
            .await
            .map_err(AgentAccessError::Storage)?
        {
            Some(json) => {
                serde_json::from_str::<PskStoreData>(&json)
                    .map_err(|_| AgentAccessError::InvalidStoredData)?
                    .psks
            }
            None => Vec::new(),
        };

        Ok(Self { storage, cache })
    }

    async fn persist(&self) -> Result<(), AgentAccessError> {
        let data = PskStoreData {
            psks: self.cache.clone(),
        };
        let json = serde_json::to_string(&data).map_err(|_| AgentAccessError::InvalidStoredData)?;
        self.storage
            .set(PSKS_KEY, Some(&json))
            .await
            .map_err(AgentAccessError::Storage)
    }
}

#[async_trait]
impl PskStore for KvPskStore {
    async fn get(&self, psk_id: &String) -> Option<PskEntry> {
        self.cache
            .iter()
            .find(|r| r.psk_id == *psk_id)
            .and_then(record_to_entry)
    }

    async fn save(&mut self, entry: PskEntry) -> Result<(), ClientError> {
        let record = entry_to_record(&entry);
        if let Some(existing) = self.cache.iter_mut().find(|r| r.psk_id == entry.psk_id) {
            *existing = record;
        } else {
            self.cache.push(record);
        }
        self.persist()
            .await
            .map_err(|e| ClientError::Serialization(e.to_string()))
    }

    async fn remove(&mut self, psk_id: &String) -> Result<(), ClientError> {
        self.cache.retain(|r| r.psk_id != *psk_id);
        self.persist()
            .await
            .map_err(|e| ClientError::Serialization(e.to_string()))
    }

    async fn list(&self) -> Vec<PskEntry> {
        self.cache.iter().filter_map(record_to_entry).collect()
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use super::*;

    /// In-memory [`KvStorage`] mock for round-trip tests — stands in for the real host
    /// implementation (OS keychain / encrypted file), which lives in Phase B.
    #[derive(Default)]
    struct InMemoryKv {
        map: AsyncMutex<HashMap<String, String>>,
    }

    #[async_trait]
    impl KvStorage for InMemoryKv {
        async fn get(&self, key: &str) -> Result<Option<String>, CallbackError> {
            Ok(self.map.lock().await.get(key).cloned())
        }

        async fn set(&self, key: &str, value: Option<&str>) -> Result<(), CallbackError> {
            let mut map = self.map.lock().await;
            match value {
                Some(v) => {
                    map.insert(key.to_string(), v.to_string());
                }
                None => {
                    map.remove(key);
                }
            }
            Ok(())
        }
    }

    use crate::callbacks::CallbackError;

    fn sample_connection(fingerprint: IdentityFingerprint, name: &str) -> ConnectionInfo {
        ConnectionInfo {
            fingerprint,
            name: Some(name.to_string()),
            cached_at: 1_700_000_000,
            last_connected_at: 1_700_000_100,
            transport_state: None,
        }
    }

    #[tokio::test]
    async fn identity_round_trips_and_is_stable_across_loads() {
        let kv = InMemoryKv::default();

        let first = KvIdentityProvider::load_or_generate(&kv).await.unwrap();
        let first_fp = first.fingerprint_hex();

        // A second load against the same backing store must not regenerate the identity.
        let second = KvIdentityProvider::load_or_generate(&kv).await.unwrap();
        assert_eq!(first_fp, second.fingerprint_hex());
    }

    #[tokio::test]
    async fn connection_store_round_trips_through_a_fresh_instance() {
        let storage: Arc<dyn KvStorage> = Arc::new(InMemoryKv::default());
        let fp = IdentityFingerprint([0x11; 32]);

        {
            let mut store = KvConnectionStore::load(Arc::clone(&storage)).await.unwrap();
            ConnectionStore::save(&mut store, sample_connection(fp, "Work Laptop"))
                .await
                .unwrap();
        }

        // Load a brand-new instance over the same backing storage — the write-through save
        // above must be visible.
        let store = KvConnectionStore::load(Arc::clone(&storage)).await.unwrap();
        let summaries = store.list_summaries().await;
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].fingerprint, fp.to_hex());
        assert_eq!(summaries[0].name.as_deref(), Some("Work Laptop"));

        let fetched = ConnectionStore::get(&store, &fp).await.unwrap();
        assert_eq!(fetched.name.as_deref(), Some("Work Laptop"));
    }

    #[tokio::test]
    async fn connection_store_remove_filters_and_persists() {
        let storage: Arc<dyn KvStorage> = Arc::new(InMemoryKv::default());
        let fp_a = IdentityFingerprint([0xaa; 32]);
        let fp_b = IdentityFingerprint([0xbb; 32]);

        let mut store = KvConnectionStore::load(Arc::clone(&storage)).await.unwrap();
        ConnectionStore::save(&mut store, sample_connection(fp_a, "A"))
            .await
            .unwrap();
        ConnectionStore::save(&mut store, sample_connection(fp_b, "B"))
            .await
            .unwrap();

        let removed = store.remove(&fp_a.to_hex()).await.unwrap();
        assert!(removed);

        let removed_again = store.remove(&fp_a.to_hex()).await.unwrap();
        assert!(
            !removed_again,
            "removing twice should be a no-op, not an error"
        );

        // Persistence check: reload from the same backing storage.
        let reloaded = KvConnectionStore::load(Arc::clone(&storage)).await.unwrap();
        let summaries = reloaded.list_summaries().await;
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].fingerprint, fp_b.to_hex());
    }

    #[tokio::test]
    async fn connection_store_remove_rejects_invalid_fingerprint() {
        let storage: Arc<dyn KvStorage> = Arc::new(InMemoryKv::default());
        let store = KvConnectionStore::load(storage).await.unwrap();

        let err = store.remove("not-hex").await.unwrap_err();
        assert!(matches!(err, AgentAccessError::InvalidFingerprint));
    }

    #[tokio::test]
    async fn psk_store_round_trips_through_a_fresh_instance() {
        let storage: Arc<dyn KvStorage> = Arc::new(InMemoryKv::default());
        let psk = Psk::generate();
        let entry = PskEntry {
            psk_id: psk.id(),
            psk: psk.clone(),
            name: Some("Automation".to_string()),
            created_at: 1_700_000_000,
        };

        {
            let mut store = KvPskStore::load(Arc::clone(&storage)).await.unwrap();
            PskStore::save(&mut store, entry.clone()).await.unwrap();
        }

        let store = KvPskStore::load(Arc::clone(&storage)).await.unwrap();
        let fetched = PskStore::get(&store, &entry.psk_id).await.unwrap();
        assert_eq!(fetched.psk.to_hex(), psk.to_hex());
        assert_eq!(fetched.name.as_deref(), Some("Automation"));

        let all = PskStore::list(&store).await;
        assert_eq!(all.len(), 1);
    }

    #[tokio::test]
    async fn psk_store_remove_persists() {
        let storage: Arc<dyn KvStorage> = Arc::new(InMemoryKv::default());
        let psk = Psk::generate();
        let entry = PskEntry {
            psk_id: psk.id(),
            psk,
            name: None,
            created_at: 1_700_000_000,
        };

        let mut store = KvPskStore::load(Arc::clone(&storage)).await.unwrap();
        PskStore::save(&mut store, entry.clone()).await.unwrap();
        PskStore::remove(&mut store, &entry.psk_id).await.unwrap();

        let reloaded = KvPskStore::load(Arc::clone(&storage)).await.unwrap();
        assert!(PskStore::list(&reloaded).await.is_empty());
    }
}
