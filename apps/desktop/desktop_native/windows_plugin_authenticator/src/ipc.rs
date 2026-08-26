use std::{sync::Arc, time::Duration};

use autofill_provider::{
    AutofillProviderClient, ConnectionStatus, LockStatusResponse, PasskeyAssertionRequest,
    PasskeyAssertionWithoutUserInterfaceRequest, PasskeyRegistrationRequest,
    PreparePasskeyAssertionCallback, PreparePasskeyRegistrationCallback, TimedCallback,
    WindowHandleQueryResponse,
};

/// Abstraction over an active IPC connection to the desktop app.
///
/// All methods mirror the corresponding methods on [`AutofillProviderClient`].
/// The blocking variants of `get_lock_status` and `get_window_handle` embed the
/// `TimedCallback` polling that would otherwise be done at each call site,
/// keeping the callback trait types internal to this module.
pub(crate) trait IpcClient: Send + Sync {
    fn get_connection_status(&self) -> ConnectionStatus;

    /// Request the desktop client's lock status, blocking until a response
    /// arrives or `timeout` elapses.
    fn get_lock_status(&self, timeout: Duration) -> Result<LockStatusResponse, String>;

    /// Request the desktop client's native window handle, blocking until a
    /// response arrives or `timeout` elapses.
    fn get_window_handle(&self, timeout: Duration) -> Result<WindowHandleQueryResponse, String>;

    /// Request that the provider sync its credentials to the OS autofill store.
    fn send_native_status(&self, key: String, value: String);

    /// Cancel an ongoing request.
    fn cancel_request(&self, context: String);

    fn prepare_passkey_registration(
        &self,
        request: PasskeyRegistrationRequest,
        callback: Arc<dyn PreparePasskeyRegistrationCallback>,
    );

    fn prepare_passkey_assertion(
        &self,
        request: PasskeyAssertionRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    );

    fn prepare_passkey_assertion_without_user_interface(
        &self,
        request: PasskeyAssertionWithoutUserInterfaceRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    );
}

/// Newtype wrapper around [`AutofillProviderClient`] that implements
/// [`IpcClient`].  Using a newtype avoids method-name collisions between the
/// inherent methods on `AutofillProviderClient` (which take callback objects)
/// and the blocking trait methods defined above.
pub(crate) struct RealIpcClient(pub(crate) AutofillProviderClient);

impl IpcClient for RealIpcClient {
    fn get_connection_status(&self) -> ConnectionStatus {
        self.0.get_connection_status()
    }

    fn get_lock_status(&self, timeout: Duration) -> Result<LockStatusResponse, String> {
        let callback = Arc::new(TimedCallback::new());
        self.0.get_lock_status(callback.clone());
        match callback.wait_for_response(timeout, None) {
            Ok(Ok(response)) => Ok(response),
            Ok(Err(err)) => Err(format!("GetLockStatus() call failed: {err}")),
            Err(_) => Err("GetLockStatus() call timed out".to_string()),
        }
    }

    fn get_window_handle(&self, timeout: Duration) -> Result<WindowHandleQueryResponse, String> {
        let callback = Arc::new(TimedCallback::new());
        self.0.get_window_handle(callback.clone());
        callback
            .wait_for_response(timeout, None)
            .map_err(|err| format!("Callback failed waiting for a window handle: {err}"))?
            .map_err(|err| format!("Failed to get window details: {err}"))
    }

    fn send_native_status(&self, key: String, value: String) {
        self.0.send_native_status(key, value)
    }

    fn cancel_request(&self, context: String) {
        self.0.cancel_request(context)
    }

    fn prepare_passkey_registration(
        &self,
        request: PasskeyRegistrationRequest,
        callback: Arc<dyn PreparePasskeyRegistrationCallback>,
    ) {
        self.0.prepare_passkey_registration(request, callback)
    }

    fn prepare_passkey_assertion(
        &self,
        request: PasskeyAssertionRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.0.prepare_passkey_assertion(request, callback)
    }

    fn prepare_passkey_assertion_without_user_interface(
        &self,
        request: PasskeyAssertionWithoutUserInterfaceRequest,
        callback: Arc<dyn PreparePasskeyAssertionCallback>,
    ) {
        self.0
            .prepare_passkey_assertion_without_user_interface(request, callback)
    }
}

/// Factory + I/O operations that `BitwardenPluginAuthenticator` needs when
/// (re-)connecting to the desktop app.  Separating these from [`IpcClient`]
/// lets tests inject a no-op connector that never touches real IPC or Windows
/// APIs.
pub(crate) trait IpcConnector: Send + Sync + 'static {
    type Client: IpcClient + 'static;

    /// Whether the IPC server socket is currently available for connection.
    fn is_available(&self) -> bool;

    /// Open a new connection and return the client.
    fn connect(&self) -> Self::Client;

    /// Launch the Bitwarden desktop app via its custom URI scheme so it can
    /// open the IPC socket.
    fn launch_desktop_app(&self);

    /// Sleep the calling thread.  Tests override this to be a no-op so
    /// polling loops run instantly.
    fn sleep(&self, duration: Duration) {
        std::thread::sleep(duration);
    }
}

/// Production [`IpcConnector`] that delegates to the real Windows APIs and
/// `AutofillProviderClient`.
pub(crate) struct RealIpcConnector;

impl IpcConnector for RealIpcConnector {
    type Client = RealIpcClient;

    fn is_available(&self) -> bool {
        AutofillProviderClient::is_available()
    }

    fn connect(&self) -> RealIpcClient {
        RealIpcClient(AutofillProviderClient::connect())
    }

    fn launch_desktop_app(&self) {
        use windows::{core::HSTRING, Foundation::Uri, System::Launcher};
        let uri = Uri::CreateUri(&HSTRING::from("bitwarden://webauthn")).expect("valid URI");
        _ = Launcher::LaunchUriAsync(&uri);
    }
}
