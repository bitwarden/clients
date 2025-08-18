use anyhow::{Result, anyhow};
use base64::{Engine as _, engine::general_purpose};
use env_logger::Target;
use log::debug;
use std::{ffi::OsString, fs::OpenOptions, ptr, sync::mpsc, time::Duration};
use windows::Win32::{
    Foundation::{HLOCAL, LocalFree},
    Security::Cryptography::{CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptUnprotectData},
};
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

use bitwarden_chromium_importer::{abe, abe_config};

// Enable this to log to a file. Debugging a system level service in any other way is not easy.
const NEED_LOGGING: bool = true;
const LOG_FILENAME: &str = "c:\\temp\\bitwarden-abe-service-log.txt";

// Generate the windows service boilerplate.
// The boilerplate contains the low-level service entry function (ffi_service_main) that parses
// incoming service arguments into Vec<OsString> and passes them to user defined service
// entry (service_main).
define_windows_service!(ffi_service_main, service_main);

// Service entry function which is called on background thread by the system with service
// parameters. There is no stdout or stderr at this point so make sure to configure the log
// output to file if needed.
fn service_main(_arguments: Vec<OsString>) {
    debug!("Service is in service_main");
    for arg in _arguments.iter() {
        debug!("Service argument: {}", arg.to_string_lossy());
    }

    if let Err(_e) = run_service() {
        // Handle the error, e.g., log it or take appropriate action
        debug!("Service failed to run: {}", _e);
    }
}

pub fn run_service() -> Result<()> {
    let rt = tokio::runtime::Runtime::new()?;
    let _guard = rt.enter();

    // Create a channel to be able to poll a stop event from the service worker loop.
    let (shutdown_tx, shutdown_rx) = mpsc::channel();

    let pipe_server = abe::start_tokio_named_pipe_server(
        abe_config::SERVICE_TO_ADMIN_PIPE_NAME,
        process_client_message,
    )?;
    debug!("Tokio named pipe server started");

    // Define system service event handler that will be receiving service events.
    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            // Notifies a service to report its current status information to the service
            // control manager. Always return NoError even if not implemented.
            ServiceControl::Interrogate => {
                debug!("Event ServiceControl::Interrogate received");
                ServiceControlHandlerResult::NoError
            }

            // Handle stop
            ServiceControl::Stop => {
                debug!("Event ServiceControl::Stop received");

                pipe_server.abort();
                debug!("Tokio named pipe server aborted");

                shutdown_tx.send(()).unwrap();
                ServiceControlHandlerResult::NoError
            }

            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    // Register system service event handler.
    // The returned status handle should be used to report service status changes to the system.
    let status_handle = service_control_handler::register(abe_config::SERVICE_NAME, event_handler)?;

    // Tell the system that service is running
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    debug!("Service is registered and running");

    loop {
        debug!("Service is running at: {:?}", std::time::SystemTime::now());

        // Poll shutdown event.
        match shutdown_rx.recv_timeout(Duration::from_secs(1)) {
            // Break the loop either upon stop or channel disconnect
            Ok(_) | Err(mpsc::RecvTimeoutError::Disconnected) => break,

            // Continue work if no events were received within the timeout
            Err(mpsc::RecvTimeoutError::Timeout) => (),
        };
    }

    // Tell the system that service has stopped.
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    Ok(())
}

fn process_client_message(message: &str) -> String {
    match decrypt_data_base64(&message) {
        Ok(plaintext) => {
            debug!("Decrypted message: {}", plaintext);
            plaintext
        }
        Err(e) => {
            debug!("Failed to decrypt message: {}", e);
            format!("!{}", e)
        }
    }
}

fn decrypt_data_base64(data_base64: &str) -> Result<String> {
    let data = general_purpose::STANDARD.decode(data_base64).map_err(|e| {
        debug!("Failed to decode base64: {}", e);
        e
    })?;

    let decrypted = decrypt_data(&data)?;
    let decrypted_base64 = general_purpose::STANDARD.encode(decrypted);

    Ok(decrypted_base64)
}

fn decrypt_data(data: &[u8]) -> Result<Vec<u8>> {
    if !data.starts_with(b"APPB") {
        debug!("Decoded data does not start with 'APPB'");
        return Err(anyhow!("Decoded data does not start with 'APPB'"));
    }

    let mut in_blob = CRYPT_INTEGER_BLOB {
        cbData: (data.len() - 4) as u32,
        pbData: data[4..].as_ptr() as *mut u8,
    };

    let mut out_blob = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: ptr::null_mut(),
    };

    let result = unsafe {
        CryptUnprotectData(
            &mut in_blob,
            Some(ptr::null_mut()),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        )
    };

    if result.is_ok() && !out_blob.pbData.is_null() && out_blob.cbData > 0 {
        let decrypted = unsafe {
            std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize).to_vec()
        };

        // Free the memory allocated by CryptUnprotectData
        unsafe { LocalFree(Some(HLOCAL(out_blob.pbData as *mut _))) };

        Ok(decrypted)
    } else {
        debug!("CryptUnprotectData failed");
        Err(anyhow!("CryptUnprotectData failed"))
    }
}

fn main() {
    if NEED_LOGGING {
        colog::default_builder()
            .filter_level(log::STATIC_MAX_LEVEL)
            .target(Target::Pipe(Box::new(
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(LOG_FILENAME)
                    .expect("Can't open the log file"),
            )))
            .init();
    }

    debug!("Service is in main");

    // Register generated `ffi_service_main` with the system and start the service, blocking
    // this thread until the service is stopped.
    let _ = service_dispatcher::start(abe_config::SERVICE_NAME, ffi_service_main);
}
