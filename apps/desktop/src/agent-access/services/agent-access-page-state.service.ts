import { computed, Injectable, signal } from "@angular/core";

import { AgentAccessGrant } from "../models/agent-access-grant";
import { AgentRegistrationStatusResult } from "../models/agent-registration-status";

/**
 * Shared "is the agent running" status for the Agent Access shell (header tabs + not-running
 * callout) and its routed children (`AgentAccessAgentsComponent`, `AgentAccessActivityComponent`).
 * Provided per-route (see the `agent-access` route's `providers` in `app-routing.module.ts`), so
 * it's a fresh instance each time the page is entered and disposed when it's left — no manual
 * reset needed.
 *
 * Also the single fetch point for two other reads shared across the page's tabs:
 *  - The local grant store (`ipc.agentAccess.listGrants()`): `AgentAccessConnectedAgentsComponent`
 *    renders the full list, and its parent (`AgentAccessAgentsComponent`) reads the same count to
 *    decide between its header CTA and the child's empty-state CTA — one fetch, one answer, so the
 *    two can't disagree.
 *  - The per-agent registration status (`ipc.agentAccess.getAgentRegistrationStatuses()`):
 *    `AgentAccessConnectComponent` (Setup tab) both refreshes and reads it — on init, on an
 *    explicit "Refresh" click, and on window focus; see that component's class doc for why a
 *    read-only probe is the only way this app ever learns a `ManualCommand`/`Deeplink` registration
 *    completed. It lives here rather than in that component so it survives tab switches within the
 *    page.
 */
@Injectable()
export class AgentAccessPageStateService {
  readonly running = signal(false);
  readonly statusLoading = signal(true);
  readonly fingerprint = signal<string | null>(null);

  readonly grants = signal<AgentAccessGrant[]>([]);
  readonly grantsLoading = signal(true);

  /** Grants for local agents (everything but OpenShell sandbox grants). */
  readonly localGrants = computed(() => this.grants().filter((grant) => grant.openshell == null));
  /** OpenShell sandbox grants (§M8.9), listed in their own section on the Agents tab. */
  readonly openShellGrants = computed(() =>
    this.grants().filter((grant) => grant.openshell != null),
  );

  readonly registrationStatuses = signal<AgentRegistrationStatusResult[]>([]);

  async refreshStatus(): Promise<void> {
    this.statusLoading.set(true);
    try {
      const running = await ipc.agentAccess.isLoaded();
      this.running.set(running);
      this.fingerprint.set(running ? await ipc.agentAccess.getFingerprint() : null);
    } finally {
      this.statusLoading.set(false);
    }
  }

  async refreshGrants(): Promise<void> {
    this.grantsLoading.set(true);
    try {
      this.grants.set(await ipc.agentAccess.listGrants());
    } finally {
      this.grantsLoading.set(false);
    }
  }

  /** Kept as a stable arrow field (not a method) so components can bind it directly — e.g.
   *  `AgentAccessConnectComponent`'s "Refresh" `[bitAction]` and its window-focus handler — without
   *  losing `this`. */
  readonly refreshRegistrationStatuses = async (): Promise<void> => {
    this.registrationStatuses.set(await ipc.agentAccess.getAgentRegistrationStatuses());
  };
}
