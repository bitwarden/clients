import { DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  CalloutModule,
  DialogService,
  IconButtonModule,
  LinkModule,
  MenuModule,
  NoItemsModule,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OpenShellSandboxMeta } from "../models/openshell-environments";
import {
  OpenShellManagementError,
  OpenShellSandbox,
  OpenShellSandboxAction,
} from "../models/openshell-management";
import {
  clearOpenShellSandboxMeta,
  OPENSHELL_META_COLOR_CLASS,
} from "../utils/openshell-environments.util";
import { openShellPhaseKind as phaseKind } from "../utils/openshell-phase.util";

import { AgentAccessOpenShellCreateSandboxDialogComponent } from "./agent-access-openshell-create-sandbox-dialog.component";
import { AgentAccessOpenShellViewToggleComponent } from "./agent-access-openshell-view-toggle.component";

/** Consecutive failed background refreshes tolerated before the list gives way to the error. */
const MAX_SILENT_FAILURES = 3;
/** How often the list is re-read while a sandbox is still coming up. */
const POLL_MS = 5_000;

interface ListFailure {
  error: OpenShellManagementError;
  message?: string;
}

/**
 * "OpenShell" tab of the Agent Access page (agent-access-architecture.md, §M8.20): the sandboxes on
 * the OpenShell gateway as a table (the Secrets Manager machine-account list pattern), with create,
 * start, stop and delete. A row opens the sandbox's own page, where its vault secrets and
 * permissions live.
 *
 * Nothing is assumed to have worked: every action is followed by a fresh list. While any sandbox is
 * provisioning (any phase other than Ready, Stopped or a failure) the list is re-read every 5 s; the
 * timer stops when everything settles, after three failed background reads in a row, and when the
 * page is destroyed.
 *
 * Names, phases and timestamps are gateway-reported and rendered as text only. Failure messages come
 * from main already scrubbed; they are shown as given and never parsed.
 */
@Component({
  selector: "app-agent-access-openshell-page",
  templateUrl: "agent-access-openshell-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AgentAccessOpenShellViewToggleComponent,
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    DatePipe,
    I18nPipe,
    IconButtonModule,
    LinkModule,
    MenuModule,
    NoItemsModule,
    RouterLink,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellPageComponent implements OnInit {
  private readonly dialogService = inject(DialogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly skeletonRows = [0, 1, 2];

  /** `null` until the first read finishes. */
  protected readonly sandboxes = signal<OpenShellSandbox[] | null>(null);
  protected readonly loading = signal(true);
  protected readonly failure = signal<ListFailure | null>(null);
  /** The scrubbed message of the last failed action, if any. */
  protected readonly actionError = signal<string | null>(null);
  /** Names of sandboxes with an action in flight. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());
  /** What the user wrote about each sandbox (purpose, accent color), by name. Display only. */
  protected readonly meta = signal<Readonly<Record<string, OpenShellSandboxMeta>>>({});

  protected readonly failureKey = computed(() => failureKeyFor(this.failure()?.error));

  private readonly poll: { handle: ReturnType<typeof setInterval> | null } = { handle: null };
  /** Orders overlapping reads: only the newest one may write the signals. */
  private readonly reads = { sequence: 0, silentFailures: 0 };

  async ngOnInit(): Promise<void> {
    this.destroyRef.onDestroy(() => this.stopPolling());
    await this.load(false);
  }

  protected async refresh(): Promise<void> {
    await this.load(false);
  }

  protected purposeOf(name: string): string {
    return this.meta()[name]?.purpose ?? "";
  }

  protected colorClassOf(name: string): string | null {
    const color = this.meta()[name]?.color;
    return color == null ? null : OPENSHELL_META_COLOR_CLASS[color];
  }

  protected isBusy(name: string): boolean {
    return this.busy().has(name);
  }

  protected isReady(sandbox: OpenShellSandbox): boolean {
    return phaseKind(sandbox.phase) === "ready";
  }

  protected isStopped(sandbox: OpenShellSandbox): boolean {
    return phaseKind(sandbox.phase) === "stopped";
  }

  protected phaseVariant(sandbox: OpenShellSandbox): BadgeVariant {
    switch (phaseKind(sandbox.phase)) {
      case "ready":
        return "success";
      case "stopped":
        return "subtle";
      case "error":
        return "danger";
      default:
        return "warning";
    }
  }

  /** The gateway's timestamp as a `Date` when it parses, otherwise `null` (shown verbatim). */
  protected createdDate(sandbox: OpenShellSandbox): Date | null {
    const raw = sandbox.createdAt?.trim();
    if (!raw) {
      return null;
    }
    const parsed = /^\d+$/.test(raw) ? new Date(Number(raw)) : new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  protected async openCreateDialog(): Promise<void> {
    const dialogRef = AgentAccessOpenShellCreateSandboxDialogComponent.open(this.dialogService);
    const createdName = await firstValueFrom(dialogRef.closed);
    if (typeof createdName !== "string" || createdName === "") {
      return;
    }
    await this.router.navigate([createdName], { relativeTo: this.route });
  }

  protected async start(sandbox: OpenShellSandbox): Promise<void> {
    await this.runAction("start", sandbox);
  }

  protected async stop(sandbox: OpenShellSandbox): Promise<void> {
    await this.runAction("stop", sandbox);
  }

  protected async delete(sandbox: OpenShellSandbox): Promise<void> {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "agentAccessOsPageDeleteTitle" },
      content: { key: "agentAccessOsPageDeleteContent", placeholders: [sandbox.name] },
      acceptButtonText: { key: "delete" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    await this.runAction("delete", sandbox);
  }

  private async runAction(action: OpenShellSandboxAction, sandbox: OpenShellSandbox) {
    this.actionError.set(null);
    this.setBusy(sandbox.name, true);
    try {
      const result = await ipc.agentAccess.openShellSandboxAction({ action, name: sandbox.name });
      if (!result.ok) {
        this.actionError.set(
          result.message?.trim() || this.i18nService.t(failureKeyFor(result.error)),
        );
      } else if (action === "delete") {
        await clearOpenShellSandboxMeta(sandbox.name);
      }
    } finally {
      // Never assume it worked (or didn't): re-read, then release the row.
      await this.load(true);
      this.setBusy(sandbox.name, false);
    }
  }

  private setBusy(name: string, busy: boolean): void {
    const next = new Set(this.busy());
    if (busy) {
      next.add(name);
    } else {
      next.delete(name);
    }
    this.busy.set(next);
  }

  /**
   * Reads the list. `silent` reads (after an action, or from the timer) keep the current rows on
   * screen instead of swapping them for the skeleton.
   */
  private async load(silent: boolean): Promise<void> {
    const sequence = ++this.reads.sequence;
    if (!silent) {
      this.loading.set(true);
    }
    const result = await ipc.agentAccess.listOpenShellSandboxes();
    if (sequence !== this.reads.sequence) {
      return;
    }
    if (result.ok) {
      this.reads.silentFailures = 0;
      this.failure.set(null);
      this.sandboxes.set(result.data);
    } else if (
      silent &&
      this.sandboxes() != null &&
      ++this.reads.silentFailures < MAX_SILENT_FAILURES
    ) {
      // A failed background refresh leaves the last good list on screen; the next tick retries.
    } else {
      this.sandboxes.set(null);
      this.failure.set({ error: result.error, message: result.message });
    }
    this.loading.set(false);
    this.syncPolling();
    if (result.ok) {
      await this.loadMeta(sequence);
    }
  }

  /** Best effort: without it the list simply has no subtitles. */
  private async loadMeta(sequence: number): Promise<void> {
    try {
      const result = await ipc.agentAccess.getOpenShellSandboxMeta();
      if (result.ok && sequence === this.reads.sequence) {
        this.meta.set(Object.fromEntries(result.data.map((entry) => [entry.name, entry])));
      }
    } catch {
      // Metadata is optional.
    }
  }

  private syncPolling(): void {
    const needsPolling = (this.sandboxes() ?? []).some((sandbox) => {
      // Only a sandbox still on its way somewhere is worth re-reading; Ready, Stopped and a failed
      // one are all resting states.
      return phaseKind(sandbox.phase) === "other";
    });
    if (needsPolling && this.poll.handle == null) {
      this.poll.handle = setInterval(() => void this.load(true), POLL_MS);
    } else if (!needsPolling) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.poll.handle != null) {
      clearInterval(this.poll.handle);
      this.poll.handle = null;
    }
  }
}

function failureKeyFor(error: OpenShellManagementError | undefined): string {
  switch (error) {
    case "cliMissing":
      return "agentAccessOsPageErrorCliMissing";
    case "gatewayUnreachable":
      return "agentAccessOsPageErrorGatewayUnreachable";
    case "unsupported":
      return "agentAccessOsPageErrorUnsupported";
    default:
      return "agentAccessOsPageErrorFailed";
  }
}
