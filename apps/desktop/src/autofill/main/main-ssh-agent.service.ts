// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { sshagent } from "@bitwarden/desktop-napi";

import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";
import { SshAgentActivity } from "../models/ssh-agent-activity";

// Caps the activity log's memory; the oldest entries are dropped first.
const MAX_ACTIVITY_ENTRIES = 500;

export class MainSshAgentService {
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
  private agentState: sshagent.SshAgentState;
  // Newest first. Kept in memory only and cleared when the agent stops, e.g. on logout.
  private activityLog: SshAgentActivity[] = [];

  constructor(
    private logService: LogService,
    private messagingService: MessagingService,
  ) {
    this.registerIpcHandlers();
  }

  private registerIpcHandlers() {
    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.INIT, async () => {
      await this.init();
    });

    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.IS_LOADED, async () => {
      return this.agentState?.isRunning() ?? false;
    });

    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.REPLACE,
      async (_, keys: { name: string; privateKey: string; cipherId: string }[]) => {
        if (this.agentState != null && this.agentState.isRunning()) {
          this.agentState.replace(keys);
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
      if (this.agentState != null) {
        this.agentState.stop();
        this.agentState = null;
      }
      this.activityLog = [];
    });

    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.ACTIVITY_LOG, async () => [...this.activityLog]);

    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.LIST_KEYS_RESPONSE,
      async (_, { requestId, accepted }: { requestId: number; accepted: boolean }) => {
        this.pendingRequests.get(requestId)?.(accepted);
        this.pendingRequests.delete(requestId);
      },
    );
  }

  // Starts the Agent.
  // @pre: The agent must not be running. The caller may utilize `is_running()` and `stop()`.
  private async init() {
    const signCb = (_err: Error | null, data: sshagent.SignRequestData) => this.requestSign(data);
    const listCb = (_err: Error | null) => this.requestListKeys();
    const activityCb = (_err: Error | null, data: sshagent.ActivityData) =>
      this.recordActivity(data);
    try {
      this.agentState = await sshagent.SshAgentState.serve(signCb, listCb, activityCb);
      this.logService.info("SSH agent started");
    } catch (e: unknown) {
      this.logService.error("SSH agent encountered an error: ", e);
    }
  }

  // Prepends `data` to the activity log and tells the renderer, so an open log refreshes.
  private recordActivity(data: sshagent.ActivityData) {
    const activity: SshAgentActivity = {
      timestamp: Date.now(),
      operation: data.operation,
      outcome: data.outcome,
      cipherId: data.cipherId,
      namespace: data.namespace,
      processName: data.processName,
      command: data.command,
      callerApp: data.callerApp,
      hostApp: data.hostApp,
      isForwarding: data.isForwarding,
    };

    this.activityLog = [activity, ...this.activityLog].slice(0, MAX_ACTIVITY_ENTRIES);
    this.messagingService.send(SSH_AGENT_IPC_CHANNELS.ACTIVITY);
  }

  private requestListKeys(): Promise<boolean> {
    const id = ++this.requestId;
    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve);
      this.messagingService.send(SSH_AGENT_IPC_CHANNELS.LIST_KEYS_REQUEST, { requestId: id });
    });
  }

  private requestSign(data: sshagent.SignRequestData): Promise<boolean> {
    const id = ++this.requestId;
    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve);
      this.messagingService.send(SSH_AGENT_IPC_CHANNELS.SIGN_REQUEST, {
        cipherId: data.cipherId,
        requestId: id,
        processName: data.signRequest.processName,
        isAgentForwarding: data.signRequest.isForwarding,
        namespace: data.signRequest.namespace,
        hostFingerprint: data.signRequest.hostFingerprint,
      });
    });
  }
}
