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

/** The environments, secret-set and metadata channels (§M8.20 rule 17), wired in the CLI service. */
describe("MainAgentAccessCliService environments IPC", () => {
  const CHANNELS: Record<string, boolean> = {
    OPENSHELL_ENV_LIST: false,
    OPENSHELL_ENV_SAVE: true,
    OPENSHELL_ENV_DELETE: true,
    OPENSHELL_SET_LIST: false,
    OPENSHELL_SET_SAVE: true,
    OPENSHELL_SET_DELETE: true,
    OPENSHELL_META_GET: false,
    OPENSHELL_META_SET: true,
  };
  let handlers: Map<string, (...args: any[]) => Promise<any>>;
  let detection: ReturnType<typeof mock<OpenShellDetectionService>>;

  beforeEach(() => {
    handlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler);
    });
    detection = mock<OpenShellDetectionService>();
    detection.detect.mockResolvedValue({
      present: true,
      platformSupported: true,
      cliPath: "/opt/homebrew/bin/openshell",
      gateways: [],
    } as any);
  });

  function create(enabled: boolean, configured = true) {
    const state = new OpenShellEnabledState();
    state.set(enabled);
    const setup = mock<OpenShellSetupService>();
    setup.getStatus.mockResolvedValue({ configured } as any);
    new MainAgentAccessCliService(
      mock<LogService>() as any,
      "/Users/test/data",
      "/app/Bitwarden",
      "/app/resources",
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

  it("registers all eight channels", () => {
    create(true);
    for (const name of Object.keys(CHANNELS)) {
      expect(handlers.has((AGENT_ACCESS_IPC_CHANNELS as Record<string, string>)[name])).toBe(true);
    }
  });

  it("rejects a payload that is not a plain object before the service sees it", async () => {
    create(true);
    for (const [name, takesRequest] of Object.entries(CHANNELS)) {
      const handler = handlers.get((AGENT_ACCESS_IPC_CHANNELS as Record<string, string>)[name])!;
      for (const payload of ["x", 5, ["a"], true, new Date(), new (class Evil {})()]) {
        expect(await handler({}, payload)).toEqual({ ok: false, error: "invalidInput" });
      }
      if (takesRequest) {
        expect(await handler({})).toEqual({ ok: false, error: "invalidInput" });
      }
    }
  });

  it("answers unsupported on every channel when the toggle is off or the driver isn't set up", async () => {
    for (const [enabled, configured] of [
      [false, true],
      [true, false],
    ]) {
      handlers.clear();
      create(enabled, configured);
      for (const [name, takesRequest] of Object.entries(CHANNELS)) {
        const handler = handlers.get((AGENT_ACCESS_IPC_CHANNELS as Record<string, string>)[name])!;
        expect(await handler({}, takesRequest ? { name: "x" } : undefined)).toEqual({
          ok: false,
          error: "unsupported",
        });
      }
    }
  });

  it("reaches the service when enabled: an invalid request is invalidInput, a list is ok", async () => {
    create(true);
    expect(
      await handlers.get(AGENT_ACCESS_IPC_CHANNELS.OPENSHELL_ENV_SAVE)!({}, { name: "" }),
    ).toEqual({
      ok: false,
      error: "invalidInput",
    });
  });
});
