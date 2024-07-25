use futures::{SinkExt, StreamExt};
use log::*;
use tokio_util::codec::LengthDelimitedCodec;

fn init_logging() {
    use simplelog::{ColorChoice, CombinedLogger, Config, SharedLogger, TermLogger, TerminalMode};

    let level = LevelFilter::Info;
    let config = Config::default();

    let mut loggers: Vec<Box<dyn SharedLogger>> = Vec::new();
    loggers.push(TermLogger::new(
        level,
        config.clone(),
        TerminalMode::Stderr,
        ColorChoice::Auto,
    ));

    #[cfg(debug_assertions)]
    {
        match std::fs::File::create(std::env::temp_dir().join("bitwarden_desktop_proxy.log")) {
            Ok(file) => {
                loggers.push(simplelog::WriteLogger::new(level, config, file));
            }
            Err(e) => {
                eprintln!("Can't create file: {}", e);
            }
        }
    }

    if let Err(e) = CombinedLogger::init(loggers) {
        eprintln!("Failed to initialize logger: {}", e);
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
#[tokio::main(flavor = "current_thread")]
async fn main() {
    init_logging();
    info!("Starting Bitwarden IPC Proxy.");

    // Setup two channels, one for sending messages to the desktop application (`out`) and one for receiving messages from the desktop application (`in`)
    let (in_send, in_recv) = tokio::sync::mpsc::channel(32);
    let (out_send, mut out_recv) = tokio::sync::mpsc::channel(32);

    let mut handle = tokio::spawn(desktop_core::ipc::client::connect(out_send, in_recv));

    // Create a new codec for reading and writing messages from stdin/stdout.
    let mut stdin = LengthDelimitedCodec::builder()
        .max_frame_length(8192)
        .native_endian()
        .new_read(tokio::io::stdin());
    let mut stdout = LengthDelimitedCodec::builder()
        .max_frame_length(8192)
        .native_endian()
        .new_write(tokio::io::stdout());

    loop {
        tokio::select! {
            // IPC client has finished, so we should exit as well.
            _ = &mut handle => {
                break;
            }

            // Receive messages from IPC and print to STDOUT.
            msg = out_recv.recv() => {
                match msg {
                    Some(msg) => {
                        debug!("OUT: {}", msg);
                        stdout.send(msg.into()).await.unwrap();
                    }
                    None => {
                        // Channel closed, exit.
                        break;
                    }
                }
            },

            // Listen to stdin and send messages to ipc processor.
            msg = stdin.next() => {
                match msg {
                    Some(Ok(msg)) => {
                        let m = String::from_utf8(msg.to_vec()).unwrap();
                        debug!("IN: {}", m);
                        in_send.send(m).await.unwrap();
                    }
                    Some(Err(e)) => {
                        // Unexpected error, exit.
                        error!("Error parsing input: {}", e);
                        break;
                    }
                    None => {
                        // EOF, exit.
                        break;
                    }
                }
            }

        }
    }

    info!("Exiting.");
}
