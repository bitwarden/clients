/**
 * MCP onboarding types (agent-access-architecture.md, "MCP integration (M1/M2)"). Framework-agnostic
 * so both the main process (`AgentAccessRegistrationService`, M3's generalized file-merge writer)
 * and the renderer (`AgentAccessConnectComponent`, rendering/copying the config for Cursor and other
 * MCP clients) can share the same shapes without either importing across the main/renderer
 * boundary — see `apps/desktop/CLAUDE.md`.
 */

/** Key the Bitwarden MCP server entry is stored under in a client's `mcpServers` map. */
export const BITWARDEN_MCP_SERVER_NAME = "bitwarden";

export interface McpServerEntry {
  command: string;
  args: string[];
}

export interface McpServersConfig {
  mcpServers: Record<string, McpServerEntry>;
}

/**
 * Builds the MCP server config for the bundled `aac` CLI's `mcp` subcommand — the same shape
 * shown in the "Copy config" block and merged into a `FileMerge`-strategy agent's config by
 * `AgentAccessRegistrationService`. `aacPath` is the bundled CLI path from
 * `ipc.agentAccess.getBundledCliPath()`.
 */
export function buildBitwardenMcpServerEntry(aacPath: string): McpServerEntry {
  return { command: aacPath, args: ["mcp"] };
}

export function buildBitwardenMcpConfig(aacPath: string): McpServersConfig {
  return { mcpServers: { [BITWARDEN_MCP_SERVER_NAME]: buildBitwardenMcpServerEntry(aacPath) } };
}
