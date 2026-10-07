import { ChangeDetectionStrategy, Component, effect, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";

import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import {
  AsyncActionsModule,
  ButtonModule,
  CardComponent,
  DialogService,
  IconButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentAccessGrant } from "../models/agent-access-grant";
import { AGENT_ACCESS_IPC_CHANNELS } from "../models/ipc-channels";
import { OpenShellLifetimeMode, openShellDigestPrefix } from "../models/openshell";
import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";

import { AgentAccessConnectedAgentsComponent } from "./agent-access-connected-agents.component";

/** Emitted by `DesktopAgentAccessService` whenever it writes a grant — see `GRANTS_CHANGED`'s doc
 *  in models/ipc-channels.ts. */
const GRANTS_CHANGED_COMMAND = new CommandDefinition<Record<string, never>>(
  AGENT_ACCESS_IPC_CHANNELS.GRANTS_CHANGED,
);

/**
 * "Agents" tab of the Agent Access page — inventory only. Once status/grants finish loading, this
 * tab always renders local agents (`AgentAccessConnectedAgentsComponent`, sourced from the grant
 * store) as its sole content. Adding an agent — local connect, remote pairing — is out of scope
 * here entirely; that's the Setup tab's (`AgentAccessSetupComponent`) job. This split exists
 * because burying the primary "add an agent" flow inside a collapsed "Connect another agent"
 * disclosure on this tab was wrong: it's a main task, not an escape hatch.
 *
 * First-run guidance is a plain CTA linking to the Setup tab, not a progress checklist. An
 * `app-onboarding` stepper used to sit above the list, tracking "Agent Access is running" and
 * "Connect an AI assistant" — it's gone because its steps couldn't reliably be driven from this
 * page: the first isn't a user action at all, and the second could only be completed by leaving for
 * the Setup tab, so the stepper spent most of its life showing a state the user couldn't act on
 * while pushing the actual agent list down the page. A link to the one place that does the work
 * says the same thing without the state machine — and without persisted dismissal state, since
 * there's no longer anything to dismiss.
 *
 * The CTA appears in two places, mutually exclusively: in the section header once at least one
 * agent is connected, and inside the empty state (`AgentAccessConnectedAgentsComponent`'s
 * `bit-no-items`) when none are — the same split the Setup tab's remote-agents section uses, so the
 * user never sees two identical buttons at once.
 *
 * The "not running" state is surfaced by the shell's (`AgentAccessComponent`) callout, which is now
 * this feature's only signal for it.
 */
@Component({
  selector: "app-agent-access-agents",
  templateUrl: "agent-access-agents.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    RouterLink,
    AgentAccessConnectedAgentsComponent,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessAgentsComponent {
  protected readonly pageState = inject(AgentAccessPageStateService);
  private readonly messageListener = inject(MessageListener);
  private readonly dialogService = inject(DialogService);

  /** Placeholder rows shown by the skeleton while status/grants load. */
  protected readonly skeletonRows = [0, 1];

  constructor() {
    // The shell's status resolves independently of this tab's lifecycle, so refetch grants once
    // it settles rather than racing it.
    effect(() => {
      if (this.pageState.statusLoading()) {
        return;
      }
      void this.pageState.refreshGrants();
    });

    // A first-use authorization is driven by an incoming credential request, not by anything on
    // this page, so it can land at any moment — including while this tab is open and has already
    // done the fetch above. Re-read the store when `DesktopAgentAccessService` says it wrote to it,
    // otherwise a newly authorized agent stays missing from the list until the page is re-entered.
    this.messageListener
      .messages$(GRANTS_CHANGED_COMMAND)
      .pipe(takeUntilDestroyed())
      .subscribe(() => void this.pageState.refreshGrants());
  }

  protected digestPrefix(digest: string): string {
    return openShellDigestPrefix(digest);
  }

  protected lifetimeLabelKey(mode: OpenShellLifetimeMode): string {
    switch (mode) {
      case "perRequest":
        return "agentAccessOpenShellLifetimePerRequest";
      case "ttl":
        return "agentAccessOpenShellLifetimeTtl";
      case "sandboxLifetime":
        return "agentAccessOpenShellLifetimeSandbox";
    }
  }

  // Same closure pattern as `AgentAccessConnectedAgentsComponent.removeGrantAction`.
  protected removeGrantAction(grant: AgentAccessGrant) {
    return () => this.removeGrant(grant);
  }

  private async removeGrant(grant: AgentAccessGrant): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessRemoveAgent" },
      content: grant.openshell?.sandboxName || grant.openshell?.sandboxId || grant.displayName,
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await ipc.agentAccess.removeGrant(grant.id);
    await this.pageState.refreshGrants();
  }
}
