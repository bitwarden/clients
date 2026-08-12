import {
  DeeplinkFormat,
  ManualCommandStyle,
  McpRegistrationStrategyKind,
  buildInstallDeeplink,
  buildManualSetupCommand,
} from "./agent-registration";

describe("buildManualSetupCommand", () => {
  const aacPath = "/Applications/Bitwarden.app/Contents/MacOS/aac";

  it("builds the exact Claude Code command: mcp add, extraOptions, then `-- <path> mcp`", () => {
    const command = buildManualSetupCommand(
      {
        kind: McpRegistrationStrategyKind.ManualCommand,
        style: ManualCommandStyle.ClaudeMcpAdd,
        extraOptions: ["--scope", "user"],
      },
      aacPath,
    );

    expect(command).toBe(`claude mcp add --scope user bitwarden -- "${aacPath}" mcp`);
  });

  it("builds the exact Codex command: no scope flag, `--` before the command", () => {
    const command = buildManualSetupCommand(
      { kind: McpRegistrationStrategyKind.ManualCommand, style: ManualCommandStyle.CodexMcpAdd },
      aacPath,
    );

    expect(command).toBe(`codex mcp add bitwarden -- "${aacPath}" mcp`);
  });

  it("builds the exact Gemini command: mcp add, extraOptions, positional command (no --)", () => {
    const command = buildManualSetupCommand(
      {
        kind: McpRegistrationStrategyKind.ManualCommand,
        style: ManualCommandStyle.GeminiMcpAdd,
        extraOptions: ["--scope", "user"],
      },
      aacPath,
    );

    expect(command).toBe(`gemini mcp add --scope user bitwarden "${aacPath}" mcp`);
  });

  it("omits extraOptions entirely when none are configured", () => {
    const command = buildManualSetupCommand(
      { kind: McpRegistrationStrategyKind.ManualCommand, style: ManualCommandStyle.ClaudeMcpAdd },
      aacPath,
    );

    expect(command).toBe(`claude mcp add bitwarden -- "${aacPath}" mcp`);
  });

  it("always double-quotes the aac path, since it's a filesystem path that may contain spaces", () => {
    const spacedPath = "/Applications/My Bitwarden.app/Contents/MacOS/aac";

    const command = buildManualSetupCommand(
      { kind: McpRegistrationStrategyKind.ManualCommand, style: ManualCommandStyle.CodexMcpAdd },
      spacedPath,
    );

    expect(command).toBe(`codex mcp add bitwarden -- "${spacedPath}" mcp`);
  });

  it("backslash-escapes an embedded double quote in the path", () => {
    const quotedPath = '/Applications/"weird"/aac';

    const command = buildManualSetupCommand(
      { kind: McpRegistrationStrategyKind.ManualCommand, style: ManualCommandStyle.CodexMcpAdd },
      quotedPath,
    );

    expect(command).toBe('codex mcp add bitwarden -- "/Applications/\\"weird\\"/aac" mcp');
  });

  it("never emits shell metacharacters outside of the quoted path argument", () => {
    const command = buildManualSetupCommand(
      {
        kind: McpRegistrationStrategyKind.ManualCommand,
        style: ManualCommandStyle.ClaudeMcpAdd,
        extraOptions: ["--scope", "user"],
      },
      aacPath,
    );

    const withoutQuotedPath = command.replace(`"${aacPath}"`, "PATH");
    expect(withoutQuotedPath).not.toMatch(/[;&|`$]/);
  });
});

describe("buildInstallDeeplink", () => {
  const aacPath = "/Applications/Bitwarden.app/Contents/MacOS/aac";

  it("builds a Cursor install deeplink: cursor://anysphere.cursor-deeplink/mcp/install?name=...&config=<base64 JSON>", () => {
    const uri = buildInstallDeeplink(
      { kind: McpRegistrationStrategyKind.Deeplink, format: DeeplinkFormat.CursorInstall },
      aacPath,
    );

    expect(uri.startsWith("cursor://anysphere.cursor-deeplink/mcp/install?")).toBe(true);
    const params = new URLSearchParams(uri.split("?")[1]);
    expect(params.get("name")).toBe("bitwarden");
    const decodedConfig = JSON.parse(Buffer.from(params.get("config")!, "base64").toString("utf8"));
    expect(decodedConfig).toEqual({ command: aacPath, args: ["mcp"] });
  });

  it("builds a VS Code install deeplink: vscode:mcp/install?<URL-encoded JSON with a name field>", () => {
    const uri = buildInstallDeeplink(
      { kind: McpRegistrationStrategyKind.Deeplink, format: DeeplinkFormat.VsCodeInstall },
      aacPath,
    );

    expect(uri.startsWith("vscode:mcp/install?")).toBe(true);
    const decodedPayload = JSON.parse(decodeURIComponent(uri.slice("vscode:mcp/install?".length)));
    expect(decodedPayload).toEqual({ name: "bitwarden", command: aacPath, args: ["mcp"] });
  });

  it("ignores a declared fallback when building the deeplink (fallback is write-path data only)", () => {
    const uri = buildInstallDeeplink(
      {
        kind: McpRegistrationStrategyKind.Deeplink,
        format: DeeplinkFormat.VsCodeInstall,
        fallback: {
          kind: McpRegistrationStrategyKind.FileMerge,
          configPaths: [{ base: "appData", segments: ["Code", "User", "mcp.json"] }],
          serversKey: "servers",
        },
      },
      aacPath,
    );

    expect(uri.startsWith("vscode:mcp/install?")).toBe(true);
  });
});
