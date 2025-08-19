use anyhow::{Result, anyhow};
use clap::Parser;
use env_logger::Target;
use log::{debug, error};
use std::{
    error::Error,
    ffi::OsString,
    fs::OpenOptions,
    thread::sleep,
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::windows::named_pipe::ClientOptions,
    time,
};
use windows::Win32::{
    Foundation::{ERROR_PIPE_BUSY, ERROR_SERVICE_DOES_NOT_EXIST},
    UI::Shell::IsUserAnAdmin,
};
use windows_service::{
    service::{
        ServiceAccess, ServiceErrorControl, ServiceInfo, ServiceStartType, ServiceState,
        ServiceType,
    },
    service_manager::{ServiceManager, ServiceManagerAccess},
};

use bitwarden_chromium_importer::abe_config;

#[derive(Parser)]
#[command(name = "admin")]
#[command(about = "Admin tool for ABE service management")]
struct Args {
    /// Base64 encoded encrypted data to process
    #[arg(long, help = "Base64 encoded encrypted data string")]
    encrypted: String,

    /// Path to the service executable
    #[arg(long, help = "Full path to the service executable file")]
    service_exe: String,
}

// Enable this to log to a file. Debugging a system level service in any other way is not easy.
const NEED_LOGGING: bool = true;
const LOG_FILENAME: &str = "c:\\temp\\bitwarden-abe-admin-log.txt";

fn install_and_start_service(service_exe_path: &str) -> Result<()> {
    let manager_access = ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE;
    let service_manager = ServiceManager::local_computer(None::<&str>, manager_access)?;

    let service_info = ServiceInfo {
        name: OsString::from(abe_config::SERVICE_NAME),
        display_name: OsString::from(abe_config::SERVICE_DISPLAY_NAME),
        service_type: ServiceType::OWN_PROCESS,
        start_type: ServiceStartType::OnDemand,
        error_control: ServiceErrorControl::Normal,
        executable_path: service_exe_path.into(),
        launch_arguments: vec![],
        dependencies: vec![],
        account_name: None, // run as System
        account_password: None,
    };

    let service = service_manager.create_service(&service_info, ServiceAccess::CHANGE_CONFIG)?;
    service.set_description("Bitwarden Encryption Service used for importing passwords")?;

    // Start the service
    let service_access = ServiceAccess::START | ServiceAccess::QUERY_STATUS;
    let service = service_manager.open_service(abe_config::SERVICE_NAME, service_access)?;
    service.start(&[] as &[OsString])?;
    debug!("Service {} started successfully", abe_config::SERVICE_NAME);

    // Wait for the service to be in the running state
    let start = Instant::now();
    let timeout = Duration::from_secs(5);

    while start.elapsed() < timeout {
        if service.query_status()?.current_state == ServiceState::Running {
            debug!("Service {} is running", abe_config::SERVICE_NAME);
            break;
        }
        sleep(Duration::from_millis(100));
    }

    Ok(())
}

fn stop_and_uninstall_service() -> Result<()> {
    let manager_access = ServiceManagerAccess::CONNECT;
    let service_manager = ServiceManager::local_computer(None::<&str>, manager_access)?;

    let service_access = ServiceAccess::QUERY_STATUS | ServiceAccess::STOP | ServiceAccess::DELETE;
    let service = service_manager.open_service(abe_config::SERVICE_NAME, service_access)?;

    // The service will be marked for deletion as long as this function call succeeds.
    // However, it will not be deleted from the database until it is stopped and all open handles to it are closed.
    if let Err(e) = service.delete() {
        debug!("Failed to delete service: {}", e);
    }

    // Our handle to it is not closed yet. So we can still query it.
    if service.query_status()?.current_state != ServiceState::Stopped {
        // If the service cannot be stopped, it will be deleted when the system restarts.
        if let Err(e) = service.stop() {
            debug!("Failed to stop service: {} {:?}", &e, &e.source());
        }
    }

    // Explicitly close our open handle to the service. This is automatically called when `service` goes out of scope.
    drop(service);

    // Win32 API does not give us a way to wait for service deletion.
    // To check if the service is deleted from the database, we have to poll it ourselves.
    let start = Instant::now();
    let timeout = Duration::from_secs(5);
    while start.elapsed() < timeout {
        if let Err(windows_service::Error::Winapi(e)) =
            service_manager.open_service(abe_config::SERVICE_NAME, ServiceAccess::QUERY_STATUS)
        {
            if e.raw_os_error() == Some(ERROR_SERVICE_DOES_NOT_EXIST.0 as i32) {
                debug!("{} is deleted.", abe_config::SERVICE_NAME);
                return Ok(());
            }
        }
        sleep(Duration::from_secs(1));
    }
    debug!("{} is marked for deletion.", abe_config::SERVICE_NAME);

    Ok(())
}

async fn send_message_to_pipe_server(pipe_name: &'static str, message: &str) -> Result<String> {
    // TODO: Don't loop forever, but retry a few times
    let mut client = loop {
        match ClientOptions::new().open(pipe_name) {
            Ok(client) => {
                debug!("Successfully connected to the pipe!");
                break client;
            }
            Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY.0 as i32) => {
                debug!("Pipe is busy, retrying in 50ms...");
            }
            Err(e) => {
                debug!("Failed to connect to pipe: {}", &e);
                return Err(e.into());
            }
        }

        time::sleep(Duration::from_millis(50)).await;
    }; // Send multiple messages to the server

    client.write_all(message.as_bytes()).await?;

    // Try to receive a response for this message
    let mut buffer = vec![0u8; 64 * 1024];
    match client.read(&mut buffer).await {
        Ok(0) => Err(anyhow!(
            "Server closed the connection (0 bytes read) on message"
        )),
        Ok(bytes_received) => {
            let response = String::from_utf8_lossy(&buffer[..bytes_received]);
            Ok(response.to_string())
        }
        Err(e) => {
            return Err(anyhow!("Failed to receive response for message: {}", e));
        }
    }
}

async fn send_error_to_user(error_message: &str) {
    _ = send_to_user(&format!("!{}", error_message)).await
}

async fn send_to_user(message: &str) {
    _ = send_message_to_pipe_server(abe_config::ADMIN_TO_USER_PIPE_NAME, &message).await
}

fn is_admin() -> bool {
    unsafe { IsUserAnAdmin().as_bool() }
}

#[tokio::main]
async fn main() {
    if NEED_LOGGING {
        colog::default_builder()
            .filter_level(log::STATIC_MAX_LEVEL) // Controlled by the feature flags in Cargo.toml
            .target(Target::Pipe(Box::new(
                OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(LOG_FILENAME)
                    .expect("Can't open the log file"),
            )))
            .init();
    }

    debug!("Starting admin");

    let args = match Args::try_parse() {
        Ok(args) => args,
        Err(e) => {
            error!("Failed to parse command line arguments: {}", e);
            return;
        }
    };

    if !is_admin() {
        error!("Expected to run with admin privileges");
        return;
    }

    debug!("Running as admin");

    debug!("Using service executable: {}", args.service_exe);

    if let Err(e) = install_and_start_service(&args.service_exe) {
        let error_message = format!("Failed to install and start the service: {:#?}", e);
        error!("{}", error_message);
        send_error_to_user(&error_message).await;
        return;
    }

    // Store and uninstall when done
    let _service = scopeguard::guard((), |_| {
        _ = stop_and_uninstall_service();
    });

    debug!("Sending encrypted data to the service: {}", args.encrypted);

    let response =
        send_message_to_pipe_server(abe_config::SERVICE_TO_ADMIN_PIPE_NAME, &args.encrypted).await;

    if let Err(e) = response {
        let error_message = format!("Failed to communicate with the service: {}", e);
        error!("{}", error_message);
        send_error_to_user(&error_message).await;
        return;
    }

    let response = response.unwrap();
    debug!("Response: {}", response);

    debug!("Sending response back to user");
    send_to_user(&response).await;

    return;
}
