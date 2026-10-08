import { AgentFillHello } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { Source } from "@bitwarden/sdk-internal";

export type AgentFillBrowserConnection = { clientId: number; hello: AgentFillHello };

/**
 * Connected extensions keyed by native messaging client id, with the latest Hello each one sent.
 * A browser reconnect gets a fresh client id (new proxy process), so entries are pruned on
 * disconnect. A connection is only known once it has sent a Hello.
 */
export class AgentFillBrowserRegistry {
  private connections = new Map<number, AgentFillHello>();

  /**
   * Stores the Hello for the connection it came from. Ignores Hellos from anything other than a
   * browser background page. Returns the client id it was stored under, or null.
   */
  hello(source: Source, hello: Partial<AgentFillHello> | null | undefined): number | null {
    const clientId =
      typeof source === "object" &&
      "BrowserBackground" in source &&
      typeof source.BrowserBackground.id === "object"
        ? source.BrowserBackground.id.Id
        : null;
    if (clientId == null || hello == null) {
      return null;
    }
    this.connections.set(clientId, {
      browser: String(hello.browser ?? ""),
      extensionVersion: String(hello.extensionVersion ?? ""),
      activeUserId: hello.activeUserId ?? null,
      accounts: Array.isArray(hello.accounts)
        ? hello.accounts.map((a) => ({
            userId: String(a?.userId ?? ""),
            agentFillAllowed: a?.agentFillAllowed === true,
          }))
        : [],
    });
    return clientId;
  }

  /** Forgets a closed connection. Returns true if it was known. */
  remove(clientId: number): boolean {
    return this.connections.delete(clientId);
  }

  list(): AgentFillBrowserConnection[] {
    return [...this.connections].map(([clientId, hello]) => ({ clientId, hello }));
  }

  /** Connections whose latest Hello allows agent fills for the user. */
  allowedFor(userId: string): number[] {
    return this.list()
      .filter(({ hello }) => hello.accounts.some((a) => a.userId === userId && a.agentFillAllowed))
      .map(({ clientId }) => clientId);
  }
}
