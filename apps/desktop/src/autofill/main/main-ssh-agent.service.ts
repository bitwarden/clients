// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { agent_access, sshagent } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { SSH_AGENT_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentRequestBroker } from "./agent-request-broker";

/** The native list callback gives up after this long. */
const LIST_KEYS_TIMEOUT_MS = 60_000;

export class MainSshAgentService {
  private agentState: sshagent.SshAgentState;
  // List-keys asks the renderer to unlock and push keys; a closed window is reopened for it.
  private listKeys: AgentRequestBroker<{ deadline: number }, boolean>;

  constructor(
    private logService: LogService,
    messagingService: MessagingService,
    windowMain: WindowMain,
    showWindow: () => Promise<void>,
    private answer: (request: agent_access.AgentRequest) => Promise<agent_access.AgentOutcome>,
  ) {
    this.listKeys = new AgentRequestBroker<{ deadline: number }, boolean>(
      SSH_AGENT_IPC_CHANNELS.LIST_KEYS_REQUEST,
      messagingService,
      logService,
      () => windowMain.win != null && !windowMain.win.isDestroyed(),
      showWindow,
      false,
    );
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

    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.STOP, async () => {
      if (this.agentState != null) {
        this.agentState.stop();
        this.agentState = null;
      }
      this.listKeys.settleAll(false);
    });

    ipcMain.handle(SSH_AGENT_IPC_CHANNELS.READY, () => this.listKeys.rendererStarted());

    ipcMain.handle(
      SSH_AGENT_IPC_CHANNELS.LIST_KEYS_RESPONSE,
      async (_, { requestId, accepted }: { requestId: number; accepted: boolean }) =>
        this.listKeys.answer(requestId, accepted),
    );
  }

  // Starts the Agent.
  // @pre: The agent must not be running. The caller may utilize `is_running()` and `stop()`.
  private async init() {
    const signCb = (_err: Error | null, request: agent_access.AgentRequest) => this.answer(request);
    const listCb = (_err: Error | null) => {
      const deadline = Date.now() + LIST_KEYS_TIMEOUT_MS;
      return this.listKeys.request({ deadline }, deadline);
    };
    try {
      this.agentState = await sshagent.SshAgentState.serve(signCb, listCb);
      this.logService.info("SSH agent started");
    } catch (e: unknown) {
      this.logService.error("SSH agent encountered an error: ", e);
    }
  }
}
