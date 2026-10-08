import { map, Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { AUTOFILL_SETTINGS_DISK, StateProvider, UserKeyDefinition } from "@bitwarden/state";

const AGENT_FILL_ALLOWED = new UserKeyDefinition<boolean>(
  AUTOFILL_SETTINGS_DISK,
  "agentFillAllowed",
  {
    deserializer: (value) => value,
    clearOn: ["logout"],
  },
);

/** Off by default: agent fills are an explicit opt-in per account and per browser. */
const DEFAULT_AGENT_FILL_ALLOWED = false;

/**
 * The per-account "Allow agents to fill in this browser" setting. It
 * marks this browser as one that fills for the account; the extension reports it to the desktop
 * app in its Hello message and refuses agent fills while it is off.
 */
export class AgentFillSettingsService {
  constructor(private stateProvider: StateProvider) {}

  agentFillAllowed$(userId: UserId): Observable<boolean> {
    return this.stateProvider
      .getUserState$(AGENT_FILL_ALLOWED, userId)
      .pipe(map((value) => value ?? DEFAULT_AGENT_FILL_ALLOWED));
  }

  async setAgentFillAllowed(value: boolean, userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, AGENT_FILL_ALLOWED).update(() => value);
  }
}
