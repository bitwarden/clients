use std::{
    collections::{HashMap, HashSet},
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use base64::engine::{general_purpose::STANDARD, Engine as _};
use win_webauthn::{
    plugin::{
        PluginAddAuthenticatorOptions, PluginAuthenticator, PluginCancelOperationRequest,
        PluginGetAssertionRequest, PluginLockStatus, PluginMakeCredentialRequest, WebAuthnPlugin,
    },
    AuthenticatorInfo, CtapVersion, PublicKeyCredentialParameters,
};
use windows::{
    core::GUID,
    Foundation::Uri,
    System::Launcher,
    Win32::{
        Foundation::HWND,
        System::Threading::{AttachThreadInput, GetCurrentThreadId},
        UI::WindowsAndMessaging::{
            BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId,
        },
    },
};
use windows_core::HSTRING;
use windows_plugin_authenticator::{AAGUID, AUTHENTICATOR_NAME, CLSID, LOGO_SVG, RPID};

use crate::ipc2::{
    ConnectionStatus, LockStatusResponse, TimedCallback, WindowHandleQueryResponse,
    WindowsProviderClient,
};

pub(super) fn add_authenticator() -> Result<(), String> {
    tracing::debug!("register() called...");
    let clsid = CLSID.try_into().expect("valid GUID string");
    let aaguid = AAGUID
        .try_into()
        .map_err(|err| format!("Invalid AAGUID `{AAGUID}`: {err}"))?;
    let options = PluginAddAuthenticatorOptions {
        authenticator_name: AUTHENTICATOR_NAME.to_string(),
        clsid,
        rp_id: Some(RPID.to_string()),
        light_theme_logo_svg: Some(LOGO_SVG.to_string()),
        dark_theme_logo_svg: Some(LOGO_SVG.to_string()),
        authenticator_info: AuthenticatorInfo {
            versions: HashSet::from([CtapVersion::Fido2_0, CtapVersion::Fido2_1]),
            aaguid: aaguid,
            options: Some(HashSet::from([
                "rk".to_string(),
                "up".to_string(),
                "uv".to_string(),
            ])),
            transports: Some(HashSet::from([
                "internal".to_string(),
                "hybrid".to_string(),
            ])),
            algorithms: Some(vec![PublicKeyCredentialParameters {
                alg: -7,
                typ: "public-key".to_string(),
            }]),
        },
        supported_rp_ids: None,
    };
    let response = WebAuthnPlugin::add_authenticator(options);
    tracing::debug!("Added the authenticator: {response:?}");
    Ok(())
}

pub(super) fn run_server() -> Result<(), String> {
    tracing::debug!("Setting up COM server");

    let clsid = CLSID.try_into().expect("valid GUID string");
    let plugin = WebAuthnPlugin::new(clsid);

    let r = plugin
        .register_server(BitwardenPluginAuthenticator {
            client: Mutex::new(None),
            callbacks: Arc::new(Mutex::new(HashMap::new())),
        })
        .map_err(|err| err.to_string())?;
    tracing::debug!("Registered the com library: {:?}", r);
    Ok(())
}

struct BitwardenPluginAuthenticator {
    /// Client to communicate with desktop app over IPC.
    client: Mutex<Option<Arc<WindowsProviderClient>>>,

    /// Map of transaction IDs to cancellation tokens
    callbacks: Arc<Mutex<HashMap<GUID, Sender<()>>>>,
}

impl BitwardenPluginAuthenticator {
    fn get_client(&self) -> Result<Arc<WindowsProviderClient>, String> {
        // 20 * 200ms = 4 seconds.
        for i in 1..=20 {
            tracing::debug!("Connecting to client via IPC, attempt {i}");
            let mut client = self.client.lock().unwrap();
            match client.as_ref().map(|c| (c, c.get_connection_status())) {
                Some((_, ConnectionStatus::Disconnected)) | None => {
                    tracing::debug!("Connecting to desktop app");
                    // Attempt to launch, and retry for IPC availability in a loop.
                    if !WindowsProviderClient::is_available() {
                        if i == 1 {
                            let uri = Uri::CreateUri(&HSTRING::from("bitwarden://webauthn"))
                                .expect("valid URI");
                            _ = Launcher::LaunchUriAsync(&uri);
                        }
                        let wait_time = Duration::from_millis(200);
                        tracing::debug!(
                            "Launching main client, trying again to connect to IPC in {wait_time:?}"
                        );
                        thread::sleep(wait_time);
                        continue;
                    }
                    let c = WindowsProviderClient::connect();
                    // This isn't actually connected yet, but it should be soon since we tested that the named pipe is available.
                    // The plugin IPC client will attempt to wait for
                    // the main application's named pipe to become available in another thread.
                    tracing::debug!(
                        "Initiated IPC connection attempt. The connection should resolve later."
                    );
                    _ = client.insert(Arc::new(c));
                }
                _ => {}
            };
            return Ok(client.as_ref().unwrap().clone());
        }
        Err("Exhausted retries to connect to IPC".to_string())
    }
}

impl PluginAuthenticator for BitwardenPluginAuthenticator {
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        tracing::debug!("Received MakeCredential: {request:?}");
        let client = self.get_client()?;

        let plugin_window = get_window_details(&client)?;
        unsafe {
            let dw_current_thread = GetCurrentThreadId();
            let dw_fg_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
            let result = AttachThreadInput(dw_current_thread, dw_fg_thread, true);
            tracing::debug!("AttachThreadInput() - attach? {result:?}");
            let result = BringWindowToTop(plugin_window.handle);
            tracing::debug!("BringWindowToTop? {result:?}");
            let result = AttachThreadInput(dw_current_thread, dw_fg_thread, false);
            tracing::debug!("AttachThreadInput() - detach? {result:?}");
        };
        let (cancel_tx, cancel_rx) = mpsc::channel();
        let transaction_id = request.transaction_id;
        self.callbacks
            .lock()
            .expect("not poisoned")
            .insert(transaction_id, cancel_tx);
        let response = crate::make_credential::make_credential(&client, request, cancel_rx);
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

        let is_unlocked = get_lock_status(&client).map_or(false, |response| response.is_unlocked);
        // Don't mess with the window unless we're going to need it: if the
        // vault is locked or if we need to show credential selection dialog.

        let needs_ui = !is_unlocked || request.allow_credentials().count() != 1;
        if needs_ui {
            unsafe {
                let plugin_window = get_window_details(&client)?;
                let dw_current_thread = GetCurrentThreadId();
                let dw_fg_thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
                let result = AttachThreadInput(dw_current_thread, dw_fg_thread, true);
                tracing::debug!("AttachThreadInput() - attach? {result:?}");
                let result = BringWindowToTop(plugin_window.handle);
                tracing::debug!("BringWindowToTop? {result:?}");
                let result = AttachThreadInput(dw_current_thread, dw_fg_thread, false);
                tracing::debug!("AttachThreadInput() - detach? {result:?}");
            };
        }
        let (cancel_tx, cancel_rx) = mpsc::channel();
        let transaction_id = request.transaction_id;
        self.callbacks
            .lock()
            .expect("not poisoned")
            .insert(transaction_id, cancel_tx);
        let response = crate::assert::get_assertion(&client, request, cancel_rx);
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
            .get(&request.transaction_id())
        {
            _ = cancellation_token.send(());
            let client = self.get_client()?;
            let context = STANDARD.encode(transaction_id.to_u128().to_le_bytes().to_vec());
            tracing::debug!("Sending cancel operation for context: {context}");
            client.send_native_status("cancel-operation".to_string(), context);
        }
        Ok(())
    }

    fn lock_status(&self) -> Result<PluginLockStatus, Box<dyn std::error::Error>> {
        // If the IPC pipe is not open, then the client is not open and must be locked/logged out.
        if !WindowsProviderClient::is_available() {
            return Ok(PluginLockStatus::PluginLocked);
        }
        let client = self.get_client()?;
        get_lock_status(&client)
            .map(|response| {
                if response.is_unlocked {
                    PluginLockStatus::PluginUnlocked
                } else {
                    PluginLockStatus::PluginLocked
                }
            })
            .map_err(|err| err.into())
    }
}

fn get_lock_status(client: &WindowsProviderClient) -> Result<LockStatusResponse, String> {
    let callback = Arc::new(TimedCallback::new());
    client.get_lock_status(callback.clone());
    match callback.wait_for_response(Duration::from_secs(3), None) {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(err)) => Err(format!("GetLockStatus() call failed: {err}").into()),
        Err(_) => Err(format!("GetLockStatus() call timed out").into()),
    }
}

fn get_window_details(client: &WindowsProviderClient) -> Result<WindowDetails, String> {
    tracing::debug!("Attempting to retrieve window handle");
    let window_handle_callback = Arc::new(TimedCallback::new());
    client.get_window_handle(window_handle_callback.clone());
    let callback_response = window_handle_callback
        .wait_for_response(Duration::from_secs(30), None)
        .map_err(|err| format!("Callback failed waiting for a window handle: {err}"))?;
    let response = callback_response
        .map_err(|err| format!("Failed to get window details: {err}"))?
        .try_into();
    tracing::debug!("Got Window Handle: {response:?}");
    response
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
                *value.handle.as_ptr().cast()
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
