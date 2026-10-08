/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { agent_access } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { AgentOutcomeStatus } from "../models/agent-request";

import { MainAgentAccessService } from "./main-agent-access.service";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
}));

jest.mock("@bitwarden/desktop-napi", () => ({
  agent_access: {
    AgentAccessState: { serve: jest.fn() },
    OutcomeStatus: {
      Approved: "approved",
      Denied: "denied",
      NotFound: "notFound",
      Locked: "locked",
      Timeout: "timeout",
      Error: "error",
    },
  },
}));

describe("MainAgentAccessService", () => {
  let handlers: Map<string, Function>;
  let service: MainAgentAccessService;

  const request = (kind: agent_access.AgentRequestKind): agent_access.AgentRequest => ({
    kind,
    requester: { app: { name: "claude", pid: 3 }, chain: [], bundledCli: false },
    deadline: Date.now() + 60_000,
  });

  beforeEach(() => {
    jest.useFakeTimers();
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: Function) =>
      handlers.set(channel, handler),
    );
    const windowMain = { win: { isDestroyed: () => false } } as unknown as WindowMain;

    service = new MainAgentAccessService(
      mock<LogService>(),
      mock<MessagingService>(),
      windowMain,
      jest.fn(),
    );
    handlers.get("agentaccess.ready")!();
  });

  afterEach(() => jest.useRealTimers());

  it("on stop, denies agent access requests but leaves SSH signs to the SSH agent", async () => {
    const credential = service.answer(request({ type: "credential", query: { domain: "x" } }));
    const sign = service.answer(request({ type: "sshSign", cipherId: "c", isForwarding: false }));

    handlers.get("agentaccess.stop")!();
    handlers.get("agentaccess.response")!(
      {},
      { requestId: 2, outcome: { status: AgentOutcomeStatus.Approved } },
    );

    await expect(credential).resolves.toEqual({ status: "denied" });
    await expect(sign).resolves.toEqual({ status: "approved" });
  });
});
