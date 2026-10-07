import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { AgentAccessRegistrationStatusService } from "./agent-access-registration-status.service";
import { AgentAccessRegistrationService } from "./agent-access-registration.service";
import { AgentDetectionService } from "./agent-detection.service";
import { MainAgentAccessCliService } from "./main-agent-access-cli.service";
import { OpenShellDetectionService } from "./openshell-detection.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";
import { OpenShellSetupService } from "./openshell-setup.service";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
  app: { getPath: jest.fn().mockReturnValue("/mock/appData") },
}));

jest.mock("../../utils", () => ({ isDev: jest.fn().mockReturnValue(false) }));

const LIST = "agentaccess.openshell.listrequests";
const APPROVE = "agentaccess.openshell.approverequest";
const REJECT = "agentaccess.openshell.rejectrequest";
const ID = "927d2e27-780a-4efb-ba16-b8fc1cd0fe32";

describe("MainAgentAccessCliService agent permission requests IPC (§M8.20 rule 16)", () => {
  let handlers: Map<string, (...args: any[]) => any>;

  function create(enabled: boolean, configured = true) {
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler);
    });
    const setup = mock<OpenShellSetupService>();
    setup.getStatus.mockResolvedValue({ configured } as any);
    const detection = mock<OpenShellDetectionService>();
    detection.detect.mockResolvedValue({
      present: true,
      platformSupported: true,
      // Never exists: a request that passed the gate would fail to start rather than run anything.
      cliPath: "/nonexistent-dir/openshell",
      gateways: [],
      gatewayConfigPathHint: "/x",
    } as any);
    const state = new OpenShellEnabledState();
    state.set(enabled);
    new MainAgentAccessCliService(
      mock<LogService>(),
      "/Users/test/data",
      "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden",
      "/Applications/Bitwarden.app/Contents/Resources/app",
      mock<AgentDetectionService>(),
      mock<AgentAccessRegistrationService>(),
      mock<AgentAccessRegistrationStatusService>(),
      detection,
      "/Users/test",
      setup,
      undefined,
      state,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it("registers the three channels and no approve-all channel", () => {
    create(true);
    for (const channel of [LIST, APPROVE, REJECT]) {
      expect(handlers.has(channel)).toBe(true);
    }
    expect([...handlers.keys()].filter((c) => /approveall|clear/i.test(c))).toEqual([]);
  });

  it.each([LIST, APPROVE, REJECT])("%s needs a plain request object", async (channel) => {
    create(true);
    for (const payload of [undefined, null, "x", 5, ["a"], new Date()]) {
      expect(await handlers.get(channel)!({}, payload)).toEqual({
        ok: false,
        error: "invalidInput",
      });
    }
  });

  it.each([
    [LIST, { sandboxName: "box" }],
    [APPROVE, { sandboxName: "box", chunkId: ID }],
    [REJECT, { sandboxName: "box", chunkId: ID }],
  ])("%s answers unsupported when the toggle is off", async (channel, request) => {
    create(false);
    expect(await handlers.get(channel)!({}, request)).toEqual({ ok: false, error: "unsupported" });
  });

  it("answers unsupported when OpenShell is not set up", async () => {
    create(true, false);
    expect(await handlers.get(LIST)!({}, { sandboxName: "box" })).toEqual({
      ok: false,
      error: "unsupported",
    });
  });

  it("validates in main: a bad chunk id is invalidInput even with the gate open", async () => {
    create(true);
    expect(await handlers.get(APPROVE)!({}, { sandboxName: "box", chunkId: "--all" })).toEqual({
      ok: false,
      error: "invalidInput",
    });
    expect(await handlers.get(REJECT)!({}, { sandboxName: "box", chunkId: "x" })).toEqual({
      ok: false,
      error: "invalidInput",
    });
  });

  it("reports a missing CLI rather than throwing when the gate is open", async () => {
    create(true);
    const result = await handlers.get(LIST)!({}, { sandboxName: "box" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("cliMissing");
  });
});
