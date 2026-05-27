#[napi]
pub mod sshagent {
    use std::sync::Arc;

    use napi::{
        bindgen_prelude::Promise,
        threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
    };
    use tokio::{self, sync::Mutex};
    use tracing::error;

    #[napi]
    pub struct SshAgentState {
        state: desktop_core::ssh_agent::BitwardenDesktopAgent,
    }

    #[napi(object)]
    pub struct PrivateKey {
        pub private_key: String,
        pub name: String,
        pub cipher_id: String,
    }

    #[napi(object)]
    pub struct SshKey {
        pub private_key: String,
        pub public_key: String,
        pub key_fingerprint: String,
    }

    #[napi(object)]
    pub struct ProcessFrameNapi {
        pub pid: u32,
        pub name: String,
        pub executable_path: Option<String>,
    }

    #[napi(object)]
    pub struct AppContextNapi {
        pub process_name: String,
        pub executable_path: Option<String>,
        pub pid: u32,
        pub parent_chain: Vec<ProcessFrameNapi>,
        pub argv: Option<Vec<String>>,
    }

    #[napi(object)]
    pub struct HostContextNapi {
        /// "none" | "argv" | "known-hosts" | "host-key"
        pub source: String,
        pub hostname: Option<String>,
        pub hostname_unverified: Option<String>,
        pub port: Option<u32>,
        pub username: Option<String>,
        pub key_fingerprint: Option<String>,
        pub known_hosts_match: bool,
    }

    #[napi(object)]
    pub struct RequestContextNapi {
        pub app: AppContextNapi,
        pub host: HostContextNapi,
    }

    #[napi(object)]
    pub struct SshUIRequest {
        pub cipher_id: Option<String>,
        pub is_list: bool,
        pub process_name: String,
        pub is_forwarding: bool,
        pub namespace: Option<String>,
        pub context: Option<RequestContextNapi>,
    }

    fn to_napi_context(
        ctx: desktop_core::ssh_agent::context::RequestContext,
    ) -> RequestContextNapi {
        use desktop_core::ssh_agent::context::HostSource;
        let source_str = match ctx.host.source {
            HostSource::None => "none",
            HostSource::Argv => "argv",
            HostSource::KnownHosts => "known-hosts",
            HostSource::HostKey => "host-key",
        }
        .to_string();
        RequestContextNapi {
            app: AppContextNapi {
                process_name: ctx.app.process_name,
                executable_path: ctx.app.executable_path,
                pid: ctx.app.pid,
                parent_chain: ctx
                    .app
                    .parent_chain
                    .into_iter()
                    .map(|f| ProcessFrameNapi {
                        pid: f.pid,
                        name: f.name,
                        executable_path: f.executable_path,
                    })
                    .collect(),
                argv: ctx.app.argv,
            },
            host: HostContextNapi {
                source: source_str,
                hostname: ctx.host.hostname,
                hostname_unverified: ctx.host.hostname_unverified,
                port: ctx.host.port.map(|p| p as u32),
                username: ctx.host.username,
                key_fingerprint: ctx.host.key_fingerprint,
                known_hosts_match: ctx.host.known_hosts_match,
            },
        }
    }

    #[allow(clippy::unused_async)] // FIXME: Remove unused async!
    #[napi]
    pub async fn serve(
        callback: ThreadsafeFunction<SshUIRequest, Promise<bool>>,
    ) -> napi::Result<SshAgentState> {
        let (auth_request_tx, mut auth_request_rx) =
            tokio::sync::mpsc::channel::<desktop_core::ssh_agent::SshAgentUIRequest>(32);
        let (auth_response_tx, auth_response_rx) =
            tokio::sync::broadcast::channel::<(u32, bool)>(32);
        let auth_response_tx_arc = Arc::new(Mutex::new(auth_response_tx));
        // Wrap callback in Arc so it can be shared across spawned tasks
        let callback = Arc::new(callback);
        tokio::spawn(async move {
            let _ = auth_response_rx;

            while let Some(request) = auth_request_rx.recv().await {
                let cloned_response_tx_arc = auth_response_tx_arc.clone();
                let cloned_callback = callback.clone();
                tokio::spawn(async move {
                    let auth_response_tx_arc = cloned_response_tx_arc;
                    let callback = cloned_callback;
                    // In NAPI v3, obtain the JS callback return as a Promise<boolean> and await it
                    // in Rust
                    let (tx, rx) = std::sync::mpsc::channel::<Promise<bool>>();
                    let status = callback.call_with_return_value(
                        Ok(SshUIRequest {
                            cipher_id: request.cipher_id,
                            is_list: request.is_list,
                            process_name: request.process_name,
                            is_forwarding: request.is_forwarding,
                            namespace: request.namespace,
                            context: request.context.map(to_napi_context),
                        }),
                        ThreadsafeFunctionCallMode::Blocking,
                        move |ret: Result<Promise<bool>, napi::Error>, _env| {
                            if let Ok(p) = ret {
                                let _ = tx.send(p);
                            }
                            Ok(())
                        },
                    );

                    let result = if status == napi::Status::Ok {
                        match rx.recv() {
                            Ok(promise) => match promise.await {
                                Ok(v) => v,
                                Err(e) => {
                                    error!(error = %e, "UI callback promise rejected");
                                    false
                                }
                            },
                            Err(e) => {
                                error!(error = %e, "Failed to receive UI callback promise");
                                false
                            }
                        }
                    } else {
                        error!(error = ?status, "Calling UI callback failed");
                        false
                    };

                    let _ = auth_response_tx_arc
                        .lock()
                        .await
                        .send((request.request_id, result))
                        .expect("should be able to send auth response to agent");
                });
            }
        });

        let state = desktop_core::ssh_agent::BitwardenDesktopAgent::start_server(
            auth_request_tx,
            Arc::new(Mutex::new(auth_response_rx)),
        )?;
        Ok(SshAgentState { state })
    }

    #[napi]
    pub fn stop(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state.stop();
        Ok(())
    }

    #[napi]
    pub fn is_running(agent_state: &mut SshAgentState) -> bool {
        let bitwarden_agent_state = agent_state.state.clone();
        bitwarden_agent_state.is_running()
    }

    #[napi]
    pub fn set_keys(
        agent_state: &mut SshAgentState,
        new_keys: Vec<PrivateKey>,
    ) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state.set_keys(
            new_keys
                .iter()
                .map(|k| (k.private_key.clone(), k.name.clone(), k.cipher_id.clone()))
                .collect(),
        )?;
        Ok(())
    }

    #[napi]
    pub fn lock(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        Ok(bitwarden_agent_state.lock()?)
    }

    #[napi]
    pub fn clear_keys(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        Ok(bitwarden_agent_state.clear_keys()?)
    }

    #[napi]
    pub fn set_rich_context_enabled(agent_state: &mut SshAgentState, enabled: bool) {
        agent_state.state.set_rich_context_enabled(enabled);
    }
}
