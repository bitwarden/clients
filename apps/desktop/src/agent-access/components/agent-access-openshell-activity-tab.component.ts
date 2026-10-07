import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  NgZone,
  OnInit,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  CalloutModule,
  SkeletonComponent,
  SkeletonGroupComponent,
  SkeletonTextComponent,
  TableModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { OpenShellActivityEvent, OpenShellActivityOutcome } from "../models/openshell-activity";
import { OpenShellManagementError } from "../models/openshell-management";

type ActivityFilter = "all" | "allowed" | "denied";

const OUTCOME_META: Readonly<
  Record<OpenShellActivityOutcome, { labelKey: string; variant: BadgeVariant }>
> = Object.freeze({
  allowed: { labelKey: "agentAccessOsActAllowed", variant: "success" },
  denied: { labelKey: "agentAccessOsActDenied", variant: "danger" },
  notFound: { labelKey: "agentAccessOsActNotFound", variant: "subtle" },
  pending: { labelKey: "agentAccessOsActPending", variant: "warning" },
});

const REFRESH_MS = 10_000;
const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

interface ActivityRow {
  id: string;
  /** Plain-language sentence. */
  text: string;
  /** Relative time, e.g. "2 minutes ago". */
  when: string;
  /** Full local date and time, for the tooltip. */
  exact: string;
  outcome: OpenShellActivityOutcome;
  labelKey: string;
  variant: BadgeVariant;
}

/**
 * "Activity" tab of a sandbox (agent-access-architecture.md, §M8.20 rule 18): what the agent has
 * asked this sandbox's vault credentials for, and whether it was allowed. Only what Desktop really
 * records (when, how many secrets, allowed or denied), never a secret name or value, and never a
 * host or program, which are not recorded. The list is the session's, not a permanent log.
 */
@Component({
  selector: "app-agent-access-openshell-activity-tab",
  templateUrl: "agent-access-openshell-activity-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonModule,
    CalloutModule,
    I18nPipe,
    SkeletonComponent,
    SkeletonGroupComponent,
    SkeletonTextComponent,
    TableModule,
    ToggleGroupModule,
    TypographyModule,
  ],
})
export class AgentAccessOpenShellActivityTabComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly i18nService = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  protected readonly name = toSignal(
    this.route.parent.paramMap.pipe(map((params) => params.get("name"))),
    { initialValue: this.route.parent.snapshot.paramMap.get("name") },
  );

  protected readonly loading = signal(true);
  protected readonly events = signal<OpenShellActivityEvent[]>([]);
  protected readonly failure = signal<{ error: OpenShellManagementError; message?: string } | null>(
    null,
  );
  protected readonly filter = signal<ActivityFilter>("all");
  private readonly now = signal(Date.now());

  protected readonly rows = computed<ActivityRow[]>(() => {
    const filter = this.filter();
    const now = this.now();
    return this.events()
      .filter((event) => filter === "all" || event.outcome === filter)
      .map((event) => {
        const meta = OUTCOME_META[event.outcome];
        return {
          id: event.id,
          text: this.describe(event),
          when: this.relative(event.atMs, now),
          exact: new Date(event.atMs).toLocaleString(),
          outcome: event.outcome,
          labelKey: meta.labelKey,
          variant: meta.variant,
        };
      });
  });

  ngOnInit(): void {
    void this.load(true);
    // Outside the zone: a repeating timer must not keep the app "unstable", and the signals it
    // sets schedule their own change detection.
    const timer = this.ngZone.runOutsideAngular(() =>
      setInterval(() => void this.load(false), REFRESH_MS),
    );
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  protected setFilter(value: ActivityFilter): void {
    this.filter.set(value);
  }

  protected async refresh(): Promise<void> {
    await this.load(true);
  }

  private describe(event: OpenShellActivityEvent): string {
    const agent = event.agentName ?? this.i18nService.t("agentAccessOsActUnknownAgent");
    switch (event.outcome) {
      case "allowed":
        return this.i18nService.t("agentAccessOsActRowAllowed", agent, `${event.secretCount}`);
      case "denied":
        return this.i18nService.t("agentAccessOsActRowDenied", agent, `${event.secretCount}`);
      case "notFound":
        return this.i18nService.t("agentAccessOsActRowNotFound", agent);
      default:
        return this.i18nService.t("agentAccessOsActRowPending", agent, `${event.secretCount}`);
    }
  }

  private relative(atMs: number, now: number): string {
    const diff = atMs - now;
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    for (const [unit, size] of RELATIVE_UNITS) {
      if (Math.abs(diff) >= size) {
        return formatter.format(Math.round(diff / size), unit);
      }
    }
    return formatter.format(0, "minute");
  }

  private async load(showSkeleton: boolean): Promise<void> {
    if (showSkeleton) {
      this.loading.set(true);
    }
    try {
      const sandboxes = await ipc.agentAccess.listOpenShellSandboxes();
      if (!sandboxes.ok) {
        this.failure.set({ error: sandboxes.error, message: sandboxes.message });
        return;
      }
      const sandbox = sandboxes.data.find((candidate) => candidate.name === this.name());
      if (sandbox == null) {
        this.failure.set({ error: "notFound" });
        return;
      }
      const result = await ipc.agentAccess.listOpenShellActivity({ sandboxId: sandbox.id });
      if (!result.ok) {
        this.failure.set({ error: result.error, message: result.message });
        return;
      }
      this.failure.set(null);
      this.events.set(result.data);
      this.now.set(Date.now());
    } catch {
      this.failure.set({ error: "failed" });
    } finally {
      this.loading.set(false);
    }
  }
}
