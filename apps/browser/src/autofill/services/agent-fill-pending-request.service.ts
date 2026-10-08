import { Observable } from "rxjs";

import { AGENT_FILL_MEMORY, GlobalState, KeyDefinition, StateProvider } from "@bitwarden/state";

/** An agent fill request waiting for the user's approval in the desktop app. */
export type AgentFillPendingRequest = {
  /** Local to one fill call; the same one the desktop app sends to prepare and fill. */
  approvalId: string;
  /** The tab's real domain, not the URL the agent sent. */
  domain: string;
  /** The name of the connection that asked, for example "Claude Desktop". */
  connectionName: string;
};

const PENDING_REQUEST = new KeyDefinition<AgentFillPendingRequest | null>(
  AGENT_FILL_MEMORY,
  "pendingRequest",
  { deserializer: (value) => value },
);

/**
 * The request the popup shows as waiting. The background writes it, the popup only reads it, and
 * nothing here can approve anything: approval happens only in the desktop app.
 */
export class AgentFillPendingRequestService {
  private readonly state: GlobalState<AgentFillPendingRequest | null>;

  constructor(stateProvider: StateProvider) {
    this.state = stateProvider.getGlobal(PENDING_REQUEST);
  }

  get pendingRequest$(): Observable<AgentFillPendingRequest | null> {
    return this.state.state$;
  }

  async setPending(request: AgentFillPendingRequest): Promise<void> {
    await this.state.update(() => request);
  }

  /** Clears the pending request, but only if it is the given one, so a late close cannot wipe a newer request. */
  async clear(approvalId: string): Promise<void> {
    await this.state.update((current) => (current?.approvalId === approvalId ? null : current), {
      shouldUpdate: (current) => current?.approvalId === approvalId,
    });
  }
}
