import { CommonModule, DatePipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChildren,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  IconModule,
  NoItemsModule,
  TableModule,
  ToastService,
  ToggleGroupModule,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import {
  InboxAccessRequestResponse,
  LeaseDecision,
  LeaseDecisionRequest,
  canApprove,
  formatRemaining,
} from "@bitwarden/pam";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxRowComponent } from "./approver-inbox-row.component";
import { ApproverInboxService } from "./approver-inbox.service";

/** Time-bucket a history item belongs to. */
type BucketKey = "active" | "future" | "past";

/** Filter value for the history table: a specific bucket or "all". */
type HistoryFilter = BucketKey | "all";

/** A single row in the flat history table — all display fields pre-computed. */
type FlatHistoryRow = {
  item: InboxAccessRequestResponse;
  bucket: BucketKey;
  canRevoke: boolean;
  statusClass: string; // Tailwind colour classes for the status label
  statusLabel: string; // i18n key
  relTime: { key: string; value: string } | null;
};

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

function historyStatusLabelFor(bucket: BucketKey, status: string): string {
  if (bucket === "active") {
    return "pamInboxHistoryGroupActive";
  }
  if (bucket === "future") {
    return "pamInboxHistoryGroupFuture";
  }
  switch (status) {
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

function historyRelTimeFor(
  item: InboxAccessRequestResponse,
  bucket: BucketKey,
  now: Date,
): { key: string; value: string } | null {
  if (bucket === "future" && item.requestedNotBefore) {
    return {
      key: "pamInboxHistoryStartsIn",
      value: formatRemaining(Date.parse(item.requestedNotBefore) - now.getTime()),
    };
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
  selector: "pam-approver-inbox",
  templateUrl: "./approver-inbox.component.html",
  providers: [ApproverInboxService],
  imports: [
    CommonModule,
    DatePipe,
    JslibModule,
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
  private readonly inbox = inject(ApproverInboxService);
  private readonly badgeService = inject(ApproverInboxBadgeService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  protected readonly rows = viewChildren(ApproverInboxRowComponent);

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
          canRevoke: (bucket === "active" || bucket === "future") && item.leaseId != null,
          statusClass: historyStatusClassFor(bucket, item.status),
          statusLabel: historyStatusLabelFor(bucket, item.status),
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

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  protected async refresh(): Promise<void> {
    try {
      await this.inbox.load();
      this.renderedAt.set(new Date());
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("pamInboxLoadFailed"),
      });
    }
  }

  protected canDecide(request: InboxAccessRequestResponse): boolean {
    const userId = this.currentUserId();
    if (userId == null) {
      return false;
    }
    return canApprove({ requesterUserId: request.requesterUserId }, { id: userId });
  }

  protected async onDecide(
    request: InboxAccessRequestResponse,
    event: { decision: LeaseDecision; comment: string | undefined },
  ): Promise<void> {
    try {
      await this.inbox.decideAccessRequest(
        request.id,
        new LeaseDecisionRequest({ decision: event.decision, comment: event.comment }),
      );
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(
          event.decision === "approve" ? "pamInboxApprovedToast" : "pamInboxDeniedToast",
        ),
      });
      // Best-effort badge refresh; failure here is swallowed by the service.
      void this.badgeService.refresh();
    } catch (e) {
      this.logService.error(e);
      const row = this.rows().find((r) => r.request().id === request.id);
      row?.resetAfterFailure();
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("pamInboxDecisionFailed"),
      });
    }
  }

  /** IDs of leases currently being revoked (prevents double-click). */
  protected readonly revoking = signal<Set<string>>(new Set());

  protected async onRevoke(item: InboxAccessRequestResponse): Promise<void> {
    if (!item.leaseId) {
      return;
    }
    const leaseId = item.leaseId;
    this.revoking.update((s) => new Set([...s, leaseId]));
    try {
      await this.inbox.revokeLease(leaseId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("pamInboxRevokedToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: null,
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
  protected trackById(_index: number, request: InboxAccessRequestResponse): string {
    return request.id;
  }
}

export type HistoryGroup = {
  bucket: BucketKey;
  items: InboxAccessRequestResponse[];
};

export function groupHistory(items: InboxAccessRequestResponse[], now: Date): HistoryGroup[] {
  const nowMs = now.getTime();
  const future: InboxAccessRequestResponse[] = [];
  const active: InboxAccessRequestResponse[] = [];
  const past: InboxAccessRequestResponse[] = [];

  for (const item of items) {
    // An `activated` request has a minted lease whose window places it in the
    // active/future buckets; an `approved` ticket may also name a scheduled
    // window. Both are eligible for time-bucketing.
    if (item.status === "activated" || item.status === "approved") {
      const notBefore = item.requestedNotBefore ? Date.parse(item.requestedNotBefore) : null;
      const notAfter = item.requestedNotAfter ? Date.parse(item.requestedNotAfter) : null;
      // Check each bound independently: a lease that starts immediately has
      // notBefore=null but is still active if notAfter is in the future.
      if (notBefore != null && notBefore > nowMs) {
        future.push(item);
        continue;
      }
      if (notAfter != null && notAfter >= nowMs) {
        active.push(item);
        continue;
      }
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
