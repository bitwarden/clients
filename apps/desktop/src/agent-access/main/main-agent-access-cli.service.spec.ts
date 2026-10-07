import { existsSync, promises as fs } from "fs";
import * as path from "path";

import { ipcMain } from "electron";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { isDev } from "../../utils";
import { AgentId } from "../models/agent-id";
import { RegisterWithAgentStatus } from "../models/agent-registration";
import { AgentRegistrationStatus } from "../models/agent-registration-status";

import { AgentAccessRegistrationStatusService } from "./agent-access-registration-status.service";
import { AgentAccessRegistrationService } from "./agent-access-registration.service";
import { AgentDetectionService } from "./agent-detection.service";
import { MainAgentAccessCliService } from "./main-agent-access-cli.service";
import { OpenShellDetectionService } from "./openshell-detection.service";
import { OpenShellEnabledState } from "./openshell-enabled-state";
import { OpenShellManagementService } from "./openshell-management.service";
import { OpenShellSetupService } from "./openshell-setup.service";

jest.mock("electron", () => ({
  ipcMain: {
    handle: jest.fn(),
  },
  // Only reached when a test omits an explicit AgentDetectionService/AgentAccessRegistrationService
  // /AgentAccessRegistrationStatusService, letting MainAgentAccessCliService's own default
  // instantiate one — see the `appDataPath` default param on each of those services.
  app: {
    getPath: jest.fn().mockReturnValue("/mock/appData"),
  },
}));

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  promises: {
    stat: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    link: jest.fn(),
    copyFile: jest.fn(),
  },
}));

jest.mock("../../utils", () => ({
  isDev: jest.fn(),
}));

describe("MainAgentAccessCliService", () => {
  const originalPlatform = process.platform;

  const userDataPath = "/Users/test/Library/Application Support/Bitwarden";
  const exePath = "/Applications/Bitwarden.app/Contents/MacOS/Bitwarden";
  const appPath = "/Applications/Bitwarden.app/Contents/Resources/app";

  let mockLogService: jest.Mocked<LogService>;
  let ipcHandlers: Map<string, (...args: any[]) => any>;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform("darwin");
    (isDev as jest.Mock).mockReturnValue(false);

    ipcHandlers = new Map();
    (ipcMain.handle as jest.Mock).mockImplementation((channel: string, handler: any) => {
      ipcHandlers.set(channel, handler);
    });

    mockLogService = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warning: jest.fn(),
    } as any;

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.link as jest.Mock).mockResolvedValue(undefined);
    (fs.copyFile as jest.Mock).mockResolvedValue(undefined);
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  const createService = () =>
    new MainAgentAccessCliService(mockLogService, userDataPath, exePath, appPath);

  it("registers the agentaccess.getbundledclipath IPC handler", () => {
    createService();

    expect(ipcHandlers.has("agentaccess.getbundledclipath")).toBe(true);
  });

  describe("binary present (non-Linux)", () => {
    it("returns the in-bundle path directly without copying", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      const service = createService();

      const result = await service.getBundledCliPath();

      expect(result).toBe(path.join(path.dirname(exePath), "aac"));
      expect(fs.link).not.toHaveBeenCalled();
      expect(fs.copyFile).not.toHaveBeenCalled();
    });

    it("appends .exe on Windows", async () => {
      setPlatform("win32");
      (existsSync as jest.Mock).mockReturnValue(true);
      const service = createService();

      const result = await service.getBundledCliPath();

      expect(result).toBe(path.join(path.dirname(exePath), "aac.exe"));
    });
  });

  describe("binary absent", () => {
    it("returns null instead of throwing", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const service = createService();

      const result = await service.getBundledCliPath();

      expect(result).toBeNull();
    });
  });

  describe("Linux copy-out", () => {
    const bundledPath = path.join(path.dirname(exePath), "aac");
    const canonicalPath = path.join(userDataPath, "bin", "aac");

    beforeEach(() => {
      setPlatform("linux");
      (existsSync as jest.Mock).mockReturnValue(true);
    });

    it("hard-links the binary to the canonical userData path and returns it", async () => {
      (fs.stat as jest.Mock).mockImplementation((p: string) => {
        if (p === bundledPath) {
          return Promise.resolve({ ino: 1 });
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const service = createService();
      const result = await service.getBundledCliPath();

      expect(result).toBe(canonicalPath);
      expect(fs.mkdir).toHaveBeenCalledWith(path.dirname(canonicalPath), { recursive: true });
      expect(fs.link).toHaveBeenCalledWith(bundledPath, canonicalPath);
    });

    it("skips re-linking when the canonical path already points at the current binary", async () => {
      (fs.stat as jest.Mock).mockImplementation((p: string) => {
        if (p === bundledPath || p === canonicalPath) {
          return Promise.resolve({ ino: 42 });
        }
        return Promise.reject(new Error("ENOENT"));
      });

      const service = createService();
      const result = await service.getBundledCliPath();

      expect(result).toBe(canonicalPath);
      expect(fs.link).not.toHaveBeenCalled();
      expect(fs.copyFile).not.toHaveBeenCalled();
    });

    it("falls back to copying when hard-linking fails", async () => {
      (fs.stat as jest.Mock).mockImplementation((p: string) => {
        if (p === bundledPath) {
          return Promise.resolve({ ino: 1 });
        }
        return Promise.reject(new Error("ENOENT"));
      });
      (fs.link as jest.Mock).mockRejectedValue(new Error("EXDEV: cross-device link not permitted"));

      const service = createService();
      const result = await service.getBundledCliPath();

      expect(result).toBe(canonicalPath);
      expect(fs.copyFile).toHaveBeenCalledWith(bundledPath, canonicalPath);
    });

    it("returns null if the copy-out itself fails", async () => {
      (fs.stat as jest.Mock).mockRejectedValue(new Error("boom"));
      (fs.link as jest.Mock).mockRejectedValue(new Error("boom"));
      (fs.copyFile as jest.Mock).mockRejectedValue(new Error("boom"));

      const service = createService();
      const result = await service.getBundledCliPath();

      expect(result).toBeNull();
      expect(mockLogService.warning).toHaveBeenCalled();
    });
  });

  describe("dev builds", () => {
    it("returns the dev binary path when it exists", async () => {
      (isDev as jest.Mock).mockReturnValue(true);
      // Mirrors build.js's artifact naming: dist/<bin>.<platform>-<arch>
      const devPath = path.join(
        appPath,
        "..",
        "desktop_native",
        "dist",
        `aac.${process.platform}-${process.arch}`,
      );
      (existsSync as jest.Mock).mockImplementation((p: string) => p === devPath);

      const service = createService();
      const result = await service.getBundledCliPath();

      expect(result).toBe(devPath);
    });

    it("returns null (not the prod path) when the dev binary was never built", async () => {
      (isDev as jest.Mock).mockReturnValue(true);
      (existsSync as jest.Mock).mockReturnValue(false);

      const service = createService();
      const result = await service.getBundledCliPath();

      expect(result).toBeNull();
      expect(existsSync).toHaveBeenCalledTimes(1);
    });
  });

  describe("agentaccess.detectagents", () => {
    const createServiceWithMockAgentServices = () => {
      const agentDetectionService = mock<AgentDetectionService>();
      const agentRegistrationService = mock<AgentAccessRegistrationService>();
      const service = new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        agentDetectionService,
        agentRegistrationService,
      );
      return { service, agentDetectionService, agentRegistrationService };
    };

    it("registers the handler", () => {
      createServiceWithMockAgentServices();

      expect(ipcHandlers.has("agentaccess.detectagents")).toBe(true);
    });

    it("delegates to AgentDetectionService.detectAgents", async () => {
      const { agentDetectionService } = createServiceWithMockAgentServices();
      const detectionResults = [{ agentId: AgentId.Claude, detected: true, probeResults: [] }];
      agentDetectionService.detectAgents.mockResolvedValue(detectionResults);

      const result = await ipcHandlers.get("agentaccess.detectagents")!();

      expect(agentDetectionService.detectAgents).toHaveBeenCalled();
      expect(result).toEqual(detectionResults);
    });
  });

  describe("agentaccess.registerwithagent", () => {
    const createServiceWithMockAgentServices = () => {
      const agentDetectionService = mock<AgentDetectionService>();
      const agentRegistrationService = mock<AgentAccessRegistrationService>();
      const service = new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        agentDetectionService,
        agentRegistrationService,
      );
      return { service, agentDetectionService, agentRegistrationService };
    };

    it("registers the handler", () => {
      createServiceWithMockAgentServices();

      expect(ipcHandlers.has("agentaccess.registerwithagent")).toBe(true);
    });

    it("resolves the bundled CLI path and passes it through to AgentAccessRegistrationService.registerWithAgent", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      const { agentRegistrationService } = createServiceWithMockAgentServices();
      agentRegistrationService.registerWithAgent.mockResolvedValue({
        status: RegisterWithAgentStatus.Added,
      });

      const result = await ipcHandlers.get("agentaccess.registerwithagent")!({}, AgentId.Claude);

      expect(agentRegistrationService.registerWithAgent).toHaveBeenCalledWith(
        AgentId.Claude,
        path.join(path.dirname(exePath), "aac"),
      );
      expect(result).toEqual({ status: RegisterWithAgentStatus.Added });
    });

    it("passes a null path through when the bundled CLI can't be found, without throwing", async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      const { agentRegistrationService } = createServiceWithMockAgentServices();
      agentRegistrationService.registerWithAgent.mockResolvedValue({
        status: RegisterWithAgentStatus.Error,
      });

      const result = await ipcHandlers.get("agentaccess.registerwithagent")!({}, AgentId.Claude);

      expect(agentRegistrationService.registerWithAgent).toHaveBeenCalledWith(AgentId.Claude, null);
      expect(result).toEqual({ status: RegisterWithAgentStatus.Error });
    });
  });

  describe("agentaccess.getagentregistrationstatuses", () => {
    const createServiceWithMockStatusService = () => {
      const agentRegistrationStatusService = mock<AgentAccessRegistrationStatusService>();
      const service = new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        undefined,
        undefined,
        agentRegistrationStatusService,
      );
      return { service, agentRegistrationStatusService };
    };

    it("registers the handler", () => {
      createServiceWithMockStatusService();

      expect(ipcHandlers.has("agentaccess.getagentregistrationstatuses")).toBe(true);
    });

    it("delegates to AgentAccessRegistrationStatusService.getAgentRegistrationStatuses", async () => {
      const { agentRegistrationStatusService } = createServiceWithMockStatusService();
      const statuses = [
        { agentId: AgentId.Claude, status: AgentRegistrationStatus.Registered },
        { agentId: AgentId.Codex, status: AgentRegistrationStatus.Unknown },
      ];
      agentRegistrationStatusService.getAgentRegistrationStatuses.mockResolvedValue(statuses);

      const result = await ipcHandlers.get("agentaccess.getagentregistrationstatuses")!();

      expect(agentRegistrationStatusService.getAgentRegistrationStatuses).toHaveBeenCalled();
      expect(result).toEqual(statuses);
    });
  });

  describe("OpenShell IPC (§M8.8)", () => {
    const detected = {
      present: true,
      platformSupported: true,
      gateways: [
        {
          name: "home",
          endpoint: "https://127.0.0.1:1",
          authMode: "mtls",
          active: false,
          authSupported: true,
        },
        {
          name: "work",
          endpoint: "https://127.0.0.1:2",
          authMode: "mtls",
          active: true,
          authSupported: true,
        },
      ],
      gatewayConfigPathHint: "/opt/homebrew/var/openshell/gateway.toml",
    };

    function create(detection: Partial<typeof detected> & Record<string, unknown> = detected) {
      const openShellDetection = mock<OpenShellDetectionService>();
      openShellDetection.detect.mockResolvedValue({ ...detected, ...detection } as any);
      const service = new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        mock<AgentDetectionService>(),
        mock<AgentAccessRegistrationService>(),
        mock<AgentAccessRegistrationStatusService>(),
        openShellDetection,
        "/Users/test",
      );
      return { service, openShellDetection };
    }

    it("registers DETECT_OPENSHELL and returns the detection result", async () => {
      const { openShellDetection } = create();
      const result = await ipcHandlers.get("agentaccess.detectopenshell")!({});
      expect(openShellDetection.detect).toHaveBeenCalled();
      expect(result.present).toBe(true);
    });

    it("builds the snippet from main-owned inputs only, using the active gateway", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      create();
      const snippet = await ipcHandlers.get("agentaccess.getopenshellsnippet")!(
        {},
        { aacPath: "/tmp/evil", driverSocketPath: "/tmp/evil.sock" },
      );
      expect(snippet.gatewayName).toBe("work");
      expect(snippet.gatewayToml).toContain(
        'command = "/Applications/Bitwarden.app/Contents/MacOS/aac"',
      );
      expect(snippet.gatewayToml).toContain(
        'socket_path = "/Users/test/.bitwarden-openshell-driver.sock"',
      );
      expect(snippet.gatewayToml).toContain('"--gateway", "work"]');
      expect(snippet.gatewayToml).not.toContain("evil");
    });

    it("falls back to the default gateway name when none is configured", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      create({ gateways: [] });
      const snippet = await ipcHandlers.get("agentaccess.getopenshellsnippet")!({});
      expect(snippet.gatewayName).toBe("openshell");
    });

    it("returns no snippet when OpenShell is absent, unsupported, or there is no bundled aac", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      create({ present: false });
      expect(await ipcHandlers.get("agentaccess.getopenshellsnippet")!({})).toBeNull();

      create({ platformSupported: false, unsupportedReason: "snap" });
      expect(await ipcHandlers.get("agentaccess.getopenshellsnippet")!({})).toBeNull();

      (existsSync as jest.Mock).mockReturnValue(false);
      create();
      expect(await ipcHandlers.get("agentaccess.getopenshellsnippet")!({})).toBeNull();
    });

    it("never writes anything for detection or the snippet on macOS", async () => {
      (existsSync as jest.Mock).mockReturnValue(true);
      create();
      await ipcHandlers.get("agentaccess.detectopenshell")!({});
      await ipcHandlers.get("agentaccess.getopenshellsnippet")!({});
      for (const write of [fs.mkdir, fs.link, fs.copyFile, fs.unlink]) {
        expect(write).not.toHaveBeenCalled();
      }
    });
  });
  describe("OpenShell management IPC (§M8.20)", () => {
    const CHANNELS: Record<string, [string, boolean]> = {
      listSandboxes: ["agentaccess.openshell.listsandboxes", false],
      sandboxAction: ["agentaccess.openshell.sandboxaction", true],
      createSandbox: ["agentaccess.openshell.createsandbox", true],
      listProfiles: ["agentaccess.openshell.listprofiles", false],
      listCredentials: ["agentaccess.openshell.listcredentials", true],
      addCredential: ["agentaccess.openshell.addcredential", true],
      removeCredential: ["agentaccess.openshell.removecredential", true],
      getApplyStatus: ["agentaccess.openshell.getapplystatus", true],
      createProfile: ["agentaccess.openshell.createprofile", true],
      updateProfile: ["agentaccess.openshell.updateprofile", true],
      deleteProfile: ["agentaccess.openshell.deleteprofile", true],
    };

    function createWithManagement() {
      const management = mock<OpenShellManagementService>();
      for (const method of Object.keys(CHANNELS)) {
        (management as any)[method].mockResolvedValue({ ok: true, data: method });
      }
      new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        mock<AgentDetectionService>(),
        mock<AgentAccessRegistrationService>(),
        mock<AgentAccessRegistrationStatusService>(),
        mock<OpenShellDetectionService>(),
        "/Users/test",
        mock<OpenShellSetupService>(),
        management,
      );
      return management;
    }

    it("registers all eleven channels and delegates each to the service", async () => {
      const management = createWithManagement();
      for (const [method, [channel, takesRequest]] of Object.entries(CHANNELS)) {
        expect(ipcHandlers.has(channel)).toBe(true);
        const request = takesRequest ? { sandboxName: "box" } : undefined;
        const result = await ipcHandlers.get(channel)!({}, request);
        expect(result).toEqual({ ok: true, data: method });
        expect((management as any)[method]).toHaveBeenCalledTimes(1);
        if (takesRequest) {
          expect((management as any)[method]).toHaveBeenCalledWith(request);
        }
      }
    });

    it("rejects a payload that is not a plain object with invalidInput, without calling the service", async () => {
      const management = createWithManagement();
      for (const [method, [channel, takesRequest]] of Object.entries(CHANNELS)) {
        for (const payload of ["x", 5, ["a"], true, new Date(), new (class Evil {})()]) {
          expect(await ipcHandlers.get(channel)!({}, payload)).toEqual({
            ok: false,
            error: "invalidInput",
          });
        }
        if (takesRequest) {
          expect(await ipcHandlers.get(channel)!({})).toEqual({ ok: false, error: "invalidInput" });
          expect(await ipcHandlers.get(channel)!({}, null)).toEqual({
            ok: false,
            error: "invalidInput",
          });
        }
        expect((management as any)[method]).not.toHaveBeenCalled();
      }
    });

    it("accepts no payload, null or an empty object for the argument-less channels", async () => {
      const management = createWithManagement();
      const channel = CHANNELS.listSandboxes[0];
      await ipcHandlers.get(channel)!({});
      await ipcHandlers.get(channel)!({}, null);
      await ipcHandlers.get(channel)!({}, {});
      expect(management.listSandboxes).toHaveBeenCalledTimes(3);
    });

    it("returns failed instead of throwing when the service throws", async () => {
      const management = createWithManagement();
      management.listProfiles.mockRejectedValue(new Error("boom"));
      expect(await ipcHandlers.get(CHANNELS.listProfiles[0])!({})).toEqual({
        ok: false,
        error: "failed",
      });
    });

    it("answers unsupported, without running anything, when OpenShell is not set up", async () => {
      const setup = mock<OpenShellSetupService>();
      setup.getStatus.mockResolvedValue({ configured: false } as any);
      const detection = mock<OpenShellDetectionService>();
      detection.detect.mockResolvedValue({
        present: true,
        platformSupported: true,
        cliPath: "/opt/homebrew/bin/openshell",
        gateways: [],
        gatewayConfigPathHint: "/x",
      } as any);
      new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        mock<AgentDetectionService>(),
        mock<AgentAccessRegistrationService>(),
        mock<AgentAccessRegistrationStatusService>(),
        detection,
        "/Users/test",
        setup,
      );
      expect(await ipcHandlers.get(CHANNELS.listSandboxes[0])!({})).toEqual({
        ok: false,
        error: "unsupported",
      });
      expect(
        await ipcHandlers.get(CHANNELS.sandboxAction[0])!({}, { action: "stop", name: "box" }),
      ).toEqual({ ok: false, error: "unsupported" });
    });

    describe("Agent Access OpenShell toggle", () => {
      function createGated(enabledState: OpenShellEnabledState) {
        const setup = mock<OpenShellSetupService>();
        setup.getStatus.mockResolvedValue({ configured: true } as any);
        const detection = mock<OpenShellDetectionService>();
        detection.detect.mockResolvedValue({
          present: true,
          platformSupported: true,
          // Never exists: a request that passes the gate fails to start rather than running anything.
          cliPath: "/nonexistent-dir/openshell",
          gateways: [],
          gatewayConfigPathHint: "/x",
        } as any);
        new MainAgentAccessCliService(
          mockLogService,
          userDataPath,
          exePath,
          appPath,
          mock<AgentDetectionService>(),
          mock<AgentAccessRegistrationService>(),
          mock<AgentAccessRegistrationStatusService>(),
          detection,
          "/Users/test",
          setup,
          undefined,
          enabledState,
        );
        return { setup, detection };
      }

      it("answers unsupported when set up but the toggle is off", async () => {
        const { setup } = createGated(new OpenShellEnabledState());
        expect(await ipcHandlers.get(CHANNELS.listSandboxes[0])!({})).toEqual({
          ok: false,
          error: "unsupported",
        });
        expect(
          await ipcHandlers.get(CHANNELS.sandboxAction[0])!({}, { action: "delete", name: "box" }),
        ).toEqual({ ok: false, error: "unsupported" });
        expect(setup.getStatus).not.toHaveBeenCalled();
      });

      it("lets the request through once the toggle is on", async () => {
        const state = new OpenShellEnabledState();
        createGated(state);
        state.set(true);
        expect(await ipcHandlers.get(CHANNELS.listProfiles[0])!({})).toEqual({
          ok: false,
          error: "cliMissing",
        });
      });
    });

    it("answers unsupported when detection says the platform is unsupported", async () => {
      const setup = mock<OpenShellSetupService>();
      setup.getStatus.mockResolvedValue({ configured: true } as any);
      const detection = mock<OpenShellDetectionService>();
      detection.detect.mockResolvedValue({
        present: true,
        platformSupported: false,
        cliPath: "/opt/homebrew/bin/openshell",
        gateways: [],
        gatewayConfigPathHint: "/x",
      } as any);
      new MainAgentAccessCliService(
        mockLogService,
        userDataPath,
        exePath,
        appPath,
        mock<AgentDetectionService>(),
        mock<AgentAccessRegistrationService>(),
        mock<AgentAccessRegistrationStatusService>(),
        detection,
        "/Users/test",
        setup,
      );
      expect(await ipcHandlers.get(CHANNELS.listProfiles[0])!({})).toEqual({
        ok: false,
        error: "unsupported",
      });
    });
  });
});
