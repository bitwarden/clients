import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DevicesIcon } from "@bitwarden/assets/svg";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import type { agent_access } from "@bitwarden/desktop-napi";
import { I18nPipe } from "@bitwarden/ui-common";

import { AgentAccessPageStateService } from "../services/agent-access-page-state.service";
import { shortenFingerprint } from "../utils/shorten-fingerprint";

import { AgentAccessConnectComponent } from "./agent-access-connect.component";
import { AgentAccessOpenShellSectionComponent } from "./agent-access-openshell-section.component";
import { AgentAccessPairAgentDialogComponent } from "./agent-access-pair-agent-dialog.component";

const Pane = Object.freeze({
  Local: "local",
  OpenShell: "openShell",
  Remote: "remote",
} as const);
type Pane = (typeof Pane)[keyof typeof Pane];

/**
 * "Setup" tab of the Agent Access page: every path for adding an agent lives here, and nowhere
 * else. There are exactly two of them, and the tab is laid out as two peer `bit-section`s that say
 * so — "Agents on this computer" (`AgentAccessConnectComponent`) above "Agents on other devices"
 * (this component, opening `AgentAccessPairAgentDialogComponent`) — under a single intro sentence
 * stating the approval guarantee that governs both.
 *
 * This tab exists because burying the primary "add an agent" flow inside a collapsed disclosure on
 * the Agents tab was wrong — it's a main task, not an escape hatch. The Agents tab is now
 * inventory-only (setup checklist + connected agents); this tab is the front door for adding to
 * that inventory, reached either directly via its own nav tab or via the checklist's "Connect an AI
 * assistant" task, which now links here instead of embedding the connect UI inline.
 *
 * ## Why remote pairing is a section and not a disclosure
 *
 * Pairing is still the secondary path — local agents never pair
 * (agent-access-architecture.md, "M2 — onboarding" — "Pairing is demoted to a secondary... action,
 * not the front door"). It earns its demotion by sitting *below* the local section and carrying a
 * quieter action, not by being collapsed. The first pass read that decision as "hide it", and the
 * result was a page whose two top-level paths rendered as a heading and a muted chevron: a user who
 * came here specifically to pair a remote agent could not see the page did that without opening the
 * disclosure, and the trigger label was the only clue it existed. Worse, that chevron sat at the
 * same indentation as the connect UI's own "My agent isn't listed" disclosure, so a sub-option of
 * the local section looked like a peer of the remote one — the hierarchy read exactly inverted.
 *
 * The approval explanation is likewise a page-level intro rather than a paragraph between the two
 * sections. It's equally true of local and remote agents; wedged in between, it read as a trailing
 * footnote on whichever section happened to precede it.
 *
 * `connections`/`connectionsLoading` and everything that operates on them (refresh, remove, the
 * pair dialog) moved here verbatim from `AgentAccessAgentsComponent` — the Agents tab never reads
 * remote connection data itself, so there's no reason for it to keep owning that fetch. `loading`
 * covers the remote section alone; see its doc for why it no longer gates the whole tab.
 */
@Component({
  selector: "app-agent-access-setup",
  templateUrl: "agent-access-setup.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    I18nPipe,
    AgentAccessConnectComponent,
    AgentAccessOpenShellSectionComponent,
    AsyncActionsModule,
    ButtonModule,
    IconButtonModule,
    NoItemsModule,
    SectionComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    ToggleGroupModule,
    TypographyModule,
  ],
})
export class AgentAccessSetupComponent {
  protected readonly Pane = Pane;

  protected readonly selectedPane = signal<Pane>(Pane.Local);

  private readonly openShellSection = viewChild(AgentAccessOpenShellSectionComponent);

  /** The OpenShell toggle only exists when the section applies (detected, Agent Access on, not
   *  Windows) — the section decides that itself, so this reads its answer rather than repeating
   *  the detection logic. */
  protected readonly openShellVisible = computed(() => this.openShellSection()?.visible() ?? false);

  /** `selectedPane`, except an OpenShell selection falls back to the local pane if OpenShell stops
   *  applying (e.g. Agent Access is switched off while the pane is open). */
  protected readonly activePane = computed(() =>
    this.selectedPane() === Pane.OpenShell && !this.openShellVisible()
      ? Pane.Local
      : this.selectedPane(),
  );

  protected readonly pageState = inject(AgentAccessPageStateService);
  private readonly dialogService = inject(DialogService);

  protected readonly DevicesIcon = DevicesIcon;

  /** Placeholder rows shown by the remote-agents skeleton while status/connections load. */
  protected readonly skeletonRows = [0, 1];

  protected readonly connections = signal<agent_access.ConnectionInfoData[]>([]);
  protected readonly connectionsLoading = signal(true);

  /** Scoped to the "Agents on other devices" section only. The local connect UI below the intro
   *  renders its own loading state from its own fetches, so it is never gated on this one — the
   *  page used to hold *everything* behind a single skeleton driven partly by this remote-only
   *  fetch, which blocked the primary path on data only the secondary path reads (and stacked a
   *  second skeleton inside the first once it cleared). */
  protected readonly loading = computed(
    () => this.pageState.statusLoading() || this.connectionsLoading(),
  );

  constructor() {
    // The shell's status resolves independently of this tab's lifecycle (`running` decides
    // whether there's anything to list), so refetch once it settles rather than racing it.
    effect(() => {
      if (this.pageState.statusLoading()) {
        return;
      }
      void this.refreshConnections();
    });
  }

  protected async refreshConnections() {
    this.connectionsLoading.set(true);
    try {
      this.connections.set(this.pageState.running() ? await ipc.agentAccess.listConnections() : []);
    } finally {
      this.connectionsLoading.set(false);
    }
  }

  protected async openPairAgentDialog() {
    const dialogRef = AgentAccessPairAgentDialogComponent.open(this.dialogService);
    await firstValueFrom(dialogRef.closed);
    await this.refreshConnections();
  }

  // Angular template expressions can't contain arrow-function literals, so bitAction (which binds
  // to a zero-arg callable) is fed a closure built here rather than `() => removeConnection(c)`
  // inline in the template.
  protected removeConnectionAction(connection: agent_access.ConnectionInfoData) {
    return () => this.removeConnection(connection);
  }

  private async removeConnection(connection: agent_access.ConnectionInfoData) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessRemoveAgent" },
      content: connection.name ?? this.shortenFingerprint(connection.fingerprint),
      type: "warning",
    });
    if (!confirmed) {
      return;
    }

    await ipc.agentAccess.removeConnection(connection.fingerprint);
    await this.refreshConnections();
  }

  protected shortenFingerprint(fingerprint: string | null): string {
    return shortenFingerprint(fingerprint);
  }

  /** `lastConnectedAt` is unix seconds, stringified. Returns a `Date` for the pipe. */
  protected toDate(unixSeconds: string | undefined): Date | null {
    return unixSeconds ? new Date(Number(unixSeconds) * 1000) : null;
  }
}
