#![cfg(target_os = "windows")]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#![windows_subsystem = "windows"]

// New modular structure
mod assert;
mod ipc2;
mod make_credential;
mod types;
mod util;

use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::{
        mpsc::{self, Sender},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};

use base64::engine::{general_purpose::STANDARD, Engine as _};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
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
            BringWindowToTop, DispatchMessageA, GetForegroundWindow, GetMessageA,
            GetWindowThreadProcessId, TranslateMessage,
        },
    },
};
use windows_core::HSTRING;
use windows_plugin_authenticator::{AAGUID, AUTHENTICATOR_NAME, CLSID, LOGO_SVG, RPID};

use crate::ipc2::{ConnectionStatus, LockStatusResponse, TimedCallback, WindowsProviderClient};

// Re-export main functionality
pub use types::UserVerificationRequirement;

/// Handles initialization and registration for the Bitwarden desktop app as a
/// For now, also adds the authenticator
fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Set the custom panic hook
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        default_hook(panic_info); // Call the default hook to print the panic message

        // Only pause if not running in a debugger, etc.
        // On Windows, if the process is a console app, stdin/stdout might work differently
        // when launched from Explorer vs a terminal.

        println!("\nProgram panicked! Press Enter to exit...");
        std::io::stdin()
            .read_line(&mut String::new())
            .expect("Failed to read line");
    }));

    // the log level hierarchy is determined by:
    //    - if RUST_LOG is detected at runtime
    //    - if RUST_LOG is provided at compile time
    //    - default to INFO
    let filter = EnvFilter::builder()
        .with_default_directive(
            option_env!("RUST_LOG")
                .unwrap_or("info")
                .parse()
                .expect("should provide valid log level at compile time."),
        )
        // parse directives from the RUST_LOG environment variable,
        // overriding the default directive for matching targets.
        .from_env_lossy();

    let app_data_path = std::env::var("BITWARDEN_APPDATA_DIR")
        .or_else(|_| std::env::var("PORTABLE_EXECUTABLE_DIR"))
        .map_or_else(
            |_| {
                [
                    &std::env::var("APPDATA").expect("%APPDATA% to be defined"),
                    "Bitwarden",
                ]
                .iter()
                .collect()
            },
            PathBuf::from,
        );

    let file_appender = RollingFileAppender::builder()
        .rotation(Rotation::NEVER)
        .filename_prefix("passkey_plugin")
        .filename_suffix("log")
        .build(app_data_path)?; // TODO: should we allow continuing if we can't log?
    let (writer, _guard) = tracing_appender::non_blocking(file_appender);

    // With the `tracing-log` feature enabled for the `tracing_subscriber`,
    // the registry below will initialize a log compatibility layer, which allows
    // the subscriber to consume log::Records as though they were tracing Events.
    // https://docs.rs/tracing-subscriber/latest/tracing_subscriber/util/trait.SubscriberInitExt.html#method.init
    let log_file_layer = tracing_subscriber::fmt::layer()
        .with_writer(writer)
        .with_ansi(false);
    tracing_subscriber::registry()
        .with(filter)
        .with(log_file_layer)
        .try_init()?;
    let args: Vec<String> = std::env::args().collect();
    tracing::debug!("Launched with arguments: {args:?}");
    let command = args.get(1).map(|s| s.as_str());
    match command {
        Some("add") => add_authenticator()?,
        Some("serve") => run_server()?,
        Some(invalid) => {
            tracing::error!(
                "Invalid command argument passed: {invalid}. Specify one of [add, serve]"
            );
            return Err(format!(
                "No command argument passed: {invalid}. Specify one of [add, serve]"
            ))?;
        }
        None => {
            tracing::error!("No command argument passed. Specify one of [add, serve]");
            return Err("No command argument passed. Specify one of [add, serve]")?;
        }
    };
    tracing::debug!("Starting loop");

    loop {
        let mut msg_ptr = std::mem::MaybeUninit::uninit();
        unsafe {
            GetMessageA(msg_ptr.as_mut_ptr(), None, 0, 0)
                .ok()
                .inspect_err(|err| {
                    tracing::error!("Received error while waiting for message: {err}")
                })?;
            tracing::debug!("Received message, dispatching");
            let msg = msg_ptr.assume_init_ref();
            let result = TranslateMessage(msg);
            tracing::debug!("Message translated? {result:?}");
            let result = DispatchMessageA(msg);
            tracing::debug!("Received result from message handler: {result:?}");
        }
    }
}

fn add_authenticator() -> Result<(), String> {
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

fn run_server() -> Result<(), String> {
    tracing::debug!("Setting up COM server");
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
        let client = self.get_client()?;

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
    is_visible: bool,
    is_focused: bool,
    handle: HWND,
}
