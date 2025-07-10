import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { autofill, passkey_authenticator } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../../main/window.main";

import { CommandDefinition } from "./command";
import type { RunCommandParams, RunCommandResult } from "./native-autofill.main";
import { NativeAutofillFido2Credential, NativeAutofillSyncParams } from "./sync.command";

export class NativeAutofillWindowsMain {
  private pendingPasskeyRequests = new Map<string, (response: any) => void>();

  constructor(
    private logService: LogService,
    private windowMain: WindowMain,
  ) {}

  initWindows() {
    passkey_authenticator.register();
    void passkey_authenticator.onRequest(async (error, event) => {
      this.logService.info("Passkey request received:", { error, event });

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
    });
  }

  private async handleAssertionRequest(request: autofill.PasskeyAssertionRequest): Promise<string> {
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

  /**
   * Wrapper for webContents.send that optionally waits for a response
   * @param channel The IPC channel to send to
   * @param data The data to send
   * @param options Optional configuration
   * @returns Promise that resolves with the response if waitForResponse is true
   */
  private async sendAndOptionallyWait<T = any>(
    channel: string,
    data: any,
    options?: { waitForResponse?: boolean; timeout?: number },
  ): Promise<T | void> {
    if (!options?.waitForResponse) {
      // Just send without waiting for response (existing behavior)
      this.logService.info(`Sending fire-and-forget message to ${channel}`);
      this.windowMain.win.webContents.send(channel, data);
      return;
    }

    // Use clientId and sequenceNumber as the tracking key
    const trackingKey = `${data.clientId}_${data.sequenceNumber}`;
    const timeout = options.timeout || 30000; // 30 second default timeout

    this.logService.info(`Sending awaitable request ${trackingKey} to ${channel}`, { data });

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.logService.warning(`Request ${trackingKey} timed out after ${timeout}ms`);
        this.pendingPasskeyRequests.delete(trackingKey);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Store the resolver
      this.pendingPasskeyRequests.set(trackingKey, (response: T) => {
        this.logService.info(`Request ${trackingKey} resolved with response:`, response);
        clearTimeout(timeoutId);
        this.pendingPasskeyRequests.delete(trackingKey);
        resolve(response);
      });

      this.logService.info(
        `Stored resolver for request ${trackingKey}, total pending: ${this.pendingPasskeyRequests.size}`,
      );

      // Send the request
      this.windowMain.win.webContents.send(channel, data);
    });
  }

  /**
   * These Handlers react to requests coming from the electron RENDERER process.
   */
  setupWindowsRendererIPCHandlers() {
    // This will run a command in windows and return the result.
    // Only the "sync" command is supported for now.
    ipcMain.handle(
      "autofill.runCommand",
      <C extends CommandDefinition>(
        _event: any,
        params: RunCommandParams<C>,
      ): Promise<RunCommandResult<C>> => {
        return this.runCommand(params);
      },
    );

    ipcMain.on("autofill.completePasskeySync", (event, data) => {
      this.logService.warning("autofill.completePasskeySync", data);
      const { clientId, sequenceNumber, response } = data;

      // Handle awaitable passkey requests using clientId and sequenceNumber
      if (clientId !== undefined && sequenceNumber !== undefined) {
        const trackingKey = `${clientId}_${sequenceNumber}`;
        this.handlePasskeyResponse(trackingKey, response);
      }
    });

    ipcMain.on("autofill.completePasskeyRegistration", (event, data) => {
      this.logService.warning("autofill.completePasskeyRegistration", data);
      const { clientId, sequenceNumber, response } = data;

      // Handle awaitable passkey requests using clientId and sequenceNumber
      if (clientId !== undefined && sequenceNumber !== undefined) {
        const trackingKey = `${clientId}_${sequenceNumber}`;
        this.handlePasskeyResponse(trackingKey, response);
      }
    });

    ipcMain.on("autofill.completePasskeyAssertion", (event, data) => {
      this.logService.warning("autofill.completePasskeyAssertion", data);
      const { clientId, sequenceNumber, response } = data;

      // Handle awaitable passkey requests using clientId and sequenceNumber
      if (clientId !== undefined && sequenceNumber !== undefined) {
        const trackingKey = `${clientId}_${sequenceNumber}`;
        this.handlePasskeyResponse(trackingKey, response);
      }
    });

    ipcMain.on("autofill.completeError", (event, data) => {
      this.logService.warning("autofill.completeError", data);
      const { clientId, sequenceNumber, error } = data;

      // Handle awaitable passkey requests using clientId and sequenceNumber
      if (clientId !== undefined && sequenceNumber !== undefined) {
        const trackingKey = `${clientId}_${sequenceNumber}`;
        this.handlePasskeyResponse(trackingKey, { error: String(error) });
      }
    });
  }

  private handlePasskeyResponse(trackingKey: string, response: any): void {
    this.logService.info("Received passkey response for tracking key:", trackingKey, response);

    if (!trackingKey) {
      this.logService.error("Response missing tracking key:", response);
      return;
    }

    this.logService.info(`Looking for pending request with tracking key: ${trackingKey}`);
    this.logService.info(
      `Current pending requests: ${Array.from(this.pendingPasskeyRequests.keys())}`,
    );

    const resolver = this.pendingPasskeyRequests.get(trackingKey);
    if (resolver) {
      this.logService.info("Found resolver, calling with response data:", response);
      resolver(response);
    } else {
      this.logService.warning("No pending request found for tracking key:", trackingKey);
    }
  }

  private async runCommand<C extends CommandDefinition>(
    command: RunCommandParams<C>,
  ): Promise<RunCommandResult<C>> {
    try {
      this.logService.info("Windows runCommand (sync) is called with command:", command);

      if (command.namespace !== "autofill") {
        this.logService.error("Invalid command namespace:", command.namespace);
        return { type: "error", error: "Invalid command namespace" } as RunCommandResult<C>;
      }

      if (command.command !== "sync") {
        this.logService.error("Invalid command:", command.command);
        return { type: "error", error: "Invalid command" } as RunCommandResult<C>;
      }

      const syncParams = command.params as NativeAutofillSyncParams;
      // Only sync FIDO2 credentials
      const fido2Credentials = syncParams.credentials.filter((c) => c.type === "fido2");

      const mappedCredentials = fido2Credentials.map((cred: NativeAutofillFido2Credential) => {
        const credential: passkey_authenticator.SyncedCredential = {
          credentialId: cred.credentialId,
          rpId: cred.rpId,
          userName: cred.userName,
          userHandle: cred.userHandle,
        };
        this.logService.info("Mapped credential:", credential);
        return credential;
      });

      this.logService.info("Syncing passkeys to Windows:", mappedCredentials);

      passkey_authenticator.syncCredentialsToWindows(mappedCredentials);

      // TODO: Return a meaningful result
      const res = { value: { added: 999 } } as RunCommandResult<C>;
      return res;
    } catch (e) {
      this.logService.error(`Error running autofill command '${command.command}':`, e);

      if (e instanceof Error) {
        return { type: "error", error: e.stack ?? String(e) } as RunCommandResult<C>;
      }

      return { type: "error", error: String(e) } as RunCommandResult<C>;
    }
  }
}
