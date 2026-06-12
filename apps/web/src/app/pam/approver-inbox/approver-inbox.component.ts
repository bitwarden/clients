import { AsyncPipe, DatePipe, NgFor } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChildren,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { debounceTime, filter, map, merge } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import {
  ButtonModule,
  IconModule,
  NoItemsModule,
  TableDataSource,
  TableModule,
  ToastService,
  ToggleGroupModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import {
  AccessRequestDetailsResponse,
  AccessDecisionVerdict,
  AccessDecisionRequest,
  PamApiService,
  canApprove,
  formatRemaining,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxRowComponent } from "./approver-inbox-row.component";
import { ApproverInboxService } from "./approver-inbox.service";

/** Time-bucket a history item belongs to. */
type BucketKey = "active" | "future" | "past";

/** Filter value for the history table: a specific bucket or "all". */
type HistoryFilter = BucketKey | "all";

/** A single row in the flat history table — all display fields pre-computed. */
type FlatHistoryRow = {
  item: AccessRequestDetailsResponse;
  bucket: BucketKey;
  canRevoke: boolean;
  statusClass: string; // Tailwind colour classes for the status label
  statusLabel: string; // i18n key
  relTime: { key: string; value: string } | null;
};

/** An approved request that has not produced a lease yet: the requester may still start it. */
function isAwaitingStart(item: AccessRequestDetailsResponse): boolean {
  return item.status === "approved" && item.producedLeaseId == null;
}

function historyStatusClassFor(bucket: BucketKey, status: string): string {
  if (bucket === "active") {
    return "tw-text-success-700";
  }
  if (bucket === "future") {
    return "tw-text-primary-600";
  }
  if (status === "denied") {
    return "tw-text-danger-700";
  }
  return "tw-text-muted";
}

export function historyStatusLabelFor(
  bucket: BucketKey,
  item: AccessRequestDetailsResponse,
): string {
  if (bucket === "active") {
    return "pamInboxHistoryGroupActive";
  }
  if (bucket === "future") {
    // An approved-but-not-started request grants nothing yet — say so instead of "Upcoming",
    // which is reserved for a minted lease whose window hasn't opened.
    return isAwaitingStart(item)
      ? "pamInboxHistoryStatusAwaitingStart"
      : "pamInboxHistoryGroupFuture";
  }
  // A produced lease that has ended is labelled by the lease outcome, not the request status (which
  // stays "activated"): distinguish a manually revoked lease from one that lapsed.
  if (item.producedLeaseStatus === "revoked") {
    return "pamInboxHistoryStatusRevoked";
  }
  if (item.producedLeaseStatus === "expired") {
    return "pamInboxHistoryStatusExpired";
  }
  switch (item.status) {
    case "approved":
      return "pamInboxHistoryStatusApproved";
    case "activated":
      return "pamInboxHistoryStatusActivated";
    case "denied":
      return "pamInboxHistoryStatusDenied";
    case "expired":
      return "pamInboxHistoryStatusExpired";
    default:
      return "pamInboxHistoryStatusCancelled";
  }
}

export function historyRelTimeFor(
  item: AccessRequestDetailsResponse,
  bucket: BucketKey,
  now: Date,
): { key: string; value: string } | null {
  if (bucket === "future") {
    const notBeforeMs = item.requestedNotBefore ? Date.parse(item.requestedNotBefore) : null;
    if (notBeforeMs != null && notBeforeMs > now.getTime()) {
      return {
        key: "pamInboxHistoryStartsIn",
        value: formatRemaining(notBeforeMs - now.getTime()),
      };
    }
    // Awaiting start inside an already-open window: show how long the approval stays startable.
    if (isAwaitingStart(item) && item.requestedNotAfter) {
      const startable = formatRemaining(Date.parse(item.requestedNotAfter) - now.getTime());
      if (startable === "0s") {
        return null;
      }
      return { key: "pamInboxHistoryStartableFor", value: startable };
    }
    return null;
  }
  if (bucket === "active" && item.requestedNotAfter) {
    const remaining = formatRemaining(Date.parse(item.requestedNotAfter) - now.getTime());
    if (remaining === "0s") {
      return null;
    }
    return { key: "pamInboxHistoryTimeRemaining", value: remaining };
  }
  return null;
}

/**
 * Approver inbox page. Lists pending lease requests for collections the
 * caller can Manage and lets them approve or deny with an optional comment.
 *
 * The frontend never decides who an approver is — the server-side inbox
 * endpoint filters by Manage permission. The page only enforces the
 * self-approval guard, which is an additional UX safeguard.
 */

@Component({
  selector: "app-pam-approver-inbox",
  templateUrl: "./approver-inbox.component.html",
  providers: [ApproverInboxService],
  imports: [
    AsyncPipe,
    DatePipe,
    NgFor,
    I18nPipe,
    HeaderModule,
    ApproverInboxRowComponent,
    ButtonModule,
    IconModule,
    NoItemsModule,
    TableModule,
    ToggleGroupModule,
    TooltipDirective,
    TypographyModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproverInboxComponent implements OnInit {
  /**
   * Server filters by Manage. The two empty states differ in copy:
   * - true (default): "No requests waiting."
   * - false: "You're not designated to approve requests for any collections."
   *
   * Exposed as an input so storybook / parents can drive the alternate
   * empty-state copy. Production callers will leave this at the default and
   * an upcoming ticket will resolve it from collection metadata.
   */
  readonly hasManagerCollections = input<boolean>(true);

  protected readonly rows = viewChildren(ApproverInboxRowComponent);

  private readonly inbox = inject(ApproverInboxService);
  private readonly badgeService = inject(ApproverInboxBadgeService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly pamApiService = inject(PamApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentUserId = toSignal(
    this.accountService.activeAccount$.pipe(map((a) => a?.id ?? null)),
    { initialValue: null },
  );

  protected readonly requests = toSignal(this.inbox.requests$, { initialValue: [] });
  protected readonly history = toSignal(this.inbox.history$, { initialValue: [] });
  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: false });

  /**
   * Snapshot the current "now" for elapsed-time rendering. Updated on every
   * successful load so all rows agree on a consistent reference clock.
   */
  protected readonly renderedAt = signal<Date>(new Date());

  /**
   * Flat, ordered list of history items (active → upcoming → past) with all
   * display fields pre-computed. Re-evaluated whenever history or renderedAt
   * changes, so relative-time labels stay accurate after each refresh.
   */
  protected readonly flatHistory = computed((): FlatHistoryRow[] => {
    const now = this.renderedAt();
    return groupHistory(this.history(), now).flatMap(({ bucket, items }) =>
      items.map(
        (item): FlatHistoryRow => ({
          item,
          bucket,
          canRevoke:
            (bucket === "active" || bucket === "future") &&
            item.producedLeaseId != null &&
            item.producedLeaseStatus === "active",
          statusClass: historyStatusClassFor(bucket, item.status),
          statusLabel: historyStatusLabelFor(bucket, item),
          relTime: historyRelTimeFor(item, bucket, now),
        }),
      ),
    );
  });

  /** Currently active filter pill. "all" shows every history row. */
  protected readonly historyFilter = signal<HistoryFilter>("all");

  /** History rows visible under the current filter. */
  protected readonly filteredHistory = computed((): FlatHistoryRow[] => {
    const filter = this.historyFilter();
    if (filter === "all") {
      return this.flatHistory();
    }
    return this.flatHistory().filter((row) => row.bucket === filter);
  });

  /**
   * Renders the filtered history through a data source, consistent with the other PAM tables.
   * Bucket ordering and filtering already live in the computeds above, so the data source only
   * holds the rows to render.
   */
  protected readonly historyDataSource = new TableDataSource<FlatHistoryRow>();

  /** IDs of leases currently being revoked (prevents double-click). */
  protected readonly revoking = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
      this.historyDataSource.data = this.filteredHistory();
    });
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();

    // Keep an open inbox fresh when a lease changes elsewhere, so a lease that ends drops out of the
    // Active group and its (now-stale) Revoke button disappears without a manual refresh:
    // - a RefreshApproverInbox push fires when another approver or the requester ends a lease, and
    // - mutations$ fires for changes made in this same client (e.g. the requester ending their lease
    //   from the cipher banner, which would otherwise leave a 409-ing Revoke button here).
    // Debounced to coalesce bursts (several leases ending at once).
    merge(
      this.notificationsService.notifications$.pipe(
        filter(([notification]) => notification.type === NotificationType.RefreshApproverInbox),
      ),
      this.pamApiService.mutations$,
    )
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.refresh());
  }

  protected async refresh(): Promise<void> {
    try {
      await this.inbox.load();
      this.renderedAt.set(new Date());
      // Keep the nav badge consistent with what the page just rendered, even
      // if a server push was missed while the user was elsewhere. Best-effort;
      // failure is swallowed by the service.
      void this.badgeService.refresh();
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxLoadFailed"),
      });
    }
  }

  protected canDecide(request: AccessRequestDetailsResponse): boolean {
    const userId = this.currentUserId();
    if (userId == null) {
      return false;
    }
    return canApprove({ requesterId: request.requesterId }, { id: userId });
  }

  protected async onDecide(
    request: AccessRequestDetailsResponse,
    event: { verdict: AccessDecisionVerdict; comment: string | undefined },
  ): Promise<void> {
    try {
      await this.inbox.decideAccessRequest(
        request.id,
        new AccessDecisionRequest({ verdict: event.verdict, comment: event.comment }),
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          event.verdict === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
        ),
      });
    } catch (e) {
      this.logService.error(e);
      const row = this.rows().find((r) => r.request().id === request.id);
      row?.resetAfterFailure();
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
    }
  }

  protected async onRevoke(item: AccessRequestDetailsResponse): Promise<void> {
    if (!item.producedLeaseId) {
      return;
    }
    const leaseId = item.producedLeaseId;
    this.revoking.update((s) => new Set([...s, leaseId]));
    try {
      await this.inbox.revokeAccessLease(leaseId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamInboxRevokedToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxRevokeFailed"),
      });
    } finally {
      this.revoking.update((s) => {
        const next = new Set(s);
        next.delete(leaseId);
        return next;
      });
    }
  }

  /** Used by @for track on the inbox list. */
  protected trackById(_index: number, request: AccessRequestDetailsResponse): string {
    return request.id;
  }
}

export type HistoryGroup = {
  bucket: BucketKey;
  items: AccessRequestDetailsResponse[];
};

export function groupHistory(items: AccessRequestDetailsResponse[], now: Date): HistoryGroup[] {
  const nowMs = now.getTime();
  const future: AccessRequestDetailsResponse[] = [];
  const active: AccessRequestDetailsResponse[] = [];
  const past: AccessRequestDetailsResponse[] = [];

  for (const item of items) {
    const notBefore = item.requestedNotBefore ? Date.parse(item.requestedNotBefore) : null;
    const notAfter = item.requestedNotAfter ? Date.parse(item.requestedNotAfter) : null;

    // A minted lease is real access only while its status is still "active": a revoked or expired
    // lease drops to Past regardless of its window, so the inbox never offers Revoke on a lease that
    // has already ended (the request itself stays "activated" forever). Check each bound
    // independently: a lease that starts immediately has notBefore=null but is still active if
    // notAfter is in the future.
    if (
      (item.status === "activated" || item.producedLeaseId != null) &&
      item.producedLeaseStatus === "active"
    ) {
      if (notBefore != null && notBefore > nowMs) {
        future.push(item);
        continue;
      }
      if (notAfter != null && notAfter >= nowMs) {
        active.push(item);
        continue;
      }
    } else if (item.status === "approved" && (notAfter == null || notAfter >= nowMs)) {
      // Approved but not started: the requester can still mint the lease, so the grant belongs
      // with Upcoming — never Active. Once the window lapses unstarted it falls through to Past.
      future.push(item);
      continue;
    }
    past.push(item);
  }

  return (
    [
      { bucket: "active", items: active },
      { bucket: "future", items: future },
      { bucket: "past", items: past },
    ] satisfies HistoryGroup[]
  ).filter((g) => g.items.length > 0);
}
