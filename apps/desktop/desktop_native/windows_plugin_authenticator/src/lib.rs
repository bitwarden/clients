#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]

// New modular structure
mod assert;
mod ipc2;
mod make_credential;
mod types;
mod util;

use std::{
    collections::{HashMap, HashSet},
    mem::MaybeUninit,
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
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
    Win32::{
        Foundation::HWND,
        System::Threading::{AttachThreadInput, GetCurrentThreadId},
        UI::WindowsAndMessaging::{
            AllowSetForegroundWindow, BringWindowToTop, GetForegroundWindow,
            GetWindowThreadProcessId,
        },
    },
};

use crate::ipc2::{ConnectionStatus, LockStatusResponse, TimedCallback, WindowsProviderClient};

// Re-export main functionality
pub use types::UserVerificationRequirement;

const AUTHENTICATOR_NAME: &str = "Bitwarden Desktop";
const RPID: &str = "bitwarden.com";
const CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";
const AAGUID: &str = "d548826e-79b4-db40-a3d8-11116f7e8349";
const LOGO_SVG: &str = r##"<svg version="1.1" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><path fill="#175ddc" d="M300 253.125C300 279.023 279.023 300 253.125 300H46.875C20.9766 300 0 279.023 0 253.125V46.875C0 20.9766 20.9766 0 46.875 0H253.125C279.023 0 300 20.9766 300 46.875V253.125Z"/><path fill="#fff" d="M243.105 37.6758C241.201 35.7715 238.945 34.834 236.367 34.834H63.6328C61.0254 34.834 58.7988 35.7715 56.8945 37.6758C54.9902 39.5801 54.0527 41.8359 54.0527 44.4141V159.58C54.0527 168.164 55.7227 176.689 59.0625 185.156C62.4023 193.594 66.5625 201.094 71.5137 207.656C76.4648 214.189 82.3535 220.576 89.209 226.787C96.0645 232.998 102.393 238.125 108.164 242.227C113.965 246.328 120 250.195 126.299 253.857C132.598 257.52 137.08 259.98 139.717 261.27C142.354 262.559 144.492 263.584 146.074 264.258C147.275 264.844 148.564 265.166 149.971 265.166C151.377 265.166 152.666 264.873 153.867 264.258C155.479 263.555 157.588 262.559 160.254 261.27C162.891 259.98 167.373 257.49 173.672 253.857C179.971 250.195 186.006 246.328 191.807 242.227C197.607 238.125 203.936 232.969 210.791 226.787C217.646 220.576 223.535 214.219 228.486 207.656C233.438 201.094 237.568 193.623 240.938 185.156C244.277 176.719 245.947 168.193 245.947 159.58V44.4434C245.977 41.8359 245.01 39.5801 243.105 37.6758ZM220.84 160.664C220.84 202.354 150 238.271 150 238.271V59.502H220.84C220.84 59.502 220.84 118.975 220.84 160.664Z"/></svg>"##;

/// Handles initialization and registration for the Bitwarden desktop app as a
/// For now, also adds the authenticator
pub fn register() -> std::result::Result<(), String> {
    // TODO: Can we spawn a new named thread for debugging?
    tracing::debug!("register() called...");

    let r = WebAuthnPlugin::initialize();
    tracing::debug!(
        "Initialized the com library with WebAuthnPlugin::initialize(): {:?}",
        r
    );

    let clsid = CLSID.try_into().expect("valid GUID string");
    let plugin = WebAuthnPlugin::new(clsid);

    let r = plugin.register_server(BitwardenPluginAuthenticator {
        client: Mutex::new(None),
        callbacks: Arc::new(Mutex::new(HashMap::new())),
    });
    tracing::debug!("Registered the com library: {:?}", r);

    tracing::debug!("Parsing authenticator options");
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

struct BitwardenPluginAuthenticator {
    /// Client to communicate with desktop app over IPC.
    client: Mutex<Option<Arc<WindowsProviderClient>>>,

    /// Map of transaction IDs to cancellation tokens
    callbacks: Arc<Mutex<HashMap<GUID, Sender<()>>>>,
}

impl BitwardenPluginAuthenticator {
    fn get_client(&self) -> Arc<WindowsProviderClient> {
        tracing::debug!("Connecting to client via IPC");
        let mut client = self.client.lock().unwrap();
        match client.as_ref().map(|c| (c, c.get_connection_status())) {
            Some((_, ConnectionStatus::Disconnected)) | None => {
                tracing::debug!("Connecting to desktop app");
                let c = WindowsProviderClient::connect();
                tracing::debug!("Connected to client via IPC successfully");
                _ = client.insert(Arc::new(c));
            }
            _ => {}
        };
        client.as_ref().unwrap().clone()
    }
}

impl PluginAuthenticator for BitwardenPluginAuthenticator {
    fn make_credential(
        &self,
        request: PluginMakeCredentialRequest,
    ) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        tracing::debug!("Received MakeCredential: {request:?}");
        let client = self.get_client();

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
        let client_hwnd = request.window_handle;
        let response = make_credential::make_credential(&client, request, cancel_rx);
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
        let client = self.get_client();

        let is_unlocked = get_lock_status(&client).map_or(false, |response| response.is_unlocked);
        // Don't mess with the window unless we're going to need it: if the
        // vault is locked or if we need to show credential selection dialog.
        let needs_ui = !is_unlocked || request.allow_credentials().cCredentials != 1;
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
        let response = assert::get_assertion(&client, request, cancel_rx);
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
            let client = self.get_client();
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
        get_lock_status(&self.get_client())
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
    tracing::debug!("Get Window Handle!");
    let window_handle_callback = Arc::new(TimedCallback::new());
    client.get_window_handle(window_handle_callback.clone());
    let response = window_handle_callback
        .wait_for_response(Duration::from_secs(3), None)
        .unwrap()
        .unwrap();
    tracing::debug!("Got Window Handle: {response:?}");
    response.try_into()
}

struct WindowDetails {
    is_visible: bool,
    is_focused: bool,
    handle: HWND,
}
