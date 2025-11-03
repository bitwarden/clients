use std::path::Path;

use desktop_core::ipc::{MESSAGE_CHANNEL_BUFFER, NATIVE_MESSAGING_BUFFER_SIZE};
use futures::{FutureExt, SinkExt, StreamExt};
use tokio_util::codec::LengthDelimitedCodec;
use tracing::{debug, error, info, level_filters::LevelFilter};
use tracing_subscriber::{
    fmt, layer::SubscriberExt as _, util::SubscriberInitExt as _, EnvFilter, Layer as _,
};

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "macos")]
embed_plist::embed_info_plist!("../../../resources/info.desktop_proxy.plist");

const ENV_VAR_PROXY_LOG_LEVEL: &str = "PROXY_LOG_LEVEL";

fn init_logging(log_path: &Path, console_level: LevelFilter, file_level: LevelFilter) {
    let console_filter = EnvFilter::builder()
        .with_default_directive(console_level.into())
        .with_env_var(ENV_VAR_PROXY_LOG_LEVEL)
        .from_env_lossy();

    let console_layer = fmt::layer()
        .with_writer(std::io::stderr)
        .with_filter(console_filter);

    match std::fs::File::create(log_path) {
        Ok(file) => {
            let file_filter = EnvFilter::builder()
                .with_default_directive(file_level.into())
                .from_env_lossy();

            let file_layer = fmt::layer()
                .with_writer(file)
                .with_ansi(false)
                .with_filter(file_filter);

            tracing_subscriber::registry()
                .with(console_layer)
                .with(file_layer)
                .init();
        }
        Err(error) => {
            tracing_subscriber::registry().with(console_layer).init();
            error!(%error, ?log_path, "Could not create log file.");
        }
    }
}

/// Bitwarden IPC Proxy.
///
/// This proxy allows browser extensions to communicate with a desktop application using Native
/// Messaging. This method allows an extension to send and receive messages through the use of
/// stdin/stdout streams.
///
/// However, this also requires the browser to start the process in order for the communication to
/// occur. To overcome this limitation, we implement Inter-Process Communication (IPC) to establish
/// a stable communication channel between the proxy and the running desktop application.
///
/// Browser extension <-[native messaging]-> proxy <-[ipc]-> desktop
///
// FIXME: Remove unwraps! They panic and terminate the whole application.
#[allow(clippy::unwrap_used)]
#[tokio::main(flavor = "current_thread")]
async fn main() {
    #[cfg(target_os = "windows")]
    let should_foreground = windows::allow_foreground();

    let sock_path = desktop_core::ipc::path("bw");

    let log_path = {
        let mut path = sock_path.clone();
        path.set_extension("bitwarden.log");
        path
    };

    init_logging(&log_path, LevelFilter::INFO, LevelFilter::INFO);

    info!("Starting Bitwarden IPC Proxy.");

    // Different browsers send different arguments when the app starts:
    //
    // Firefox:
    // - The complete path to the app manifest. (in the form `/Users/<user>/Library/.../Mozilla/NativeMessagingHosts/com.8bit.bitwarden.json`)
    // - (in Firefox 55+) the ID (as given in the manifest.json) of the add-on that started it (in the form `{[UUID]}`).
    //
    // Chrome on Windows:
    // - Origin of the extension that started it (in the form `chrome-extension://[ID]`).
    // - Handle to the Chrome native window that started the app.
    //
    // Chrome on Linux and Mac:
    // - Origin of the extension that started it (in the form `chrome-extension://[ID]`).

    let args: Vec<_> = std::env::args().skip(1).collect();
    info!(?args, "Process args");

    // Setup two channels, one for sending messages to the desktop application (`out`) and one for receiving messages from the desktop application (`in`)
    let (in_send, in_recv) = tokio::sync::mpsc::channel(MESSAGE_CHANNEL_BUFFER);
    let (out_send, mut out_recv) = tokio::sync::mpsc::channel(MESSAGE_CHANNEL_BUFFER);

    let mut handle = tokio::spawn(
        desktop_core::ipc::client::connect(sock_path, out_send, in_recv)
            .map(|r| r.map_err(|e| e.to_string())),
    );

    // Create a new codec for reading and writing messages from stdin/stdout.
    let mut stdin = LengthDelimitedCodec::builder()
        .max_frame_length(NATIVE_MESSAGING_BUFFER_SIZE)
        .native_endian()
        .new_read(tokio::io::stdin());
    let mut stdout = LengthDelimitedCodec::builder()
        .max_frame_length(NATIVE_MESSAGING_BUFFER_SIZE)
        .native_endian()
        .new_write(tokio::io::stdout());

    loop {
        tokio::select! {
            // This forces tokio to poll the futures in the order that they are written.
            // We want the spawn handle to be evaluated first so that we can get any error
            // results before we get the channel closed message.
            biased;

            // IPC client has finished, so we should exit as well.
            res = &mut handle => {
                match res {
                    Ok(Ok(())) => {
                        info!("IPC client finished successfully.");
                        std::process::exit(0);
                    }
                    Ok(Err(error)) => {
                        error!(error, "IPC client connection error.");
                        std::process::exit(1);
                    }
                    Err(error) => {
                        error!(%error, "IPC client spawn error.");
                        std::process::exit(1);
                    }
                }
            }

            // Receive messages from IPC and print to STDOUT.
            msg = out_recv.recv() => {
                match msg {
                    Some(msg) => {
                        debug!(msg, "OUT");
                        stdout.send(msg.into()).await.unwrap();
                    }
                    None => {
                        info!("Channel closed, exiting.");
                        std::process::exit(0);
                    }
                }
            },

            // Listen to stdin and send messages to ipc processor.
            msg = stdin.next() => {
                #[cfg(target_os = "windows")]
                should_foreground.store(true, std::sync::atomic::Ordering::Relaxed);

                match msg {
                    Some(Ok(msg)) => {
                        let msg = String::from_utf8(msg.to_vec()).unwrap();
                        debug!(msg, "IN");
                        in_send.send(msg).await.unwrap();
                    }
                    Some(Err(error)) => {
                        error!(%error, "Error parsing input.");
                        std::process::exit(1);
                    }
                    None => {
                        info!("Received EOF, exiting.");
                        std::process::exit(0);
                    }
                }
            }

        }
    }
}
