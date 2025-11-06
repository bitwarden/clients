use anyhow::{anyhow, Result};
use base64::engine::{general_purpose::URL_SAFE_NO_PAD, Engine};
use windows_plugin_authenticator::{self, SyncedCredential};

use crate::autofill::{
    CommandResponse, RunCommand, RunCommandRequest, StatusResponse, StatusState, StatusSupport,
    SyncCredential, SyncParameters, SyncResponse,
};

const PLUGIN_CLSID: &str = "0f7dc5d9-69ce-4652-8572-6877fd695062";

#[allow(clippy::unused_async)]
pub async fn run_command(value: String) -> Result<String> {
    // this.logService.info("Passkey request received:", { error, event });

    let request: RunCommandRequest = serde_json::from_str(&value)
        .map_err(|e| anyhow!("Failed to deserialize passkey request: {e}"))?;

    if request.namespace != "autofill" {
        return Err(anyhow!("Unknown namespace: {}", request.namespace));
    }
    let response: CommandResponse = match request.command {
        RunCommand::Status => handle_status_request()?.try_into()?,
        RunCommand::Sync => {
            let params: SyncParameters = serde_json::from_value(request.params)
                .map_err(|e| anyhow!("Could not parse sync parameters: {e}"))?;
            handle_sync_request(params)?.try_into()?
        }
    };
    serde_json::to_string(&response).map_err(|e| anyhow!("Failed to serialize response: {e}"))

    /*
      try {
        const request = JSON.parse(event.requestJson);
        this.logService.info("Parsed passkey request:", { type: event.requestType, request });

        // Handle different request types based on the requestType field
        switch (event.requestType) {
          case "assertion":
            return await this.handleAssertionRequest(request);
          case "registration":
            return await this.handleRegistrationRequest(request);
          case "sync":
            return await this.handleSyncRequest(request);
          default:
            this.logService.error("Unknown passkey request type:", event.requestType);
            return JSON.stringify({
              type: "error",
              message: `Unknown request type: ${event.requestType}`,
            });
        }
      } catch (parseError) {
        this.logService.error("Failed to parse passkey request:", parseError);
        return JSON.stringify({
          type: "error",
          message: "Failed to parse request JSON",
        });
      }
    */
}

fn handle_sync_request(params: SyncParameters) -> Result<SyncResponse> {
    let credentials: Vec<SyncedCredential> = params
        .credentials
        .into_iter()
        .filter_map(|c| c.try_into().ok())
        .collect();
    let num_creds = credentials.len().try_into().unwrap_or(u32::MAX);
    windows_plugin_authenticator::sync_credentials_to_windows(credentials, PLUGIN_CLSID)
        .map_err(|e| anyhow!("Failed to sync credentials to Windows: {e}"))?;
    Ok(SyncResponse { added: num_creds })
    /*
      let mut log_file = std::fs::File::options()
          .append(true)
          .open("C:\\temp\\bitwarden_windows_core.log")
          .unwrap();
      log_file.write_all(b"Made it to sync!");
    */
}

fn handle_status_request() -> Result<StatusResponse> {
    Ok(StatusResponse {
        support: StatusSupport {
            fido2: true,
            password: false,
            incremental_updates: false,
        },
        state: StatusState { enabled: true },
    })
}

/*
async fn handleAssertionRequest(request: autofill.PasskeyAssertionRequest): Promise<string> {
    this.logService.info("Handling assertion request for rpId:", request.rpId);

    try {
      // Generate unique identifiers for tracking this request
      const clientId = Date.now();
      const sequenceNumber = Math.floor(Math.random() * 1000000);

      // Send request and wait for response
      const response = await this.sendAndOptionallyWait<autofill.PasskeyAssertionResponse>(
        "autofill.passkeyAssertion",
        {
          clientId,
          sequenceNumber,
          request: request,
        },
        { waitForResponse: true, timeout: 60000 },
      );

      if (response) {
        // Convert the response to the format expected by the NAPI bridge
        return JSON.stringify({
          type: "assertion_response",
          ...response,
        });
      } else {
        return JSON.stringify({
          type: "error",
          message: "No response received from renderer",
        });
      }
    } catch (error) {
      this.logService.error("Error in assertion request:", error);
      return JSON.stringify({
        type: "error",
        message: `Assertion request failed: ${error.message}`,
      });
    }
  }

  private async handleRegistrationRequest(
    request: autofill.PasskeyRegistrationRequest,
  ): Promise<string> {
    this.logService.info("Handling registration request for rpId:", request.rpId);

    try {
      // Generate unique identifiers for tracking this request
      const clientId = Date.now();
      const sequenceNumber = Math.floor(Math.random() * 1000000);

      // Send request and wait for response
      const response = await this.sendAndOptionallyWait<autofill.PasskeyRegistrationResponse>(
        "autofill.passkeyRegistration",
        {
          clientId,
          sequenceNumber,
          request: request,
        },
        { waitForResponse: true, timeout: 60000 },
      );

      this.logService.info("Received response for registration request:", response);

      if (response) {
        // Convert the response to the format expected by the NAPI bridge
        return JSON.stringify({
          type: "registration_response",
          ...response,
        });
      } else {
        return JSON.stringify({
          type: "error",
          message: "No response received from renderer",
        });
      }
    } catch (error) {
      this.logService.error("Error in registration request:", error);
      return JSON.stringify({
        type: "error",
        message: `Registration request failed: ${error.message}`,
      });
    }
  }

  private async handleSyncRequest(
    request: passkey_authenticator.PasskeySyncRequest,
  ): Promise<string> {
    this.logService.info("Handling sync request for rpId:", request.rpId);

    try {
      // Generate unique identifiers for tracking this request
      const clientId = Date.now();
      const sequenceNumber = Math.floor(Math.random() * 1000000);

      // Send sync request and wait for response
      const response = await this.sendAndOptionallyWait<passkey_authenticator.PasskeySyncResponse>(
        "autofill.passkeySync",
        {
          clientId,
          sequenceNumber,
          request: { rpId: request.rpId },
        },
        { waitForResponse: true, timeout: 60000 },
      );

      this.logService.info("Received response for sync request:", response);

      if (response && response.credentials) {
        // Convert the response to the format expected by the NAPI bridge
        return JSON.stringify({
          type: "sync_response",
          credentials: response.credentials,
        });
      } else {
        return JSON.stringify({
          type: "error",
          message: "No credentials received from renderer",
        });
      }
    } catch (error) {
      this.logService.error("Error in sync request:", error);
      return JSON.stringify({
        type: "error",
        message: `Sync request failed: ${error.message}`,
      });
    }
  }

*/

impl TryFrom<SyncCredential> for SyncedCredential {
    type Error = anyhow::Error;

    fn try_from(value: SyncCredential) -> Result<Self, anyhow::Error> {
        if let SyncCredential::Fido2 {
            rp_id,
            credential_id,
            user_name,
            user_handle,
            ..
        } = value
        {
            Ok(Self {
                credential_id: URL_SAFE_NO_PAD
                    .decode(credential_id)
                    .map_err(|e| anyhow!("Could not decode credential ID: {e}"))?,
                rp_id: rp_id,
                user_name: user_name,
                user_handle: URL_SAFE_NO_PAD
                    .decode(&user_handle)
                    .map_err(|e| anyhow!("Could not decode user handle: {e}"))?,
            })
        } else {
            Err(anyhow!("Only FIDO2 credentials are supported."))
        }
    }
}
