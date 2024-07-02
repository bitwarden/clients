use std::fs::File;

use futures::{SinkExt, StreamExt};
use log::*;
use tokio_util::codec::LengthDelimitedCodec;

fn init_logging() {
    use simplelog::{ColorChoice, CombinedLogger, Config, TermLogger, TerminalMode, WriteLogger};

    let exe = std::env::current_exe().unwrap();
    let parent = exe.parent().unwrap();

    let level = LevelFilter::Info;
    let config = Config::default();
    let log_file = File::create(parent.join("proxy.log")).expect("Can't create file");

    CombinedLogger::init(vec![
        WriteLogger::new(level, config.clone(), log_file),
        TermLogger::new(level, config, TerminalMode::Stderr, ColorChoice::Auto),
    ])
    .unwrap();
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

    // Setup two channels, one for sending messages to the desktop application and one for receiving messages
    let (in_tx, in_rx) = tokio::sync::mpsc::channel(32);
    let (out_tx, mut out_rx) = tokio::sync::mpsc::channel(32);

    tokio::spawn(desktop_core::ipc::client::start(out_tx, in_rx));

    // Create a new codec for reading and writing messages from stdin/stdout.
    let mut stdin = LengthDelimitedCodec::builder()
        .native_endian()
        .new_read(tokio::io::stdin());
    let mut stdout = LengthDelimitedCodec::builder()
        .native_endian()
        .new_write(tokio::io::stdout());

    loop {
        tokio::select! {
            // Receive messages from IPC and print to STDOUT.
            msg = out_rx.recv() => {
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
                        in_tx.send(m).await.unwrap();
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
