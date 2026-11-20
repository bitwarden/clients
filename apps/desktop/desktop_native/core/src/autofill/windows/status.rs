use anyhow::Result;
use serde::Serialize;
use win_webauthn::plugin::{AuthenticatorState, WebAuthnPlugin};

use super::get_clsid;

pub(super) fn handle_status_request() -> Result<StatusResponse> {
    let clsid = get_clsid()?;
    let Some(clsid) = clsid else {
        // Not packaged as an Appx, so ignoring and returning status == disabled.
        return Ok(StatusResponse {
            support: StatusSupport {
                fido2: false,
                password: false,
                incremental_updates: false,
            },
            state: StatusState { enabled: false },
        });
    };

    let plugin = WebAuthnPlugin::new(clsid);
    let authenticator_state = plugin.get_authenticator_state()?;
    let fido_enabled = matches!(authenticator_state, AuthenticatorState::Enabled);
    // Windows currently only supports FIDO2 credentials, so we report as
    // disabled if the FIDO2 credentials can't sync.
    let enabled = fido_enabled;
    Ok(StatusResponse {
        support: StatusSupport {
            fido2: fido_enabled,
            password: false,
            incremental_updates: false,
        },
        state: StatusState { enabled },
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct StatusResponse {
    support: StatusSupport,
    state: StatusState,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusSupport {
    fido2: bool,
    password: bool,
    incremental_updates: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusState {
    enabled: bool,
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{StatusResponse, StatusState, StatusSupport};
    use crate::autofill::autofill::{
        CommandResponse, CommandResult, RunCommand, RunCommandRequest,
    };

    #[test]
    fn test_status_request_deserialization() {
        let json = json!({
            "namespace": "autofill",
            "command": "status",
            "params": {},
        });
        let request: RunCommandRequest = serde_json::from_value(json).unwrap();

        assert!(matches!(request.command, RunCommand::Status(())));
        assert_eq!("autofill", request.namespace);
    }

    #[test]
    fn test_status_serializes_expected_response() {
        let result = CommandResult::Success {
            value: CommandResponse::Status(StatusResponse {
                support: StatusSupport {
                    fido2: true,
                    password: false,
                    incremental_updates: false,
                },
                state: StatusState { enabled: true },
            }),
        };
        let expected = json!({
            "type": "success",
            "value": {
                "support": { "fido2": true, "password": false, "incrementalUpdates": false },
                "state": { "enabled": true },
            },
        });
        assert_eq!(expected, serde_json::to_value(&result).unwrap());
    }
}
