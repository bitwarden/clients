import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { credential_agent } from "@bitwarden/desktop-napi";

import {
  CredentialAgentResponse,
  CredentialRequestStatus,
} from "../models/credential-agent-request";
import { CREDENTIAL_AGENT_IPC_CHANNELS } from "../models/ipc-channels";

/**
 * Bridges the native credential agent to the renderer.
 *
 * The napi callback is awaited directly by the Rust agent, so it must resolve with the
 * user's decision and the resulting credential. Approval and vault lookup both live in the
 * renderer, so each callback becomes a round-trip: main fires a message to the renderer,
 * the renderer answers over a separate IPC call. Several clients can be in flight at once,
 * so `pendingRequests` correlates each answer back to the callback waiting on it.
 */
export class MainCredentialAgentService {
  private pendingRequests = new Map<number, (response: CredentialAgentResponse) => void>();
  private requestId = 0;
  private agentState: credential_agent.CredentialAgentState | null = null;

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
  ) {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    ipcMain.handle(CREDENTIAL_AGENT_IPC_CHANNELS.INIT, async () => this.init());

    ipcMain.handle(
      CREDENTIAL_AGENT_IPC_CHANNELS.IS_LOADED,
      async () => this.agentState?.isRunning() ?? false,
    );

    ipcMain.handle(CREDENTIAL_AGENT_IPC_CHANNELS.STOP, async () => {
      this.agentState?.stop();
      this.agentState = null;

      // Release any client still waiting on a decision, rather than leaving it hanging
      // until the native timeout.
      for (const [requestId, resolve] of this.pendingRequests) {
        resolve({ requestId, status: CredentialRequestStatus.Denied });
      }
      this.pendingRequests.clear();
    });

    ipcMain.handle(
      CREDENTIAL_AGENT_IPC_CHANNELS.REQUEST_RESPONSE,
      async (_, response: CredentialAgentResponse) => {
        this.pendingRequests.get(response.requestId)?.(response);
        this.pendingRequests.delete(response.requestId);
      },
    );
  }

  /**
   * Starts the agent. No-op when it is already running.
   */
  private async init(): Promise<void> {
    if (this.agentState?.isRunning()) {
      return;
    }

    try {
      this.agentState = await credential_agent.CredentialAgentState.serve(
        (_err: Error | null, request: credential_agent.CredentialRequest) =>
          this.requestCredential(request),
      );
      this.logService.info("Credential agent started");
    } catch (e: unknown) {
      this.logService.error("Credential agent failed to start: ", e);
    }
  }

  private requestCredential(
    request: credential_agent.CredentialRequest,
  ): Promise<credential_agent.CredentialResponse> {
    const requestId = ++this.requestId;

    return new Promise<credential_agent.CredentialResponse>((resolve) => {
      this.pendingRequests.set(requestId, (response) => resolve(toNativeResponse(response)));

      this.messagingService.send(CREDENTIAL_AGENT_IPC_CHANNELS.REQUEST, {
        requestId,
        uri: request.uri,
        name: request.name,
        processName: request.processName,
      });
    });
  }
}

function toNativeResponse(response: CredentialAgentResponse): credential_agent.CredentialResponse {
  if (response.status !== CredentialRequestStatus.Granted || response.credential == null) {
    return { status: toNativeStatus(response.status) };
  }

  return {
    status: credential_agent.CredentialStatus.Granted,
    credential: {
      cipherId: response.credential.cipherId,
      name: response.credential.name,
      username: response.credential.username,
      password: response.credential.password,
      totp: response.credential.totp,
    },
  };
}

function toNativeStatus(status: CredentialRequestStatus): credential_agent.CredentialStatus {
  switch (status) {
    case CredentialRequestStatus.NotFound:
      return credential_agent.CredentialStatus.NotFound;
    case CredentialRequestStatus.Granted:
    case CredentialRequestStatus.Denied:
      return credential_agent.CredentialStatus.Denied;
  }
}
