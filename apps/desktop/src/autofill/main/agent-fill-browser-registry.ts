import { AgentFillHello } from "@bitwarden/common/autofill/agent-fill/agent-fill-ipc";
import { Source } from "@bitwarden/sdk-internal";

export type AgentFillBrowserConnection = { clientId: number; hello: AgentFillHello | null };

/**
 * PROTOTYPE: agent autofill. Connected extensions keyed by native messaging client id, with the
 * latest Hello each one sent (null until the first). A browser reconnect gets a fresh client id
 * (new proxy process), so entries are pruned on disconnect.
 */
export class AgentFillBrowserRegistry {
  private connections = new Map<number, AgentFillHello | null>();

  /** Records a client id that has spoken SDK IPC. Returns true if it is new. */
  seen(clientId: number): boolean {
    if (this.connections.has(clientId)) {
      return false;
    }
    this.connections.set(clientId, null);
    return true;
  }

  /** Forgets a closed connection. Returns true if it was known. */
  remove(clientId: number): boolean {
    return this.connections.delete(clientId);
  }

  /**
   * Stores the Hello for the connection it came from. Ignores Hellos from anything other than a
   * known browser connection. Returns the client id it was stored under, or null.
   */
  hello(source: Source, hello: Partial<AgentFillHello> | null | undefined): number | null {
    const clientId =
      typeof source === "object" &&
      "BrowserBackground" in source &&
      typeof source.BrowserBackground.id === "object"
        ? source.BrowserBackground.id.Id
        : null;
    if (clientId == null || !this.connections.has(clientId) || hello == null) {
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

  list(): AgentFillBrowserConnection[] {
    return [...this.connections].map(([clientId, hello]) => ({ clientId, hello }));
  }

  /** Connections whose latest Hello allows agent fills for the user. */
  allowedFor(userId: string): number[] {
    return this.list()
      .filter(({ hello }) => hello?.accounts.some((a) => a.userId === userId && a.agentFillAllowed))
      .map(({ clientId }) => clientId);
  }
}
