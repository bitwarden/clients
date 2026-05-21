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
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import {
  InboxLeaseRequestResponse,
  LeaseDecision,
  LeaseDecisionRequest,
  canApprove,
} from "@bitwarden/pam";

import { formatRemaining } from "../utils/format-remaining";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxRowComponent } from "./approver-inbox-row.component";
import { ApproverInboxService } from "./approver-inbox.service";

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

  /** History grouped into labeled time buckets for display. */
  protected readonly historyGroups = computed(() =>
    groupHistory(this.history(), this.renderedAt()),
  );

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  protected async refresh(): Promise<void> {
    try {
      await this.inbox.load();
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("pamInboxLoadFailed"),
      });
    }
  }

  protected canDecide(request: InboxLeaseRequestResponse): boolean {
    const userId = this.currentUserId();
    if (userId == null) {
      return false;
    }
    return canApprove({ requesterUserId: request.requesterUserId }, { id: userId });
  }

  protected async onDecide(
    request: InboxLeaseRequestResponse,
    event: { decision: LeaseDecision; comment: string | undefined },
  ): Promise<void> {
    try {
      await this.inbox.submitDecision(
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

  protected async onRevoke(item: InboxLeaseRequestResponse): Promise<void> {
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

  /** Used by *trackBy on the inbox list. */
  protected trackById(_index: number, request: InboxLeaseRequestResponse): string {
    return request.id;
  }

  protected trackByLabel(_index: number, group: HistoryGroup): string {
    return group.labelKey;
  }

  /**
   * Returns a short relative-time string for a history row's access window,
   * relative to the current rendered-at snapshot.
   *   future  → "starts in 3h 20m"
   *   active  → "2h 5m remaining"
   *   past    → null (nothing to show — the date stamp is enough)
   */
  protected historyRelativeTime(item: InboxLeaseRequestResponse, labelKey: string): string | null {
    const now = this.renderedAt();
    if (labelKey === "pamInboxHistoryGroupFuture" && item.requestedNotBefore) {
      return `starts in ${formatRemaining(item.requestedNotBefore, now)}`;
    }
    if (labelKey === "pamInboxHistoryGroupActive" && item.requestedNotAfter) {
      const remaining = formatRemaining(item.requestedNotAfter, now);
      return remaining === "0s" ? null : `${remaining} remaining`;
    }
    return null;
  }

  /**
   * Snapshot the current "now" for elapsed-time rendering. Computed once
   * per load so all rows agree on the reference clock.
   */
  protected readonly renderedAt = signal<Date>(new Date());
}

export type HistoryGroup = {
  labelKey: string;
  items: InboxLeaseRequestResponse[];
};

export function groupHistory(items: InboxLeaseRequestResponse[], now: Date): HistoryGroup[] {
  const nowMs = now.getTime();
  const future: InboxLeaseRequestResponse[] = [];
  const active: InboxLeaseRequestResponse[] = [];
  const past: InboxLeaseRequestResponse[] = [];

  for (const item of items) {
    if (item.status === "approved") {
      const notBefore = item.requestedNotBefore ? Date.parse(item.requestedNotBefore) : null;
      const notAfter = item.requestedNotAfter ? Date.parse(item.requestedNotAfter) : null;
      if (notBefore != null && notAfter != null) {
        if (notBefore > nowMs) {
          future.push(item);
          continue;
        }
        if (notAfter >= nowMs) {
          active.push(item);
          continue;
        }
      }
    }
    past.push(item);
  }

  return [
    { labelKey: "pamInboxHistoryGroupFuture", items: future },
    { labelKey: "pamInboxHistoryGroupActive", items: active },
    { labelKey: "pamInboxHistoryGroupPast", items: past },
  ].filter((g) => g.items.length > 0);
}
