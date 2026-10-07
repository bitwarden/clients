import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";

import { AgentAccessRegistrationStatusService } from "./agent-access-registration-status.service";
import { AgentAccessRegistrationService } from "./agent-access-registration.service";
import { AgentDetectionService } from "./agent-detection.service";
import { MainAgentAccessCliService } from "./main-agent-access-cli.service";
import { OpenShellDetectionService } from "./openshell-detection.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";
import { OpenShellManagementService } from "./openshell-management.service";
import { OpenShellSetupService } from "./openshell-setup.service";

jest.mock("electron", () => ({
  ipcMain: { handle: jest.fn() },
  app: { getPath: jest.fn().mockReturnValue("/mock/appData") },
}));

jest.mock("../../utils", () => ({ isDev: jest.fn().mockReturnValue(false) }));

const CHANNELS = [
  AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_LIST_FORWARDS,
  AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_START_FORWARD,
  AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_STOP_FORWARD,
  AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_OPEN_SHELL,
  AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SAVED_PORTS_GET,
  AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_SAVED_PORTS_SET,
];

describe("OpenShell ports and shell IPC (§M8.20 rule 15)", () => {
  let handlers: Map<string, (...args: any[]) => any>;

  function create(configured: boolean, enabled: boolean) {
    const setup = mock<OpenShellSetupService>();
    setup.getStatus.mockResolvedValue({ configured } as any);
    const detection = mock<OpenShellDetectionService>();
    detection.detect.mockResolvedValue({
      present: true,
      platformSupported: true,
      cliPath: "/opt/homebrew/bin/openshell",
      gateways: [
        { name: "work", endpoint: "x", authMode: "mtls", active: true, authSupported: true },
      ],
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
      mock<OpenShellManagementService>(),
      state,
    );
  }

  beforeEach(() => {
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler);
    });
  });

  it("registers all six channels with the agreed names", () => {
    create(true, true);
    expect(CHANNELS).toEqual([
      "agentaccess.openshell.listforwards",
      "agentaccess.openshell.startforward",
      "agentaccess.openshell.stopforward",
      "agentaccess.openshell.openshell",
      "agentaccess.openshell.savedportsget",
      "agentaccess.openshell.savedportsset",
    ]);
    for (const channel of CHANNELS) {
      expect(handlers.has(channel)).toBe(true);
    }
  });

  it("rejects a missing or non-plain payload with invalidInput", async () => {
    create(true, true);
    for (const channel of CHANNELS) {
      for (const payload of [undefined, null, "x", 5, ["a"], new Date(), new (class Evil {})()]) {
        expect(await handlers.get(channel)!({}, payload)).toEqual({
          ok: false,
          error: "invalidInput",
        });
      }
    }
  });

  it("answers unsupported when OpenShell is not set up or the toggle is off", async () => {
    for (const [configured, enabled] of [
      [false, true],
      [true, false],
    ]) {
      handlers.clear();
      create(configured, enabled);
      expect(await handlers.get(CHANNELS[0])!({}, { sandboxName: "box" })).toEqual({
        ok: false,
        error: "unsupported",
      });
      expect(await handlers.get(CHANNELS[1])!({}, { sandboxName: "box", port: 8080 })).toEqual({
        ok: false,
        error: "unsupported",
      });
      expect(
        await handlers.get(CHANNELS[3])!({}, { sandboxName: "box", action: "openTerminal" }),
      ).toEqual({ ok: false, error: "unsupported" });
    }
  });

  it("validates inside main even when the gate is open", async () => {
    create(true, true);
    expect(await handlers.get(CHANNELS[1])!({}, { sandboxName: "box", port: 99999 })).toEqual({
      ok: false,
      error: "invalidInput",
    });
    expect(
      await handlers.get(CHANNELS[3])!({}, { sandboxName: "--x", action: "copyCommand" }),
    ).toEqual({ ok: false, error: "invalidInput" });
  });

  it("copyCommand through IPC returns the connect command and starts nothing", async () => {
    create(true, true);
    expect(
      await handlers.get(CHANNELS[3])!({}, { sandboxName: "box", action: "copyCommand" }),
    ).toEqual({
      ok: true,
      data: {
        command: "/opt/homebrew/bin/openshell sandbox connect --gateway=work box",
        launched: false,
      },
    });
  });
});
