// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";
import { concatMap, delay, filter, firstValueFrom, from, race, take, timer } from "rxjs";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent, sshagent_v2 } from "@bitwarden/desktop-napi";

import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";

// V1, delete with PM-30758
class AgentResponse {
  requestId: number;
  accepted: boolean;
  timestamp: Date;
}

export class MainSshAgentService {
  // V1, delete with PM-30758
  SIGN_TIMEOUT = 60_000;
  REQUEST_POLL_INTERVAL = 50;

  // V1, delete with PM-30758
  private requestResponses: AgentResponse[] = [];
  private request_id = 0;
  private agentState: sshagent.SshAgentState;

  // The napi callback requestSign() is awaited directly by the Rust agent,
  // so it must return a Promise that resolves with the user's decision.
  // The approval dialog lives in the renderer (a separate process), so bridging a callback
  // to a user decision requires a round-trip: main fires a message to the renderer, the
  // renderer responds via a separate IPC call. Because multiple SSH clients can connect
  // simultaneously, multiple callbacks can be in-flight at once. pendingRequests holds the
  // resolve function for each in-flight callback, keyed by requestId, so the IPC response
  // can be matched back to the correct waiting Promise. Electron has no native
  // main→renderer request-response mechanism, making this correlation map necessary.
  private pendingRequests = new Map<number, (accepted: boolean) => void>();
  private requestId = 0;
  private agentStateV2: sshagent_v2.SshAgentState;
  private v2HandlersRegistered = false;

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
  ) {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.INIT,
      async (_event: any, { useV2 }: { useV2: boolean }) => {
        if (useV2) {
          if (!this.v2HandlersRegistered) {
            this.registerV2IpcHandlers();
            this.v2HandlersRegistered = true;
          }
          await this.initV2();
        } else {
          this.registerV1IpcHandlers();
          this.init();
        }
      },
    );

    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.IS_LOADED, async (_event: any) => {
      if (this.agentStateV2 != null) {
        return this.agentStateV2.isRunning();
      }
      return this.agentState != null;
    });
  }

  init() {
    // V1, delete with PM-30758
    // handle sign request passing to UI
    sshagent
      .serve(async (err: Error | null, sshUiRequest: sshagent.SshUiRequest): Promise<boolean> => {
        // clear all old (> SIGN_TIMEOUT) requests
        this.requestResponses = this.requestResponses.filter(
          (response) => response.timestamp > new Date(Date.now() - this.SIGN_TIMEOUT),
        );

        this.request_id += 1;
        const id_for_this_request = this.request_id;
        this.messagingService.send(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST, {
          cipherId: sshUiRequest.cipherId,
          isListRequest: sshUiRequest.isList,
          requestId: id_for_this_request,
          processName: sshUiRequest.processName,
          isAgentForwarding: sshUiRequest.isForwarding,
          namespace: sshUiRequest.namespace,
        });

        const result = await firstValueFrom(
          race(
            from([false]).pipe(delay(this.SIGN_TIMEOUT)),

            //poll for response
            timer(0, this.REQUEST_POLL_INTERVAL).pipe(
              concatMap(() => from(this.requestResponses)),
              filter((response) => response.requestId == id_for_this_request),
              take(1),
              concatMap(() => from([true])),
            ),
          ),
        );

        if (!result) {
          return false;
        }

        const response = this.requestResponses.find(
          (response) => response.requestId == id_for_this_request,
        );

        this.requestResponses = this.requestResponses.filter(
          (response) => response.requestId != id_for_this_request,
        );

        return response.accepted;
      })
      .then((agentState: sshagent.SshAgentState) => {
        this.agentState = agentState;
        this.logService.info("SSH agent started");
      })
      .catch((e) => {
        this.logService.error("SSH agent encountered an error: ", e);
      });
  }

  // V1, delete with PM-30758
  private registerV1IpcHandlers() {
    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.REPLACE,
      async (event: any, keys: { name: string; privateKey: string; cipherId: string }[]) => {
        if (this.agentState != null && (await sshagent.isRunning(this.agentState))) {
          sshagent.setKeys(this.agentState, keys);
        }
      },
    );

    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE,
      async (event: any, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.requestResponses.push({ requestId, accepted, timestamp: new Date() });
      },
    );

    ipcMain.handle("sshagent.lock", async (event: any) => {
      if (this.agentState != null && (await sshagent.isRunning(this.agentState))) {
        sshagent.lock(this.agentState);
      }
    });

    ipcMain.handle("sshagent.clearkeys", async (event: any) => {
      if (this.agentState != null) {
        sshagent.clearKeys(this.agentState);
      }
    });
  }

  private registerV2IpcHandlers() {
    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.REPLACE,
      async (_, keys: { name: string; privateKey: string; cipherId: string }[]) => {
        if (this.agentStateV2 != null && this.agentStateV2.isRunning()) {
          this.agentStateV2.replace(keys);
        }
      },
    );

    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST_RESPONSE,
      async (_, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.pendingRequests.get(requestId)?.(accepted);
        this.pendingRequests.delete(requestId);
      },
    );

    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.STOP, async () => {
      if (this.agentStateV2 != null) {
        this.agentStateV2.stop();
        this.agentStateV2 = null;
      }
    });
  }

  // Starts the Agent.
  // @pre: The agent must not be running. The caller may utilize `is_running()` and `stop()`.
  private async initV2() {
    const signCb = (data: sshagent_v2.SignRequestData) => this.requestSign(data);
    try {
      this.agentStateV2 = await sshagent_v2.SshAgentState.serve(signCb);
      this.logService.info("SSH agent v2 started");
    } catch (e: unknown) {
      this.logService.error("SSH agent v2 encountered an error: ", e);
    }
  }

  private requestSign(data: sshagent_v2.SignRequestData): Promise<boolean> {
    const id = ++this.requestId;
    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve);
      this.messagingService.send(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST, {
        cipherId: data.cipherId,
        isListRequest: false,
        requestId: id,
        processName: data.signRequest.processName,
        isAgentForwarding: data.signRequest.isForwarding,
        namespace: data.signRequest.namespace,
      });
    });
  }
}
