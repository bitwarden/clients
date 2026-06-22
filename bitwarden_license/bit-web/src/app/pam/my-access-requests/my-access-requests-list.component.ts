import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  NgZone,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { filter } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import {
  AccessRequestStatus,
  formatDurationShort,
  formatRelativeTime,
  formatRemaining,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  BadgeComponent,
  ButtonModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { MyAccessRequestsService } from "./my-access-requests.service";
import { LeaseRow, MY_REQUESTS_PAGE_LIMIT, MyRequestRow } from "./my-request-row";

// Re-export the row helpers so existing importers (tests, stories) keep a stable entry point.
export {
  MY_REQUESTS_PAGE_LIMIT,
  resolveResolver,
  statusBadgeVariant,
  statusLabelKey,
  toRow,
} from "./my-request-row";
export type { LeaseRow, MyRequestRow } from "./my-request-row";

/**
 * The caller's own access requests and active leases, split into:
 *  - Active leases (the leases they currently hold)
 *  - Pending      (requests awaiting a decision)
 *  - History      (every resolved request)
 *
 * Data, name resolution, and optimistic cancel/activate live in {@link MyAccessRequestsService},
 * which the embedding page also loads (for the tab count + audit log). This component owns only
 * the view: the live countdown clock and the start/cancel affordance gating. Any page chrome
 * (container, feature-flag gate) stays with the embedding caller.
 */
@Component({
  selector: "app-pam-my-access-requests-list",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./my-access-requests-list.component.html",
  imports: [
    CommonModule,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    TableModule,
    BadgeComponent,
    ButtonModule,
    NoItemsModule,
    I18nPipe,
    IconComponent,
  ],
})
export class MyAccessRequestsListComponent implements OnInit {
  private readonly myRequests = inject(MyAccessRequestsService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  protected readonly loading = toSignal(this.myRequests.loading$, { initialValue: true });
  protected readonly cancelling = signal<Set<string>>(new Set<string>());
  /** Ids of approved requests currently being activated (prevents double-click). */
  protected readonly starting = signal<Set<string>>(new Set<string>());
  /** Ticks once a second so the redemption countdown stays live. */
  private readonly nowMs = signal(Date.now());

  private readonly rows = toSignal(this.myRequests.rows$, { initialValue: [] as MyRequestRow[] });
  protected readonly leases = toSignal(this.myRequests.leases$, {
    initialValue: [] as LeaseRow[],
  });

  /** Decrypted gated ciphers keyed by id; the template reads these to render an item's favicon. */
  private readonly cipherById = toSignal(this.myRequests.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  protected readonly pendingRows = computed(() =>
    this.rows()
      .filter((r) => r.status === AccessRequestStatus.Pending)
      .slice(0, MY_REQUESTS_PAGE_LIMIT),
  );

  /**
   * Resolved requests, newest first. A grant whose lease is still active is excluded — it belongs in
   * Active leases, not both places — and returns here once the lease ends (no longer in the active
   * set). No recency window otherwise.
   */
  protected readonly historyRows = computed(() => {
    const activeLeaseIds = new Set(this.leases().map((l) => l.id));
    return this.rows()
      .filter(
        (r) =>
          r.status !== AccessRequestStatus.Pending &&
          !(r.producedLeaseId != null && activeLeaseIds.has(r.producedLeaseId)),
      )
      .sort((a, b) => timeOf(b) - timeOf(a))
      .slice(0, MY_REQUESTS_PAGE_LIMIT);
  });

  protected readonly hasAnyRows = computed(
    () =>
      this.leases().length > 0 || this.pendingRows().length > 0 || this.historyRows().length > 0,
  );

  /**
   * Each table renders from its own data source so `bit-table` can sort the rows.
   * The filtered/sliced signals above are the input; the connected stream the
   * templates iterate is the sorted output.
   */
  protected readonly leasesDataSource = new TableDataSource<LeaseRow>();
  protected readonly pendingDataSource = new TableDataSource<MyRequestRow>();
  protected readonly historyDataSource = new TableDataSource<MyRequestRow>();

  constructor() {
    effect(() => {
      this.leasesDataSource.data = this.leases();
    });
    effect(() => {
      this.pendingDataSource.data = this.pendingRows();
    });
    effect(() => {
      this.historyDataSource.data = this.historyRows();
    });
  }

  ngOnInit(): void {
    // Keep the countdown clock outside the Angular zone: a periodic in-zone timer never lets
    // NgZone settle, which would hang `fixture.whenStable()` for any host that embeds this list.
    // The signal write still drives change detection on its own.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });
    // The service owns loading: it fetches on construction (page open / standalone use) and refreshes
    // on live signals, so this component only subscribes. Surface any load failure as a toast.
    this.myRequests.loadError$
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamMyRequestsLoadError"),
        });
      });
  }

  protected isCancelling(id: string): boolean {
    return this.cancelling().has(id);
  }

  /**
   * The decrypted cipher for a row, or undefined when it isn't in the caller's vault. The template
   * renders `app-vault-icon` only when a cipher is present; otherwise the row shows no icon.
   */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  /**
   * A request the requester can withdraw: still pending, or an approved-but-not-activated request
   * whose window can still produce access. Once its window lapses it can no longer be started, so —
   * like the Start action — Cancel is withheld and it awaits server-side expiry.
   */
  protected canCancel(row: MyRequestRow): boolean {
    if (row.status === AccessRequestStatus.Pending) {
      return true;
    }
    return (
      row.status === AccessRequestStatus.Approved &&
      (row.requestedNotAfter == null || row.requestedNotAfter.getTime() > this.nowMs())
    );
  }

  protected async cancel(row: MyRequestRow): Promise<void> {
    if (!this.canCancel(row) || this.isCancelling(row.id)) {
      return;
    }
    this.cancelling.update((s) => new Set([...s, row.id]));
    try {
      await this.myRequests.cancel(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    } finally {
      this.cancelling.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  }

  protected isStarting(id: string): boolean {
    return this.starting().has(id);
  }

  /**
   * An approved request is startable only while its window can still produce access; once the
   * window lapses the server rejects activation, so the Start button must not be offered.
   */
  protected canStart(row: MyRequestRow): boolean {
    return (
      row.status === AccessRequestStatus.Approved &&
      (row.requestedNotAfter == null || row.requestedNotAfter.getTime() > this.nowMs())
    );
  }

  /** A live "activate within X" label for an approved on-demand request. */
  protected redemptionRemainingLabel(row: MyRequestRow): string | null {
    if (row.status !== AccessRequestStatus.Approved || row.activationDeadline == null) {
      return null;
    }
    return formatRemaining(row.activationDeadline.getTime() - this.nowMs());
  }

  /** A live "ends in X" label for an active lease. */
  protected leaseRemainingLabel(lease: LeaseRow): string {
    return formatRemaining(lease.notAfter.getTime() - this.nowMs());
  }

  /** "+2h"-style label for the total time an extension added; shared by lease and history rows. */
  protected extendedByLabel(seconds: number | null): string {
    return formatDurationShort(seconds ?? 0);
  }

  /** Locale-aware relative phrasing for a resolved time ("2 days ago"); "" when unresolved. */
  private readonly relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  protected relativeResolved(row: MyRequestRow): string {
    if (row.resolvedAt == null) {
      return "";
    }
    return formatRelativeTime(row.resolvedAt.getTime(), this.nowMs(), this.relativeTimeFormat);
  }

  /** Activates an approved request (MemberStartsLease). */
  protected async activateLease(row: MyRequestRow): Promise<void> {
    if (row.status !== AccessRequestStatus.Approved || this.isStarting(row.id)) {
      return;
    }
    this.starting.update((s) => new Set([...s, row.id]));
    try {
      await this.myRequests.activate(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      // A taken single-active-lease slot or an org-wide freeze surfaces here;
      // the approved request stays activatable for a manual retry.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamStartLeaseError"),
      });
    } finally {
      this.starting.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  }
}

/** Sort key for history: resolution time, falling back to submit time. */
function timeOf(row: MyRequestRow): number {
  return (row.resolvedAt ?? row.submittedAt).getTime();
}
