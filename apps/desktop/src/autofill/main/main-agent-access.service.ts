import { ipcMain } from "electron";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { agent_access } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { AgentOutcome, AgentOutcomeStatus } from "../models/agent-request";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentRequestBroker } from "./agent-request-broker";

/** Runs the local agent listener and hands each request to the renderer's gate. */
export class MainAgentAccessService {
  private agentState: agent_access.AgentAccessState | null = null;
  private broker: AgentRequestBroker<agent_access.AgentRequest, AgentOutcome>;

  constructor(
    private logService: LogService,
    messagingService: MessagingService,
    windowMain: WindowMain,
    showWindow: () => Promise<void>,
  ) {
    this.broker = new AgentRequestBroker<agent_access.AgentRequest, AgentOutcome>(
      AGENT_ACCESS_IPC_CHANNELS.REQUEST,
      messagingService,
      logService,
      () => windowMain.win != null && !windowMain.win.isDestroyed(),
      showWindow,
      { status: AgentOutcomeStatus.Timeout },
    );

    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.INIT, () => this.init());
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.IS_LOADED,
      () => this.agentState?.isRunning() ?? false,
    );
    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.STOP, () => {
      this.agentState?.stop();
      this.agentState = null;
      // SSH signs share the broker but not the setting; the SSH agent still waits on them.
      this.broker.settleAll(
        { status: AgentOutcomeStatus.Denied },
        (request) => request.kind.type !== "sshSign",
      );
    });
    ipcMain.handle(AGENT_ACCESS_IPC_CHANNELS.READY, () => this.broker.rendererStarted());
    ipcMain.handle(
      AGENT_ACCESS_IPC_CHANNELS.RESPONSE,
      (_, { requestId, outcome }: { requestId: number; outcome: AgentOutcome }) =>
        this.broker.answer(requestId, outcome),
    );
  }

  /** Also answers the SSH agent's sign approvals, so every request shares one broker. */
  readonly answer = async (request: agent_access.AgentRequest) =>
    toNative(await this.broker.request(request, request.deadline));

  private async init() {
    if (this.agentState?.isRunning()) {
      return;
    }
    try {
      this.agentState = await agent_access.AgentAccessState.serve((_err, request) =>
        this.answer(request),
      );
      this.logService.info("Agent access listener started");
    } catch (e: unknown) {
      this.logService.error("Agent access listener failed to start", e);
    }
  }
}

function toNative({ status, credential }: AgentOutcome): agent_access.AgentOutcome {
  switch (status) {
    case AgentOutcomeStatus.Approved:
      return { status: agent_access.OutcomeStatus.Approved, credential };
    case AgentOutcomeStatus.NotFound:
      return { status: agent_access.OutcomeStatus.NotFound };
    case AgentOutcomeStatus.Locked:
      return { status: agent_access.OutcomeStatus.Locked };
    case AgentOutcomeStatus.Timeout:
      return { status: agent_access.OutcomeStatus.Timeout };
    case AgentOutcomeStatus.Error:
      return { status: agent_access.OutcomeStatus.Error };
    default:
      return { status: agent_access.OutcomeStatus.Denied };
  }
}
