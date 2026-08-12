import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { AgentId } from "../models/agent-id";
import {
  AgentRegistrationStatus,
  AgentRegistrationStatusResult,
} from "../models/agent-registration-status";
import { AGENT_DEFINITIONS } from "../models/agent-registry";
import { BITWARDEN_MCP_SERVER_NAME } from "../models/mcp-config";

import { AgentAccessRegistrationStatusService } from "./agent-access-registration-status.service";
import { AgentAccessRegistrationFs } from "./agent-access-registration.service";

describe("AgentAccessRegistrationStatusService", () => {
  const homedir = "/Users/test";
  const appDataPath = "/Users/test/Library/Application Support";
  const originalPlatform = process.platform;

  let logService: jest.Mocked<LogService>;
  let files: Map<string, string>;
  let fsAdapter: jest.Mocked<AgentAccessRegistrationFs>;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  function createService() {
    return new AgentAccessRegistrationStatusService(
      logService,
      homedir,
      appDataPath,
      fsAdapter,
      Object.values(AGENT_DEFINITIONS),
    );
  }

  function statusFor(results: AgentRegistrationStatusResult[], agentId: AgentId) {
    return results.find((r) => r.agentId === agentId)?.status;
  }

  beforeEach(() => {
    logService = mock<LogService>();
    files = new Map();
    // A full (read+write) fs mock is used deliberately, even though the service's own dependency
    // type has no write methods — this lets the tests below assert those write methods are never
    // invoked, as an extra runtime check on top of the type-level guarantee.
    fsAdapter = mock<AgentAccessRegistrationFs>();
    fsAdapter.exists.mockImplementation((p: string) => Promise.resolve(files.has(p)));
    fsAdapter.readFile.mockImplementation((p: string) => {
      const content = files.get(p);
      return content === undefined ? Promise.reject(new Error("ENOENT")) : Promise.resolve(content);
    });
    setPlatform("darwin");
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("never calls any write method on the injected fs, for any input", async () => {
    files.set(
      "/Users/test/.claude.json",
      JSON.stringify({
        mcpServers: { [BITWARDEN_MCP_SERVER_NAME]: { command: "aac", args: ["mcp"] } },
      }),
    );
    files.set("/Users/test/.codex/config.toml", "not toml at all {{{");
    files.set("/Users/test/.cursor/mcp.json", "{ broken");
    const service = createService();

    await service.getAgentRegistrationStatuses();

    expect(fsAdapter.writeFile).not.toHaveBeenCalled();
    expect(fsAdapter.mkdir).not.toHaveBeenCalled();
  });

  describe("Claude Code (~/.claude.json, JSON)", () => {
    const configPath = "/Users/test/.claude.json";

    it("registered when mcpServers.bitwarden is present", async () => {
      files.set(
        configPath,
        JSON.stringify({
          mcpServers: { [BITWARDEN_MCP_SERVER_NAME]: { command: "aac", args: ["mcp"] } },
        }),
      );

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Claude)).toBe(AgentRegistrationStatus.Registered);
    });

    it("notRegistered when the file parses but has no bitwarden entry", async () => {
      files.set(configPath, JSON.stringify({ mcpServers: { other: { command: "x", args: [] } } }));

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Claude)).toBe(AgentRegistrationStatus.NotRegistered);
    });

    it("unknown when the file is missing", async () => {
      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Claude)).toBe(AgentRegistrationStatus.Unknown);
    });

    it("unknown when the file is malformed JSON", async () => {
      files.set(configPath, "{ not valid json");

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Claude)).toBe(AgentRegistrationStatus.Unknown);
      expect(logService.warning).toHaveBeenCalled();
    });

    it("unknown when the JSON root isn't an object", async () => {
      files.set(configPath, JSON.stringify(["not", "an", "object"]));

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Claude)).toBe(AgentRegistrationStatus.Unknown);
    });
  });

  describe("Codex CLI (~/.codex/config.toml, TOML)", () => {
    const configPath = "/Users/test/.codex/config.toml";

    it("registered when the [mcp_servers.bitwarden] header is present", async () => {
      files.set(configPath, '[mcp_servers.bitwarden]\ncommand = "aac"\nargs = ["mcp"]\n');

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Codex)).toBe(AgentRegistrationStatus.Registered);
    });

    it("registered when the header has extra whitespace", async () => {
      files.set(configPath, '[ mcp_servers . bitwarden ]\ncommand = "aac"\n');

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Codex)).toBe(AgentRegistrationStatus.Registered);
    });

    it("notRegistered when the file parses cleanly with no bitwarden section", async () => {
      files.set(configPath, '[mcp_servers.other]\ncommand = "other"\n');

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Codex)).toBe(AgentRegistrationStatus.NotRegistered);
    });

    it("unknown when the file is missing", async () => {
      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Codex)).toBe(AgentRegistrationStatus.Unknown);
    });

    it("unknown (fail-safe) when the scan is inconclusive rather than guessing not-registered", async () => {
      files.set(
        configPath,
        '# mcp_servers.bitwarden section removed\nbitwarden = "yes"\n[mcp_servers]\n',
      );

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Codex)).toBe(AgentRegistrationStatus.Unknown);
    });
  });

  // Cursor and Gemini write via Deeplink/ManualCommand now, not FileMerge (see models/agent-
  // registration.ts) — but every agent still declares a top-level `readOnlyStatusConfig` (JSON
  // format for these three), which is what these tests exercise.
  describe("readOnlyStatusConfig-driven agents (Cursor, Gemini, Copilot)", () => {
    it("registered for Cursor when mcpServers.bitwarden is present", async () => {
      files.set(
        "/Users/test/.cursor/mcp.json",
        JSON.stringify({
          mcpServers: { [BITWARDEN_MCP_SERVER_NAME]: { command: "aac", args: [] } },
        }),
      );

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Cursor)).toBe(AgentRegistrationStatus.Registered);
    });

    it("notRegistered for Gemini when settings.json has no bitwarden entry", async () => {
      files.set("/Users/test/.gemini/settings.json", JSON.stringify({ mcpServers: {} }));

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Gemini)).toBe(AgentRegistrationStatus.NotRegistered);
    });

    it("registered for Copilot under the `servers` key, resolved from the injected appDataPath (not the homedir)", async () => {
      files.set(
        "/Users/test/Library/Application Support/Code/User/mcp.json",
        JSON.stringify({ servers: { [BITWARDEN_MCP_SERVER_NAME]: { command: "aac", args: [] } } }),
      );

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Copilot)).toBe(AgentRegistrationStatus.Registered);
    });

    it("unknown for Copilot when the appData-resolved config file doesn't exist", async () => {
      // Copilot's config path is now `base: "appData"` with no `platforms` restriction (VS Code's
      // "Code/User" profile directory resolves the same way, via app.getPath("appData"), on every
      // platform) — so this is "unknown because the file is missing", not "unknown because the
      // platform is unsupported" the way the old per-platform `home`-based specs were.
      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Copilot)).toBe(AgentRegistrationStatus.Unknown);
    });

    it("unknown when a readOnlyStatusConfig-driven config is malformed JSON", async () => {
      files.set("/Users/test/.cursor/mcp.json", "{ nope");

      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Cursor)).toBe(AgentRegistrationStatus.Unknown);
    });

    it("unknown when the file is missing", async () => {
      const results = await createService().getAgentRegistrationStatuses();

      expect(statusFor(results, AgentId.Gemini)).toBe(AgentRegistrationStatus.Unknown);
    });
  });

  it("one agent's broken config doesn't affect another agent's result", async () => {
    files.set("/Users/test/.claude.json", "{ broken");
    files.set(
      "/Users/test/.cursor/mcp.json",
      JSON.stringify({ mcpServers: { [BITWARDEN_MCP_SERVER_NAME]: { command: "aac", args: [] } } }),
    );

    const results = await createService().getAgentRegistrationStatuses();

    expect(statusFor(results, AgentId.Claude)).toBe(AgentRegistrationStatus.Unknown);
    expect(statusFor(results, AgentId.Cursor)).toBe(AgentRegistrationStatus.Registered);
  });

  it("resolves unknown, never a throw, when the fs adapter itself rejects on read", async () => {
    fsAdapter.exists.mockResolvedValue(true);
    fsAdapter.readFile.mockRejectedValue(new Error("EACCES: permission denied"));

    const results = await createService().getAgentRegistrationStatuses();

    expect(results).toHaveLength(5);
    expect(results.every((r) => r.status === AgentRegistrationStatus.Unknown)).toBe(true);
    expect(logService.warning).toHaveBeenCalled();
  });
});
