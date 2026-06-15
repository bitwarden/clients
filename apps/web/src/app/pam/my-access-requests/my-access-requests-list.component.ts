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

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  BadgeComponent,
  BadgeVariant,
  ButtonModule,
  NoItemsModule,
  SectionComponent,
  SectionHeaderComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
  formatRemaining,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

/** Max items rendered per section in v0 (no pagination). */
export const MY_REQUESTS_PAGE_LIMIT = 50;

/** Recency window (in days) for the "Recent" section. */
export const RECENT_WINDOW_DAYS = 7;

/**
 * Cipher-name lookup is deferred — the v0 response only carries `cipherId`. Until
 * the cipher-fetch transport lands (PM-37264), rows surface the raw id so the page
 * is still useful for QA / smoke testing.
 */
export type MyRequestRow = {
  id: string;
  cipherId: string;
  cipherName: string | null;
  status: AccessRequestStatus;
  /** Precomputed badge variant for `status`, so the template avoids a per-row method call. */
  statusVariant: BadgeVariant;
  /** Precomputed i18n key for `status`, so the template avoids a per-row method call. */
  statusLabelKey: string;
  submittedAt: Date;
  resolvedAt: Date | null;
  requestedNotBefore: Date | null;
  requestedNotAfter: Date | null;
  requestedTtlSeconds: number;
  /** i18n key for a system / access-rule resolver; null when a human resolved. */
  resolverLabelKey: string | null;
  /** Raw display name when a human resolved; null otherwise (PM-37267 follow-up). */
  resolverName: string | null;
  approverComment: string | null;
  /** Deadline to activate an approved on-demand request; null for other states. */
  activationDeadline: Date | null;
};

/**
 * The caller's own AccessRequests, split into:
 *  - Pending (status = pending)
 *  - Recent  (status ≠ pending AND resolvedAt within RECENT_WINDOW_DAYS)
 *
 * Self-contained (loads its own data, manages its own countdown clock and
 * optimistic start/cancel) so it can be embedded wherever the caller's own
 * requests need to surface — currently the "My requests" section of the
 * approver inbox. Any page chrome (container, feature-flag gate) stays with the
 * embedding caller.
 *
 * Capped at MY_REQUESTS_PAGE_LIMIT per section in v0; filtering, sorting, and
 * pagination are explicit non-goals.
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
  ],
})
export class MyAccessRequestsListComponent implements OnInit {
  private readonly pamApi = inject(PamApiService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  protected readonly loading = signal(true);
  protected readonly cancelling = signal<Set<string>>(new Set<string>());
  /** Ids of approved requests currently being activated (prevents double-click). */
  protected readonly starting = signal<Set<string>>(new Set<string>());
  /** Ticks once a second so the redemption countdown stays live. */
  private readonly nowMs = signal(Date.now());

  private readonly rows = signal<MyRequestRow[]>([]);

  protected readonly pendingRows = computed(() =>
    this.rows()
      .filter((r) => r.status === AccessRequestStatus.Pending)
      .slice(0, MY_REQUESTS_PAGE_LIMIT),
  );

  protected readonly recentRows = computed(() => {
    const cutoff = Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return this.rows()
      .filter(
        (r) =>
          r.status !== AccessRequestStatus.Pending &&
          r.resolvedAt != null &&
          r.resolvedAt.getTime() >= cutoff,
      )
      .slice(0, MY_REQUESTS_PAGE_LIMIT);
  });

  protected readonly hasAnyRows = computed(
    () => this.pendingRows().length > 0 || this.recentRows().length > 0,
  );

  /**
   * Each table renders from its own data source so `bit-table` can sort the rows.
   * The filtered/sliced signals above are the input; the connected stream the
   * templates iterate is the sorted output.
   */
  protected readonly pendingDataSource = new TableDataSource<MyRequestRow>();
  protected readonly recentDataSource = new TableDataSource<MyRequestRow>();

  constructor() {
    effect(() => {
      this.pendingDataSource.data = this.pendingRows();
    });
    effect(() => {
      this.recentDataSource.data = this.recentRows();
    });
  }

  async ngOnInit(): Promise<void> {
    // Keep the countdown clock outside the Angular zone: a periodic in-zone timer never lets
    // NgZone settle, which would hang `fixture.whenStable()` for any host that embeds this list
    // (e.g. the approver inbox). The signal write still drives change detection on its own.
    this.ngZone.runOutsideAngular(() => {
      const intervalId = setInterval(() => this.nowMs.set(Date.now()), 1000);
      this.destroyRef.onDestroy(() => clearInterval(intervalId));
    });
    await this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const responses = await this.pamApi.listMyAccessRequests();
      this.rows.set(responses.map((r) => toRow(r)));
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsLoadError"),
      });
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected isCancelling(id: string): boolean {
    return this.cancelling().has(id);
  }

  /**
   * A request the requester can withdraw: still pending, or an approved-but-not-activated request whose window can
   * still produce access. An "approved" status implies no lease yet (the server reports "activated" once one exists);
   * once its window lapses it can no longer be started, so — like the Start action — Cancel is withheld and it awaits
   * server-side expiry.
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

    const next = new Set(this.cancelling());
    next.add(row.id);
    this.cancelling.set(next);

    // Optimistic update: flip status to "cancelled" and stamp resolvedAt.
    const previous = this.rows();
    const now = new Date();
    this.rows.set(
      previous.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: AccessRequestStatus.Cancelled,
              statusVariant: statusBadgeVariant(AccessRequestStatus.Cancelled),
              statusLabelKey: statusLabelKey(AccessRequestStatus.Cancelled),
              resolvedAt: now,
              ...resolveResolver({ status: AccessRequestStatus.Cancelled, approverId: null }),
            }
          : r,
      ),
    );

    try {
      await this.pamApi.cancelAccessRequest(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCancelSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.rows.set(previous);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    } finally {
      const remaining = new Set(this.cancelling());
      remaining.delete(row.id);
      this.cancelling.set(remaining);
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

  /** Activates an approved request (MemberStartsLease). */
  protected async activateLease(row: MyRequestRow): Promise<void> {
    if (row.status !== AccessRequestStatus.Approved || this.isStarting(row.id)) {
      return;
    }
    this.starting.update((s) => new Set([...s, row.id]));
    try {
      await this.pamApi.activateLease(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
      await this.reload();
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

/** Map a status to a badge variant. Exported for tests + storybook fidelity. */
export function statusBadgeVariant(status: AccessRequestStatus): BadgeVariant {
  switch (status) {
    case AccessRequestStatus.Approved:
      return "success";
    case AccessRequestStatus.Activated:
      return "success";
    case AccessRequestStatus.Denied:
      return "danger";
    case AccessRequestStatus.Cancelled:
      return "subtle";
    case AccessRequestStatus.Expired:
      return "warning";
    case AccessRequestStatus.Pending:
      return "primary";
  }
}

/** i18n key for a status label. Exported for tests. */
export function statusLabelKey(status: AccessRequestStatus): string {
  switch (status) {
    case AccessRequestStatus.Approved:
      return "pamStatusApproved";
    case AccessRequestStatus.Activated:
      return "pamStatusActivated";
    case AccessRequestStatus.Denied:
      return "pamStatusDenied";
    case AccessRequestStatus.Cancelled:
      return "pamStatusCancelled";
    case AccessRequestStatus.Expired:
      return "pamStatusExpired";
    case AccessRequestStatus.Pending:
      return "pamStatusPending";
  }
}

/**
 * Resolve who actioned a request.
 *
 * The API surfaces `approverId = null` for system / access-rule decisions and a
 * user id for human decisions. Mapping the id → display name needs another data
 * source we don't have wired up yet (PM-37267 follow-up). Until then, surface the
 * raw id as a fallback so the page is still functional.
 *
 * Returns an i18n key for system decisions (translated in the template) and a raw
 * name for human decisions, keeping localization out of the row model.
 *
 * Exported for tests.
 */
export function resolveResolver(
  response: Pick<AccessRequestDetailsResponse, "status" | "approverId">,
): Pick<MyRequestRow, "resolverLabelKey" | "resolverName"> {
  if (response.status === AccessRequestStatus.Pending) {
    return { resolverLabelKey: null, resolverName: null };
  }
  if (response.approverId == null) {
    return { resolverLabelKey: "pamResolverAccessRule", resolverName: null };
  }
  return { resolverLabelKey: null, resolverName: response.approverId };
}

export function toRow(response: AccessRequestDetailsResponse): MyRequestRow {
  return {
    id: response.id,
    cipherId: response.cipherId,
    cipherName: null,
    status: response.status,
    statusVariant: statusBadgeVariant(response.status),
    statusLabelKey: statusLabelKey(response.status),
    submittedAt: new Date(response.submittedAt),
    resolvedAt: response.resolvedAt == null ? null : new Date(response.resolvedAt),
    requestedNotBefore:
      response.requestedNotBefore == null ? null : new Date(response.requestedNotBefore),
    requestedNotAfter:
      response.requestedNotAfter == null ? null : new Date(response.requestedNotAfter),
    requestedTtlSeconds: response.requestedTtlSeconds,
    ...resolveResolver(response),
    approverComment: response.approverComment,
    activationDeadline:
      response.activationDeadline == null ? null : new Date(response.activationDeadline),
  };
}
