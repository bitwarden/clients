use std::sync::{atomic::AtomicU32, Arc};

use tokio::sync::Mutex;

use crate::protocol::connection::ConnectionInfo;

const TIMEOUT: std::time::Duration = std::time::Duration::from_secs(60);

static REQUEST_ID_COUNTER: AtomicU32 = AtomicU32::new(0);

/// UI requester is used to abstract the communication with the UI electron process. The internal
/// implementation uses channels to communicate with the UI process. From the consumer perspective
/// it just exposes async request methods.
#[derive(Clone)]
pub struct UiRequester {
    /// Channel to send the request to the UI process. This first gets sent to the NAPI module which then handles the actual IPC to the UI.
    show_ui_request_tx: tokio::sync::mpsc::Sender<UiRequestMessage>,
    /// Channel to receive the response from the UI process. This first gets sent from the NAPI module which then forwards it to this channel.
    get_ui_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
}

impl UiRequester {
    pub fn new(
        show_ui_request_tx: tokio::sync::mpsc::Sender<UiRequestMessage>,
        get_ui_response_rx: Arc<Mutex<tokio::sync::broadcast::Receiver<(u32, bool)>>>,
    ) -> Self {
        Self {
            show_ui_request_tx,
            get_ui_response_rx,
        }
    }

    /// Ask the UI to show a request for the user to approve or deny. The UI may choose to not show a prompt but only
    /// require that the client is unlocked.
    pub async fn request_list(&self, connection_info: &ConnectionInfo) -> bool {
        let request_id = REQUEST_ID_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        self.request(UiRequestMessage::ListRequest {
            request_id,
            connection_info: connection_info.clone(),
        })
        .await
    }

    /// Ask the UI to show a request for the user to approve or deny. The UI may choose to not show a prompt but only
    /// require that the client is unlocked or apply other automatic rules.
    pub async fn request_auth(&self, connection_info: &ConnectionInfo, cipher_id: String) -> bool {
        let request_id = REQUEST_ID_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        self.request(UiRequestMessage::AuthRequest {
            request_id,
            connection_info: connection_info.clone(),
            cipher_id,
        })
        .await
    }

    /// Ask the UI to show a request for the user to approve or deny. The UI may choose to not show a prompt but only
    /// require that the client is unlocked or apply other automatic rules.
    pub async fn request_sign(
        &self,
        connection_info: &ConnectionInfo,
        cipher_id: String,
        namespace: String,
    ) -> bool {
        let request_id = REQUEST_ID_COUNTER.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
        self.request(UiRequestMessage::SignRequest {
            request_id,
            connection_info: connection_info.clone(),
            cipher_id,
            namespace,
        })
        .await
    }

    async fn request(&self, request: UiRequestMessage) -> bool {
        let mut rx_channel = self.get_ui_response_rx.lock().await.resubscribe();
        self.show_ui_request_tx
            .send(request.clone())
            .await
            .expect("Should send request to ui");

        tokio::time::timeout(TIMEOUT, async move {
            while let Ok((id, response)) = rx_channel.recv().await {
                if id == request.id() {
                    return response;
                }
            }
            false
        })
        .await
        .unwrap_or(false)
    }
}

#[derive(Clone, Debug)]
pub enum UiRequestMessage {
    ListRequest {
        request_id: u32,
        connection_info: ConnectionInfo,
    },
    AuthRequest {
        request_id: u32,
        connection_info: ConnectionInfo,
        cipher_id: String,
    },
    SignRequest {
        request_id: u32,
        connection_info: ConnectionInfo,
        cipher_id: String,
        namespace: String,
    },
}

impl UiRequestMessage {
    pub fn id(&self) -> u32 {
        match self {
            UiRequestMessage::ListRequest { request_id, .. } => *request_id,
            UiRequestMessage::AuthRequest { request_id, .. } => *request_id,
            UiRequestMessage::SignRequest { request_id, .. } => *request_id,
        }
    }
}
