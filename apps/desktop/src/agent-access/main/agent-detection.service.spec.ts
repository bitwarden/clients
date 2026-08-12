import * as path from "path";

import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AgentDetectionProbeKind } from "../models/agent-detection";
import { AgentId } from "../models/agent-id";
import { ManualCommandStyle, McpRegistrationStrategyKind } from "../models/agent-registration";
import { AgentDefinition } from "../models/agent-registry";

import { AgentDetectionFs, AgentDetectionService } from "./agent-detection.service";

describe("AgentDetectionService", () => {
  const homedir = "/Users/test";
  const appDataPath = "/Users/test/Library/Application Support";
  const originalPlatform = process.platform;
  const originalPath = process.env.PATH;

  // Three directories so PATH-scan tests can prove a mid-PATH (not just first-entry) match.
  const pathDirs = ["/usr/local/bin", "/usr/bin", "/opt/homebrew/bin"];

  let logService: jest.Mocked<LogService>;
  let existingPaths: Set<string>;
  let fsAdapter: AgentDetectionFs;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  const claudeDefinition: AgentDefinition = {
    id: AgentId.Claude,
    displayName: "Claude Code",
    detectionProbes: [
      {
        kind: AgentDetectionProbeKind.Executable,
        description: "claude on PATH",
        executable: "claude",
      },
      {
        kind: AgentDetectionProbeKind.Path,
        description: "~/.claude.json",
        base: "home" as const,
        segments: [".claude.json"],
      },
    ],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.ManualCommand,
      style: ManualCommandStyle.ClaudeMcpAdd,
    },
  };

  // A single-probe variant of claudeDefinition, used where a test asserts something about
  // fsAdapter.exists calls (e.g. "not called at all") that the sibling Path probe would pollute.
  const executableOnlyDefinition: AgentDefinition = {
    ...claudeDefinition,
    detectionProbes: [claudeDefinition.detectionProbes[0]],
  };

  const windowsOnlyDefinition: AgentDefinition = {
    id: AgentId.Copilot,
    displayName: "Windows-only agent",
    detectionProbes: [
      {
        kind: AgentDetectionProbeKind.Path,
        description: "windows-only path",
        base: "home" as const,
        segments: ["AppData", "thing.json"],
        platforms: ["win32"],
      },
    ],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.FileMerge,
      configPaths: [{ base: "home", segments: ["AppData", "thing.json"], platforms: ["win32"] }],
      serversKey: "mcpServers",
    },
  };

  const appBundleDefinition: AgentDefinition = {
    id: AgentId.Cursor,
    displayName: "Cursor",
    detectionProbes: [
      {
        kind: AgentDetectionProbeKind.AppBundle,
        description: "Cursor.app",
        macAppName: "Cursor.app",
      },
    ],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.FileMerge,
      configPaths: [{ base: "home", segments: [".cursor", "mcp.json"] }],
      serversKey: "mcpServers",
    },
  };

  function createService(agentDefinitions: AgentDefinition[]) {
    return new AgentDetectionService(logService, homedir, appDataPath, fsAdapter, agentDefinitions);
  }

  beforeEach(() => {
    logService = mock<LogService>();
    existingPaths = new Set();

    fsAdapter = {
      exists: jest.fn((p: string) => Promise.resolve(existingPaths.has(p))),
    };

    setPlatform("darwin");
    process.env.PATH = pathDirs.join(path.delimiter);
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
    if (originalPath == null) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  });

  it("reports detected: true and which probe matched when the executable is on PATH", async () => {
    existingPaths.add(path.join(pathDirs[0], "claude"));
    const service = createService([claudeDefinition]);

    const [result] = await service.detectAgents();

    expect(result.agentId).toBe(AgentId.Claude);
    expect(result.detected).toBe(true);
    expect(result.probeResults[0]).toEqual({
      probe: claudeDefinition.detectionProbes[0],
      matched: true,
    });
    expect(result.probeResults[1]).toEqual({
      probe: claudeDefinition.detectionProbes[1],
      matched: false,
    });
  });

  it("reports detected: true when only the config path probe matches", async () => {
    existingPaths.add("/Users/test/.claude.json");
    const service = createService([claudeDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(true);
    expect(result.probeResults[0].matched).toBe(false);
    expect(result.probeResults[1].matched).toBe(true);
  });

  it("reports detected: false when no probe matches", async () => {
    const service = createService([claudeDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(false);
    expect(result.probeResults.every((r) => !r.matched)).toBe(true);
  });

  it("never throws when the fs adapter rejects", async () => {
    fsAdapter.exists = jest.fn().mockRejectedValue(new Error("boom"));
    const service = createService([claudeDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(false);
    expect(logService.warning).toHaveBeenCalled();
  });

  it("skips a path probe restricted to a platform the current process isn't running on", async () => {
    setPlatform("darwin");
    existingPaths.add("/Users/test/AppData/thing.json");
    const service = createService([windowsOnlyDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(false);
  });

  it("runs a platform-restricted path probe when the current process matches", async () => {
    setPlatform("win32");
    existingPaths.add("/Users/test/AppData/thing.json");
    const service = createService([windowsOnlyDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(true);
  });

  it("matches an app-bundle probe only on macOS, and only when the bundle exists", async () => {
    existingPaths.add("/Applications/Cursor.app");
    const service = createService([appBundleDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(true);
  });

  it("never matches an app-bundle probe on a non-macOS platform even if the path exists", async () => {
    setPlatform("win32");
    existingPaths.add("/Applications/Cursor.app");
    const service = createService([appBundleDefinition]);

    const [result] = await service.detectAgents();

    expect(result.detected).toBe(false);
  });

  it("detects every configured agent independently in one call", async () => {
    existingPaths.add(path.join(pathDirs[0], "claude"));
    existingPaths.add("/Applications/Cursor.app");
    const service = createService([claudeDefinition, appBundleDefinition]);

    const results = await service.detectAgents();

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.agentId === AgentId.Claude)?.detected).toBe(true);
    expect(results.find((r) => r.agentId === AgentId.Cursor)?.detected).toBe(true);
  });

  describe("executable probe (PATH scan, no execution)", () => {
    it("never spawns a process — presence is determined purely via the injected fs adapter", async () => {
      existingPaths.add(path.join(pathDirs[0], "claude"));
      const service = createService([claudeDefinition]);

      await service.detectAgents();

      // Every call the executable probe makes goes through fsAdapter.exists; there is no
      // process-running collaborator involved at all (see AgentDetectionService's constructor).
      expect(fsAdapter.exists).toHaveBeenCalledWith(path.join(pathDirs[0], "claude"));
    });

    it("finds a binary in a directory in the middle of PATH, not just the first entry", async () => {
      existingPaths.add(path.join(pathDirs[1], "claude"));
      const service = createService([claudeDefinition]);

      const [result] = await service.detectAgents();

      expect(result.probeResults[0].matched).toBe(true);
    });

    it("respects Windows candidate extensions (.cmd/.exe/.bat) during the PATH scan", async () => {
      setPlatform("win32");
      existingPaths.add(path.join(pathDirs[2], "claude.cmd"));
      const service = createService([claudeDefinition]);

      const [result] = await service.detectAgents();

      expect(result.probeResults[0].matched).toBe(true);
      expect(fsAdapter.exists).toHaveBeenCalledWith(path.join(pathDirs[2], "claude.cmd"));
    });

    it("returns false when PATH is empty", async () => {
      process.env.PATH = "";
      const service = createService([executableOnlyDefinition]);

      const [result] = await service.detectAgents();

      expect(result.probeResults[0].matched).toBe(false);
      expect(fsAdapter.exists).not.toHaveBeenCalled();
    });

    it("returns false when PATH is unset", async () => {
      delete process.env.PATH;
      const service = createService([executableOnlyDefinition]);

      const [result] = await service.detectAgents();

      expect(result.probeResults[0].matched).toBe(false);
      expect(fsAdapter.exists).not.toHaveBeenCalled();
    });
  });

  describe("path probe base resolution", () => {
    it("resolves a Home-based probe against the injected homedir", async () => {
      const definition: AgentDefinition = {
        ...claudeDefinition,
        detectionProbes: [
          {
            kind: AgentDetectionProbeKind.Path,
            description: "~/.claude/",
            base: "home" as const,
            segments: [".claude", "settings.json"],
          },
        ],
      };
      existingPaths.add(path.join(homedir, ".claude", "settings.json"));
      const service = createService([definition]);

      const [result] = await service.detectAgents();

      expect(result.detected).toBe(true);
      expect(fsAdapter.exists).toHaveBeenCalledWith(path.join(homedir, ".claude", "settings.json"));
    });

    it("resolves an AppData-based probe against the injected appDataPath, not the homedir", async () => {
      const definition: AgentDefinition = {
        ...claudeDefinition,
        detectionProbes: [
          {
            kind: AgentDetectionProbeKind.Path,
            description: "<appData>/Code/User/mcp.json",
            base: "appData" as const,
            segments: ["Code", "User", "mcp.json"],
          },
        ],
      };
      existingPaths.add(path.join(appDataPath, "Code", "User", "mcp.json"));
      const service = createService([definition]);

      const [result] = await service.detectAgents();

      expect(result.detected).toBe(true);
      expect(fsAdapter.exists).toHaveBeenCalledWith(
        path.join(appDataPath, "Code", "User", "mcp.json"),
      );
      expect(fsAdapter.exists).not.toHaveBeenCalledWith(
        path.join(homedir, "Code", "User", "mcp.json"),
      );
    });
  });
});
