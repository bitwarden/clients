import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AgentId } from "../models/agent-id";
import {
  DeeplinkFormat,
  ManualCommandStyle,
  McpRegistrationStrategyKind,
} from "../models/agent-registration";
import { AgentDefinition } from "../models/agent-registry";

import {
  AgentAccessRegistrationFs,
  AgentAccessRegistrationService,
} from "./agent-access-registration.service";

describe("AgentAccessRegistrationService", () => {
  const homedir = "/Users/test";
  const appDataPath = "/Users/test/Library/Application Support";
  const aacPath = "/Applications/Bitwarden.app/Contents/MacOS/aac";
  const originalPlatform = process.platform;

  let logService: jest.Mocked<LogService>;
  let files: Map<string, string>;
  let fsAdapter: AgentAccessRegistrationFs;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  const cursorDefinition: AgentDefinition = {
    id: AgentId.Cursor,
    displayName: "Cursor",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.FileMerge,
      configPaths: [{ base: "home", segments: [".cursor", "mcp.json"] }],
      serversKey: "mcpServers",
    },
  };

  const copilotDefinition: AgentDefinition = {
    id: AgentId.Copilot,
    displayName: "GitHub Copilot",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.FileMerge,
      configPaths: [
        { base: "home", segments: ["mac-vscode", "mcp.json"], platforms: ["darwin"] },
        { base: "home", segments: ["win-vscode", "mcp.json"], platforms: ["win32"] },
      ],
      serversKey: "servers",
    },
  };

  const copilotAppDataDefinition: AgentDefinition = {
    id: AgentId.Copilot,
    displayName: "GitHub Copilot",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.FileMerge,
      configPaths: [{ base: "appData", segments: ["Code", "User", "mcp.json"] }],
      serversKey: "servers",
    },
  };

  const claudeDefinition: AgentDefinition = {
    id: AgentId.Claude,
    displayName: "Claude Code",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.ManualCommand,
      style: ManualCommandStyle.ClaudeMcpAdd,
      extraOptions: ["--scope", "user"],
    },
  };

  const codexDefinition: AgentDefinition = {
    id: AgentId.Codex,
    displayName: "Codex CLI",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.ManualCommand,
      style: ManualCommandStyle.CodexMcpAdd,
    },
  };

  const geminiDefinition: AgentDefinition = {
    id: AgentId.Gemini,
    displayName: "Gemini CLI",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.ManualCommand,
      style: ManualCommandStyle.GeminiMcpAdd,
      extraOptions: ["--scope", "user"],
    },
  };

  const cursorDeeplinkDefinition: AgentDefinition = {
    id: AgentId.Cursor,
    displayName: "Cursor",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.Deeplink,
      format: DeeplinkFormat.CursorInstall,
    },
  };

  const copilotDeeplinkWithFallbackDefinition: AgentDefinition = {
    id: AgentId.Copilot,
    displayName: "GitHub Copilot",
    detectionProbes: [],
    registrationStrategy: {
      kind: McpRegistrationStrategyKind.Deeplink,
      format: DeeplinkFormat.VsCodeInstall,
      fallback: {
        kind: McpRegistrationStrategyKind.FileMerge,
        configPaths: [{ base: "appData", segments: ["Code", "User", "mcp.json"] }],
        serversKey: "servers",
      },
    },
  };

  function createService(agentDefinitions: Partial<Record<AgentId, AgentDefinition>>) {
    return new AgentAccessRegistrationService(
      logService,
      homedir,
      appDataPath,
      fsAdapter,
      agentDefinitions as Record<AgentId, AgentDefinition>,
    );
  }

  beforeEach(() => {
    logService = mock<LogService>();
    files = new Map();
    fsAdapter = {
      exists: jest.fn((p: string) => Promise.resolve(files.has(p))),
      readFile: jest.fn((p: string) => {
        const content = files.get(p);
        if (content === undefined) {
          return Promise.reject(new Error("ENOENT"));
        }
        return Promise.resolve(content);
      }),
      writeFile: jest.fn((p: string, data: string) => {
        files.set(p, data);
        return Promise.resolve();
      }),
      mkdir: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn((from: string, to: string) => {
        const content = files.get(from);
        if (content === undefined) {
          return Promise.reject(new Error("ENOENT"));
        }
        files.delete(from);
        files.set(to, content);
        return Promise.resolve();
      }),
    };
    setPlatform("darwin");
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  describe("common guards", () => {
    it("returns an error and touches nothing when the bundled CLI path is null", async () => {
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, null);

      expect(result.status).toBe("error");
      expect(files.size).toBe(0);
    });

    it("returns an error for an agent id that isn't registered", async () => {
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent("not-a-real-agent" as AgentId, aacPath);

      expect(result.status).toBe("error");
    });
  });

  describe("non-FileMerge agents (ManualCommand, Deeplink)", () => {
    it.each([
      ["Claude Code", AgentId.Claude, claudeDefinition],
      ["Codex CLI", AgentId.Codex, codexDefinition],
      ["Gemini CLI", AgentId.Gemini, geminiDefinition],
    ] as const)(
      "returns a clear error, without writing anything, for %s (ManualCommand)",
      async (label, agentId, definition) => {
        const service = createService({ [agentId]: definition });

        const result = await service.registerWithAgent(agentId, aacPath);

        expect(result.status).toBe("error");
        expect(result.message).toContain(label);
        expect(files.size).toBe(0);
      },
    );

    it("returns a clear error, without writing anything, for a Deeplink agent with no fallback", async () => {
      const service = createService({ [AgentId.Cursor]: cursorDeeplinkDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("error");
      expect(files.size).toBe(0);
    });
  });

  describe("Deeplink agent with a declared FileMerge fallback (e.g. Copilot)", () => {
    const configPath = "/Users/test/Library/Application Support/Code/User/mcp.json";

    it("writes through the fallback strategy when registerWithAgent is called for the agent", async () => {
      // The renderer only reaches this via an explicit secondary user action ("VS Code didn't
      // open? Write the config directly"), never as an automatic retry after a failed `launchUri`
      // — see DeeplinkRegistrationStrategy.fallback's doc comment. From this service's point of
      // view, though, once called it's an ordinary FileMerge write.
      const service = createService({ [AgentId.Copilot]: copilotDeeplinkWithFallbackDefinition });

      const result = await service.registerWithAgent(AgentId.Copilot, aacPath);

      expect(result.status).toBe("added");
      const written = JSON.parse(files.get(configPath)!);
      expect(written.servers.bitwarden).toEqual({ command: aacPath, args: ["mcp"] });
    });

    it("reports alreadyPresent via the fallback strategy, the same as any other FileMerge agent", async () => {
      files.set(
        configPath,
        JSON.stringify({ servers: { bitwarden: { command: aacPath, args: ["mcp"] } } }),
      );
      const service = createService({ [AgentId.Copilot]: copilotDeeplinkWithFallbackDefinition });

      const result = await service.registerWithAgent(AgentId.Copilot, aacPath);

      expect(result.status).toBe("alreadyPresent");
    });
  });

  describe("file-merge strategy (e.g. Cursor)", () => {
    const configPath = "/Users/test/.cursor/mcp.json";
    const backupPath = "/Users/test/.cursor/mcp.json.bak";
    const tempPath = "/Users/test/.cursor/mcp.json.tmp";

    it("creates a fresh config, creating the parent directory, when none exists", async () => {
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("added");
      expect(fsAdapter.mkdir).toHaveBeenCalledWith("/Users/test/.cursor");
      const written = JSON.parse(files.get(configPath)!);
      expect(written.mcpServers.bitwarden).toEqual({ command: aacPath, args: ["mcp"] });
      expect(files.has(backupPath)).toBe(false);
    });

    it("writes via a temp file in the same directory and renames it into place (atomic write)", async () => {
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(fsAdapter.writeFile).toHaveBeenCalledWith(tempPath, expect.any(String));
      expect(fsAdapter.rename).toHaveBeenCalledWith(tempPath, configPath);
      // The temp file no longer exists once the rename completes; only the real config does.
      expect(files.has(tempPath)).toBe(false);
      expect(files.has(configPath)).toBe(true);
    });

    it("reports an error, without touching the real config, when the rename fails", async () => {
      (fsAdapter.rename as jest.Mock).mockRejectedValue(new Error("EXDEV"));
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("error");
      expect(files.has(configPath)).toBe(false);
      expect(logService.error).toHaveBeenCalled();
    });

    it("preserves other server entries and other top-level keys", async () => {
      files.set(
        configPath,
        JSON.stringify({
          someOtherTopLevelKey: "keepMe",
          mcpServers: { otherTool: { command: "other", args: ["--flag"] } },
        }),
      );
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("added");
      const written = JSON.parse(files.get(configPath)!);
      expect(written.someOtherTopLevelKey).toBe("keepMe");
      expect(written.mcpServers.otherTool).toEqual({ command: "other", args: ["--flag"] });
      expect(written.mcpServers.bitwarden).toEqual({ command: aacPath, args: ["mcp"] });
    });

    it("writes a .bak backup of the prior file before overwriting it", async () => {
      const original = JSON.stringify({ mcpServers: {} });
      files.set(configPath, original);
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(files.get(backupPath)).toBe(original);
    });

    it("is idempotent: reports alreadyPresent and writes nothing when the entry already matches", async () => {
      files.set(
        configPath,
        JSON.stringify({ mcpServers: { bitwarden: { command: aacPath, args: ["mcp"] } } }),
      );
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("alreadyPresent");
      expect(fsAdapter.writeFile).not.toHaveBeenCalled();
      expect(fsAdapter.rename).not.toHaveBeenCalled();
    });

    it("reports updated when a bitwarden entry exists but points elsewhere", async () => {
      files.set(
        configPath,
        JSON.stringify({ mcpServers: { bitwarden: { command: "/old/path/aac", args: ["mcp"] } } }),
      );
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("updated");
    });

    it("never overwrites a file it couldn't parse as JSON", async () => {
      const malformed = "{ not valid json";
      files.set(configPath, malformed);
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("error");
      expect(files.get(configPath)).toBe(malformed);
      expect(files.has(backupPath)).toBe(false);
      expect(logService.error).toHaveBeenCalled();
    });

    it("never overwrites a file whose JSON root isn't an object", async () => {
      const malformed = JSON.stringify(["not", "an", "object"]);
      files.set(configPath, malformed);
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("error");
      expect(files.get(configPath)).toBe(malformed);
    });

    // Existing entries are user/vendor-written JSON, not guaranteed to have an `args` array (e.g.
    // a `{ url: ... }` shape). Comparing against it must not throw — it should just be treated as
    // "not equal" and fall into the normal overwrite path.
    it("overwrites, without throwing, an existing bitwarden entry that has no args array", async () => {
      files.set(
        configPath,
        JSON.stringify({ mcpServers: { bitwarden: { url: "https://example.com/mcp" } } }),
      );
      const service = createService({ [AgentId.Cursor]: cursorDefinition });

      const result = await service.registerWithAgent(AgentId.Cursor, aacPath);

      expect(result.status).toBe("updated");
      const written = JSON.parse(files.get(configPath)!);
      expect(written.mcpServers.bitwarden).toEqual({ command: aacPath, args: ["mcp"] });
    });
  });

  describe("file-merge strategy with a non-mcpServers key (Copilot/VS Code)", () => {
    const configPath = "/Users/test/mac-vscode/mcp.json";

    it("merges under the configured `servers` key instead of `mcpServers`", async () => {
      const service = createService({ [AgentId.Copilot]: copilotDefinition });

      const result = await service.registerWithAgent(AgentId.Copilot, aacPath);

      expect(result.status).toBe("added");
      const written = JSON.parse(files.get(configPath)!);
      expect(written.servers.bitwarden).toEqual({ command: aacPath, args: ["mcp"] });
      expect(written.mcpServers).toBeUndefined();
    });

    it("picks the config path matching the current platform", async () => {
      setPlatform("win32");
      const service = createService({ [AgentId.Copilot]: copilotDefinition });

      await service.registerWithAgent(AgentId.Copilot, aacPath);

      expect(files.has("/Users/test/win-vscode/mcp.json")).toBe(true);
      expect(files.has(configPath)).toBe(false);
    });

    it("errors instead of writing when the platform has no configured config path", async () => {
      setPlatform("linux");
      const service = createService({ [AgentId.Copilot]: copilotDefinition });

      const result = await service.registerWithAgent(AgentId.Copilot, aacPath);

      expect(result.status).toBe("error");
      expect(files.size).toBe(0);
    });
  });

  describe("file-merge strategy with an appData-based config path", () => {
    it("resolves against the injected appDataPath, not the homedir", async () => {
      const service = createService({ [AgentId.Copilot]: copilotAppDataDefinition });

      const result = await service.registerWithAgent(AgentId.Copilot, aacPath);

      expect(result.status).toBe("added");
      const configPath = "/Users/test/Library/Application Support/Code/User/mcp.json";
      expect(files.has(configPath)).toBe(true);
      expect(files.has("/Users/test/Code/User/mcp.json")).toBe(false);
    });
  });
});
