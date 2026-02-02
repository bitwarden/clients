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
    pub struct SshUIRequest {
        pub cipher_id: Option<String>,
        pub is_list: bool,
        pub process_name: String,
        pub is_forwarding: bool,
        pub namespace: Option<String>,
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

        match desktop_core::ssh_agent::BitwardenDesktopAgent::start_server(
            auth_request_tx,
            Arc::new(Mutex::new(auth_response_rx)),
        ) {
            Ok(state) => Ok(SshAgentState { state }),
            Err(e) => Err(napi::Error::from_reason(e.to_string())),
        }
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
        bitwarden_agent_state
            .set_keys(
                new_keys
                    .iter()
                    .map(|k| (k.private_key.clone(), k.name.clone(), k.cipher_id.clone()))
                    .collect(),
            )
            .map_err(|e| napi::Error::from_reason(e.to_string()))?;
        Ok(())
    }

    #[napi]
    pub fn lock(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state
            .lock()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }

    #[napi]
    pub fn clear_keys(agent_state: &mut SshAgentState) -> napi::Result<()> {
        let bitwarden_agent_state = &mut agent_state.state;
        bitwarden_agent_state
            .clear_keys()
            .map_err(|e| napi::Error::from_reason(e.to_string()))
    }
}
