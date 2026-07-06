use std::{
    collections::HashMap,
    error::Error,
    ptr,
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    time::Duration,
};

use autofill_provider::{ConnectionStatus, WindowHandleQueryResponse};
use base64::engine::{general_purpose::STANDARD, Engine as _};
use win_webauthn::plugin::{
    Clsid, PluginAuthenticator, PluginCancelOperationRequest, PluginGetAssertionRequest,
    PluginLockStatus, PluginMakeCredentialRequest, WebAuthnPlugin,
};
use windows::{
    core::GUID,
    Win32::{
        Foundation::HWND,
        System::Threading::{AttachThreadInput, GetCurrentThreadId},
        UI::WindowsAndMessaging::{
            BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId,
        },
    },
};

use crate::{
    ipc::{IpcClient, IpcConnector, RealIpcConnector},
    util::create_context_string,
};

pub(super) fn run_server(clsid: Clsid) -> Result<WebAuthnPlugin, String> {
    tracing::debug!("Setting up COM server");

    let authenticator_handler = BitwardenPluginAuthenticator {
        connector: RealIpcConnector,
        client: Mutex::new(None),
        callbacks: Arc::new(Mutex::new(HashMap::new())),
    };
    let mut plugin = WebAuthnPlugin::new(clsid);

    plugin
        .register_server(authenticator_handler)
        .map_err(|err| err.to_string())?;
    tracing::debug!("Passkey plugin COM server registered");
    Ok(plugin)
}

struct BitwardenPluginAuthenticator<Conn: IpcConnector> {
    connector: Conn,
    /// Active connection to the desktop app over IPC.
    client: Mutex<Option<Arc<Conn::Client>>>,
    /// Map of transaction IDs to cancellation tokens.
    callbacks: Arc<Mutex<HashMap<GUID, Sender<()>>>>,
}

impl<Conn: IpcConnector> BitwardenPluginAuthenticator<Conn> {
    fn get_client(&self) -> Result<Arc<Conn::Client>, String> {
        {
            let mut client = self.client.lock().expect("not poisoned");
            match client.as_ref().map(|c| c.get_connection_status()) {
                Some(
                    status @ ConnectionStatus::Connected | status @ ConnectionStatus::Connecting,
                ) => {
                    return client.as_ref().cloned().ok_or_else(|| format!("Connection status is {status:?}, but could not find reference to connected client"));
                }
                Some(ConnectionStatus::Disconnected) => {
                    tracing::debug!("IPC connection dropped, reconnecting");
                    *client = None;
                }
                None => {}
            }
        }
        self.do_connect()
    }

    fn do_connect(&self) -> Result<Arc<Conn::Client>, String> {
        // 20 * 200ms = 4 seconds
        for i in 1..=20 {
            if !self.connector.is_available() {
                if i == 1 {
                    tracing::debug!("Launching desktop app");
                    self.connector.launch_desktop_app();
                }
                let wait_time = Duration::from_millis(200);
                tracing::debug!(
                    "Waiting for IPC availability, attempt {i}, retrying in {wait_time:?}"
                );
                self.connector.sleep(wait_time);
                continue;
            }
            let mut client = self.client.lock().expect("not poisoned");
            if let Some(c) = client.as_ref() {
                return Ok(c.clone()); // another thread connected while we slept
            }
            tracing::debug!("Connecting to desktop app via IPC");
            let c = Arc::new(self.connector.connect());
            tracing::debug!(
                "Initiated IPC connection attempt. The connection should resolve later."
            );
            *client = Some(c.clone());
            return Ok(c);
        }
        Err("Timed out waiting for IPC to become available".to_string())
    }

    fn wait_for_connected_client(&self, client: &Arc<Conn::Client>) -> Result<(), String> {
        // 50 * 200ms = 10 seconds
        for _ in 0..50 {
            if let ConnectionStatus::Connected = client.get_connection_status() {
                return Ok(());
            }
            self.connector.sleep(Duration::from_millis(200));
        }
        // Reset so the next get_client() starts a fresh connection attempt.
        *self.client.lock().expect("not poisoned") = None;
        Err("Timed out waiting for IPC connection to be established".to_string())
    }
}

impl<C: IpcConnector> PluginAuthenticator for BitwardenPluginAuthenticator<C> {
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        tracing::debug!("Received MakeCredential: {request:?}");
        let client = self.get_client()?;

        self.wait_for_connected_client(&client)?;

        present_window(client.as_ref())?;

        let (cancel_tx, cancel_rx) = mpsc::channel();
        let transaction_id = request.transaction_id;
        self.callbacks
            .lock()
            .expect("not poisoned")
            .insert(transaction_id, cancel_tx);

        let response = crate::make_credential::make_credential(client.as_ref(), request, cancel_rx);

        // clean up callbacks
        self.callbacks
            .lock()
            .expect("not poisoned")
            .remove(&transaction_id);

        response
    }

    fn get_assertion(
        &self,
        request: PluginGetAssertionRequest,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        tracing::debug!("Received GetAssertion: {request:?}");
        let client = self.get_client()?;

        self.wait_for_connected_client(&client)?;

        // Present the window if necessary
        let is_unlocked = client
            .get_lock_status(Duration::from_secs(3))
            .is_ok_and(|response| response.is_unlocked);
        let needs_ui = needs_ui_for_assertion(is_unlocked, request.allow_credentials().count());
        if needs_ui {
            present_window(client.as_ref())?
        }

        let (cancel_tx, cancel_rx) = mpsc::channel();
        let transaction_id = request.transaction_id;
        self.callbacks
            .lock()
            .expect("not poisoned")
            .insert(transaction_id, cancel_tx);

        let response = crate::assert::get_assertion(client.as_ref(), request, cancel_rx);

        // clean up callbacks
        self.callbacks
            .lock()
            .expect("not poisoned")
            .remove(&transaction_id);

        response
    }

    fn cancel_operation(
        &self,
        request: PluginCancelOperationRequest,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let transaction_id = request.transaction_id();
        tracing::debug!(?transaction_id, "Received CancelOperation");

        if let Some(cancellation_token) = self
            .callbacks
            .lock()
            .expect("not poisoned")
            .get(&transaction_id)
        {
            _ = cancellation_token.send(());
            let client = self.get_client()?;
            let context = create_context_string(transaction_id, request.operation_request_hash());
            tracing::debug!("Sending cancel operation for context: {context}");
            client.send_native_status("cancel-operation".to_string(), context);
        }
        Ok(())
    }

    fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn std::error::Error>> {
        // If the IPC pipe is not open, then the client is not open and must be locked/logged out.
        if !self.connector.is_available() {
            return Ok(PluginLockStatus::PluginLocked);
        }
        let client = self.get_client()?;
        if let ConnectionStatus::Disconnected = client.get_connection_status() {
            return Ok(PluginLockStatus::PluginLocked);
        }

        client
            .get_lock_status(Duration::from_secs(3))
            .map(|response| {
                if response.is_unlocked {
                    PluginLockStatus::PluginUnlocked
                } else {
                    PluginLockStatus::PluginLocked
                }
            })
            .or_else(|err| {
                tracing::error!(%err, "Failed to retrieve lock status, returning locked");
                Ok(PluginLockStatus::PluginLocked)
            })
    }
}

/// Returns true when the authenticator needs to show UI for a get-assertion
/// request: either because the vault is locked or because the caller hasn't
/// pre-selected a single credential (which requires a picker dialog).
fn needs_ui_for_assertion(is_unlocked: bool, allowed_credential_count: usize) -> bool {
    !is_unlocked || allowed_credential_count != 1
}

/// Retrieves the window handle over IPC and puts it in the foreground.
fn present_window<C: IpcClient>(client: &C) -> Result<(), Box<dyn Error>> {
    unsafe {
        let window_handle_response = client.get_window_handle(Duration::from_secs(30))?;
        let plugin_window: WindowDetails = window_handle_response.try_into()?;
        let dw_current_thread = GetCurrentThreadId();
        let dw_fg_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
        let result = AttachThreadInput(dw_current_thread, dw_fg_thread, true);
        tracing::debug!("AttachThreadInput() - attach? {result:?}");
        let result = BringWindowToTop(plugin_window.handle);
        tracing::debug!("BringWindowToTop? {result:?}");
        let result = AttachThreadInput(dw_current_thread, dw_fg_thread, false);
        tracing::debug!("AttachThreadInput() - detach? {result:?}");
        Ok(())
    }
}

#[derive(Debug)]
struct WindowDetails {
    _is_visible: bool,
    _is_focused: bool,
    handle: HWND,
}

impl TryFrom<WindowHandleQueryResponse> for WindowDetails {
    type Error = String;

    fn try_from(value: WindowHandleQueryResponse) -> Result<Self, Self::Error> {
        unsafe {
            // SAFETY: We check to make sure that the vec is the expected size
            // before converting it. If the handle is invalid when passed to
            // Windows, the request will be rejected.
            let handle = if value.handle.len() == size_of::<HWND>() {
                ptr::read_unaligned(value.handle.as_ptr().cast())
            } else {
                return Err(format!(
                    "Invalid window handle received: {:?}",
                    value.handle
                ));
            };
            Ok(Self {
                _is_visible: value.is_visible,
                _is_focused: value.is_focused,
                handle,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};

    use autofill_provider::{
        ConnectionStatus, LockStatusResponse, PasskeyAssertionRequest,
        PasskeyAssertionWithoutUserInterfaceRequest, PasskeyRegistrationRequest,
        PreparePasskeyAssertionCallback, PreparePasskeyRegistrationCallback,
        WindowHandleQueryResponse,
    };

    use super::*;
    use crate::ipc::{IpcClient, IpcConnector};

    // -----------------------------------------------------------------------
    // Mock IPC client
    // -----------------------------------------------------------------------

    /// Returns `Connected` after `connected_after` calls, `Connecting` before.
    /// Use `connected_after = usize::MAX` to simulate an never-connecting client.
    /// Use `connected_after = 0` for one that is immediately connected.
    fn status_fn(connected_after: usize) -> Arc<dyn Fn() -> ConnectionStatus + Send + Sync> {
        let n = Arc::new(AtomicUsize::new(0));
        Arc::new(move || {
            if n.fetch_add(1, Ordering::Relaxed) >= connected_after {
                ConnectionStatus::Connected
            } else {
                ConnectionStatus::Connecting
            }
        })
    }

    fn disconnected_fn() -> Arc<dyn Fn() -> ConnectionStatus + Send + Sync> {
        Arc::new(|| ConnectionStatus::Disconnected)
    }

    struct MockIpcClient {
        get_status: Arc<dyn Fn() -> ConnectionStatus + Send + Sync>,
        /// `Some(true)` = unlocked, `Some(false)` = locked, `None` = error
        lock_unlocked: Option<bool>,
        sent: Arc<Mutex<Vec<(String, String)>>>,
    }

    impl MockIpcClient {
        fn new(
            get_status: Arc<dyn Fn() -> ConnectionStatus + Send + Sync>,
            lock_unlocked: Option<bool>,
            sent: Arc<Mutex<Vec<(String, String)>>>,
        ) -> Self {
            Self {
                get_status,
                lock_unlocked,
                sent,
            }
        }
    }

    impl IpcClient for MockIpcClient {
        fn get_connection_status(&self) -> ConnectionStatus {
            (self.get_status)()
        }

        fn get_lock_status(&self, _timeout: Duration) -> Result<LockStatusResponse, String> {
            match self.lock_unlocked {
                Some(is_unlocked) => Ok(LockStatusResponse { is_unlocked }),
                None => Err("mock: lock status unavailable".to_string()),
            }
        }

        fn get_window_handle(
            &self,
            _timeout: Duration,
        ) -> Result<WindowHandleQueryResponse, String> {
            Ok(WindowHandleQueryResponse {
                is_visible: true,
                is_focused: false,
                handle: vec![0u8; size_of::<HWND>()],
            })
        }

        fn send_native_status(&self, key: String, value: String) {
            self.sent.lock().unwrap().push((key, value));
        }

        fn prepare_passkey_registration(
            &self,
            _req: PasskeyRegistrationRequest,
            _cb: Arc<dyn PreparePasskeyRegistrationCallback>,
        ) {
            unimplemented!("not needed in these tests")
        }

        fn prepare_passkey_assertion(
            &self,
            _req: PasskeyAssertionRequest,
            _cb: Arc<dyn PreparePasskeyAssertionCallback>,
        ) {
            unimplemented!("not needed in these tests")
        }

        fn prepare_passkey_assertion_without_user_interface(
            &self,
            _req: PasskeyAssertionWithoutUserInterfaceRequest,
            _cb: Arc<dyn PreparePasskeyAssertionCallback>,
        ) {
            unimplemented!("not needed in these tests")
        }
    }

    // -----------------------------------------------------------------------
    // Mock connector
    // -----------------------------------------------------------------------

    struct MockConnector {
        /// `is_available()` returns true once this many calls have been made.
        available_after: usize,
        avail_calls: AtomicUsize,
        pub launches: AtomicUsize,
        pub sleeps: AtomicUsize,
        // Configuration forwarded to each client created by connect()
        client_status_fn: Arc<dyn Fn() -> ConnectionStatus + Send + Sync>,
        client_lock_unlocked: Option<bool>,
        pub client_sent: Arc<Mutex<Vec<(String, String)>>>,
    }

    impl MockConnector {
        /// IPC is immediately available; the connected client reports `lock_unlocked`.
        fn available(lock_unlocked: Option<bool>) -> Self {
            Self {
                available_after: 0,
                avail_calls: AtomicUsize::new(0),
                launches: AtomicUsize::new(0),
                sleeps: AtomicUsize::new(0),
                client_status_fn: status_fn(0),
                client_lock_unlocked: lock_unlocked,
                client_sent: Arc::new(Mutex::new(vec![])),
            }
        }

        /// IPC becomes available after `n` calls to `is_available()`.
        fn available_after(n: usize) -> Self {
            Self {
                available_after: n,
                avail_calls: AtomicUsize::new(0),
                launches: AtomicUsize::new(0),
                sleeps: AtomicUsize::new(0),
                client_status_fn: status_fn(0),
                client_lock_unlocked: None,
                client_sent: Arc::new(Mutex::new(vec![])),
            }
        }

        /// IPC is never available.
        fn unavailable() -> Self {
            Self::available_after(usize::MAX)
        }

        /// Set the connection status sequence for clients produced by `connect()`.
        fn with_client_status(
            mut self,
            f: Arc<dyn Fn() -> ConnectionStatus + Send + Sync>,
        ) -> Self {
            self.client_status_fn = f;
            self
        }
    }

    impl IpcConnector for MockConnector {
        type Client = MockIpcClient;

        fn is_available(&self) -> bool {
            self.avail_calls.fetch_add(1, Ordering::Relaxed) >= self.available_after
        }

        fn connect(&self) -> MockIpcClient {
            MockIpcClient::new(
                Arc::clone(&self.client_status_fn),
                self.client_lock_unlocked,
                Arc::clone(&self.client_sent),
            )
        }

        fn launch_desktop_app(&self) {
            self.launches.fetch_add(1, Ordering::Relaxed);
        }

        fn sleep(&self, _: Duration) {
            self.sleeps.fetch_add(1, Ordering::Relaxed);
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    fn make_authenticator<C: IpcConnector>(connector: C) -> BitwardenPluginAuthenticator<C> {
        BitwardenPluginAuthenticator {
            connector,
            client: Mutex::new(None),
            callbacks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn prepopulate_client<C: IpcConnector>(
        auth: &BitwardenPluginAuthenticator<C>,
        client: C::Client,
    ) {
        *auth.client.lock().unwrap() = Some(Arc::new(client));
    }

    // -----------------------------------------------------------------------
    // do_connect tests
    // -----------------------------------------------------------------------

    #[test]
    fn do_connect_succeeds_immediately_when_ipc_available() {
        let connector = MockConnector::available(None);
        let auth = make_authenticator(connector);
        assert!(auth.do_connect().is_ok());
        assert_eq!(auth.connector.sleeps.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn do_connect_sleeps_until_ipc_becomes_available() {
        // is_available() returns false for the first 3 calls, then true
        let connector = MockConnector::available_after(3);
        let auth = make_authenticator(connector);
        assert!(auth.do_connect().is_ok());
        assert_eq!(auth.connector.sleeps.load(Ordering::Relaxed), 3);
    }

    #[test]
    fn do_connect_launches_app_only_on_first_unavailable_attempt() {
        let connector = MockConnector::available_after(3);
        let auth = make_authenticator(connector);
        auth.do_connect().unwrap();
        assert_eq!(auth.connector.launches.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn do_connect_returns_error_after_twenty_unavailable_attempts() {
        let connector = MockConnector::unavailable();
        let auth = make_authenticator(connector);
        let Err(err) = auth.do_connect() else {
            panic!("Expected error, received Ok(...)");
        };
        assert!(err.contains("Timed out"), "error was: {err}");
        assert_eq!(auth.connector.sleeps.load(Ordering::Relaxed), 20);
    }

    // -----------------------------------------------------------------------
    // wait_for_connected_client tests
    // -----------------------------------------------------------------------

    #[test]
    fn wait_for_connected_client_returns_ok_when_immediately_connected() {
        let connector = MockConnector::available(None);
        let auth = make_authenticator(connector);
        let client = Arc::new(auth.connector.connect());
        assert!(auth.wait_for_connected_client(&client).is_ok());
        assert_eq!(auth.connector.sleeps.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn wait_for_connected_client_polls_until_connected() {
        // Client is Connecting for 5 calls, then Connected
        let connector = MockConnector::available(None).with_client_status(status_fn(5));
        let auth = make_authenticator(connector);
        let client = Arc::new(auth.connector.connect());
        assert!(auth.wait_for_connected_client(&client).is_ok());
        assert_eq!(auth.connector.sleeps.load(Ordering::Relaxed), 5);
    }

    #[test]
    fn wait_for_connected_client_times_out_after_fifty_attempts() {
        let connector = MockConnector::available(None).with_client_status(status_fn(usize::MAX));
        let auth = make_authenticator(connector);
        let client = Arc::new(auth.connector.connect());
        let err = auth.wait_for_connected_client(&client).unwrap_err();
        assert!(err.contains("Timed out"), "error was: {err}");
        assert_eq!(auth.connector.sleeps.load(Ordering::Relaxed), 50);
        // client field must be cleared so the next call triggers a fresh reconnect
        assert!(auth.client.lock().unwrap().is_none());
    }

    // -----------------------------------------------------------------------
    // get_client tests
    // -----------------------------------------------------------------------

    #[test]
    fn get_client_connects_when_no_client_exists() {
        let auth = make_authenticator(MockConnector::available(None));
        assert!(auth.get_client().is_ok());
        assert!(auth.client.lock().unwrap().is_some());
    }

    #[test]
    fn get_client_reuses_existing_connected_client() {
        let connector = MockConnector::available(None);
        let sent = Arc::clone(&connector.client_sent);
        let auth = make_authenticator(connector);
        // Pre-populate with a connected client
        prepopulate_client(
            &auth,
            MockIpcClient::new(status_fn(0), None, Arc::clone(&sent)),
        );
        let c1 = auth.get_client().unwrap();
        let c2 = auth.get_client().unwrap();
        assert!(Arc::ptr_eq(&c1, &c2), "should return the same Arc");
    }

    #[test]
    fn get_client_reuses_existing_connecting_client() {
        let connector = MockConnector::available(None);
        let sent = Arc::clone(&connector.client_sent);
        let auth = make_authenticator(connector);
        prepopulate_client(
            &auth,
            MockIpcClient::new(
                Arc::new(|| ConnectionStatus::Connecting),
                None,
                Arc::clone(&sent),
            ),
        );
        let c1 = auth.get_client().unwrap();
        let c2 = auth.get_client().unwrap();
        assert!(Arc::ptr_eq(&c1, &c2));
    }

    #[test]
    fn get_client_reconnects_after_disconnected_client() {
        let connector = MockConnector::available(None);
        let sent = Arc::clone(&connector.client_sent);
        let auth = make_authenticator(connector);
        // Pre-populate with a disconnected client
        prepopulate_client(
            &auth,
            MockIpcClient::new(disconnected_fn(), None, Arc::clone(&sent)),
        );
        // get_client should detect Disconnected, clear the old client, and reconnect
        assert!(auth.get_client().is_ok());
    }

    // -----------------------------------------------------------------------
    // lock_status tests
    // -----------------------------------------------------------------------

    #[test]
    fn lock_status_returns_locked_when_ipc_unavailable() {
        let auth = make_authenticator(MockConnector::unavailable());
        let status = auth.lock_status().unwrap();
        assert!(matches!(status, PluginLockStatus::PluginLocked));
    }

    #[test]
    fn lock_status_returns_locked_when_client_is_disconnected() {
        let connector = MockConnector::available(None).with_client_status(disconnected_fn());
        let auth = make_authenticator(connector);
        // do_connect succeeds (is_available = true) but the resulting client is Disconnected
        let status = auth.lock_status().unwrap();
        assert!(matches!(status, PluginLockStatus::PluginLocked));
    }

    #[test]
    fn lock_status_returns_unlocked_when_vault_is_unlocked() {
        let auth = make_authenticator(MockConnector::available(Some(true)));
        let status = auth.lock_status().unwrap();
        assert!(matches!(status, PluginLockStatus::PluginUnlocked));
    }

    #[test]
    fn lock_status_returns_locked_when_vault_is_locked() {
        let auth = make_authenticator(MockConnector::available(Some(false)));
        let status = auth.lock_status().unwrap();
        assert!(matches!(status, PluginLockStatus::PluginLocked));
    }

    #[test]
    fn lock_status_falls_back_to_locked_on_ipc_error() {
        // lock_unlocked = None → get_lock_status returns Err
        let auth = make_authenticator(MockConnector::available(None));
        let status = auth.lock_status().unwrap();
        assert!(matches!(status, PluginLockStatus::PluginLocked));
    }

    // -----------------------------------------------------------------------
    // needs_ui_for_assertion tests
    // -----------------------------------------------------------------------

    #[test]
    fn unlocked_vault_with_one_credential_skips_ui() {
        assert!(!needs_ui_for_assertion(true, 1));
    }

    #[test]
    fn locked_vault_always_requires_ui() {
        assert!(needs_ui_for_assertion(false, 1));
        assert!(needs_ui_for_assertion(false, 0));
        assert!(needs_ui_for_assertion(false, 2));
    }

    #[test]
    fn unlocked_vault_with_zero_credentials_requires_ui() {
        assert!(needs_ui_for_assertion(true, 0));
    }

    #[test]
    fn unlocked_vault_with_multiple_credentials_requires_ui() {
        assert!(needs_ui_for_assertion(true, 2));
        assert!(needs_ui_for_assertion(true, 10));
    }

    // -----------------------------------------------------------------------
    // WindowDetails::try_from tests
    // -----------------------------------------------------------------------

    fn make_window_response(handle: Vec<u8>) -> WindowHandleQueryResponse {
        WindowHandleQueryResponse {
            is_visible: true,
            is_focused: false,
            handle,
        }
    }

    #[test]
    fn try_from_accepts_correctly_sized_handle() {
        let handle_bytes = vec![0u8; size_of::<HWND>()];
        assert!(WindowDetails::try_from(make_window_response(handle_bytes)).is_ok());
    }

    #[test]
    fn try_from_rejects_empty_handle() {
        let result = WindowDetails::try_from(make_window_response(vec![]));
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid window handle"));
    }

    #[test]
    fn try_from_rejects_undersized_handle() {
        let handle_bytes = vec![0u8; size_of::<HWND>() - 1];
        assert!(WindowDetails::try_from(make_window_response(handle_bytes)).is_err());
    }

    #[test]
    fn try_from_rejects_oversized_handle() {
        let handle_bytes = vec![0u8; size_of::<HWND>() + 1];
        assert!(WindowDetails::try_from(make_window_response(handle_bytes)).is_err());
    }
}
