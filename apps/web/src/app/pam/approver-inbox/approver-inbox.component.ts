import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { debounceTime, filter, map, merge } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SyncService } from "@bitwarden/common/platform/sync";
import { TabsModule, ToastService } from "@bitwarden/components";
import {
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";
import { MyAccessRequestsListComponent } from "../my-access-requests/my-access-requests-list.component";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApprovalsComponent, DecideEvent } from "./approvals.component";
import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxService } from "./approver-inbox.service";
import { AuditLogComponent } from "./audit-log.component";
import { resolvedOrSubmittedMs } from "./history-row";

/**
 * Approver inbox page ("Access requests"). A tabbed surface over the leasing data the caller
 * can see:
 *  - Approvals — pending requests for collections the caller can Manage (a sortable table).
 *  - My requests — the caller's own active leases, pending requests, and request history.
 *  - Audit log — the managed-collection decision history merged with the caller's own resolved
 *    requests, as one bucketable record.
 *
 * The frontend never decides who an approver is — the server-side inbox endpoint filters by
 * Manage permission. The page only enforces the self-approval guard as an additional UX safeguard.
 * Data, optimistic updates, and name resolution live in the two page-scoped services; this
 * component orchestrates loading + live refresh and routes child actions to those services.
 */
@Component({
  selector: "app-pam-approver-inbox",
  templateUrl: "./approver-inbox.component.html",
  providers: [ApproverInboxService, MyAccessRequestsService],
  imports: [
    I18nPipe,
    HeaderModule,
    TabsModule,
    ApprovalsComponent,
    MyAccessRequestsListComponent,
    AuditLogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproverInboxComponent implements OnInit {
  /**
   * Server filters by Manage. The two Approvals empty states differ in copy:
   * - true (default): "No requests waiting."
   * - false: "You're not designated to approve requests for any collections."
   *
   * Exposed as an input so storybook / parents can drive the alternate empty-state copy.
   */
  readonly hasManagerCollections = input<boolean>(true);

  private readonly inbox = inject(ApproverInboxService);
  private readonly myRequests = inject(MyAccessRequestsService);
  private readonly badgeService = inject(ApproverInboxBadgeService);
  private readonly accountService = inject(AccountService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly pamApiService = inject(PamApiService);
  private readonly syncService = inject(SyncService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentUserId = toSignal(
    this.accountService.activeAccount$.pipe(map((a) => a?.id ?? null)),
    { initialValue: null },
  );

  protected readonly requests = toSignal(this.inbox.requests$, { initialValue: [] });
  private readonly history = toSignal(this.inbox.history$, { initialValue: [] });
  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: false });
  protected readonly myPendingCount = toSignal(this.myRequests.pendingCount$, { initialValue: 0 });
  private readonly myResponses = toSignal(this.myRequests.responses$, {
    initialValue: [] as AccessRequestDetailsResponse[],
  });

  /**
   * Snapshot of "now" for elapsed/relative-time rendering. Updated on every successful load so
   * all rows agree on a consistent reference clock.
   */
  protected readonly renderedAt = signal<Date>(new Date());

  /** Ids of the decision-history rows — the items in the audit log the viewer can act on. */
  protected readonly managedIds = computed(() => new Set(this.history().map((h) => h.id)));

  /**
   * Everything the viewer can see in one record: the managed-collection decision history merged
   * with the viewer's own resolved requests, de-duplicated by id (the managed copy wins so its
   * Revoke / Cancel-approval actions stay wired) and ordered newest-first.
   */
  protected readonly auditItems = computed((): AccessRequestDetailsResponse[] => {
    const byId = new Map<string, AccessRequestDetailsResponse>();
    for (const item of this.history()) {
      byId.set(item.id, item);
    }
    for (const item of this.myResponses()) {
      if (item.status !== AccessRequestStatus.Pending && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
    return [...byId.values()].sort((a, b) => resolvedOrSubmittedMs(b) - resolvedOrSubmittedMs(a));
  });

  /** Lease ids currently being revoked (prevents double-click). */
  protected readonly revoking = signal<Set<string>>(new Set());
  /** Approved-request ids currently being cancelled (prevents double-click). */
  protected readonly cancelling = signal<Set<string>>(new Set());

  async ngOnInit(): Promise<void> {
    // Collection (and cipher) names are read from local vault state, which isn't loaded on a fresh
    // navigation to this page — only the vault triggers a sync. Kick one here (a no-op when a recent
    // sync exists) so collection state populates; the services' reactive name resolution then fills
    // in the collection names without the user having to visit the vault first. Fire-and-forget so
    // the inbox renders immediately and names back-fill when the sync lands.
    void this.syncService.fullSync(false).catch((e: unknown) => this.logService.error(e));

    await this.refresh();

    // Keep an open inbox fresh when a lease changes elsewhere, so a lease that ends drops out of the
    // Active group and its (now-stale) Revoke button disappears without a manual refresh:
    // - a RefreshApproverInbox push fires when another approver or the requester ends a lease, and
    // - mutations$ fires for changes made in this same client (e.g. the requester ending their lease
    //   from the cipher banner, or cancelling/activating from the My requests tab).
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
      await Promise.all([this.inbox.load(), this.myRequests.load()]);
      this.renderedAt.set(new Date());
      // Keep the nav badge consistent with what the page just rendered, even if a server push was
      // missed while the user was elsewhere. Best-effort; failure is swallowed by the service.
      void this.badgeService.refresh();
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxLoadFailed"),
      });
    }
  }

  protected async onDecide(event: DecideEvent): Promise<void> {
    try {
      await this.inbox.decideAccessRequest(
        event.request.id,
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
      // The inbox service restored the row optimistically; surface the failure so the user retries.
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

  /**
   * Cancel an approved-but-not-activated request, retracting the approval so the requester can no
   * longer activate it. The server records it as a Deny by the approver; the row drops out of the
   * actionable groups.
   */
  protected async onCancelApproval(item: AccessRequestDetailsResponse): Promise<void> {
    const requestId = item.id;
    if (this.cancelling().has(requestId)) {
      return;
    }
    this.cancelling.update((s) => new Set([...s, requestId]));
    try {
      await this.inbox.cancelApprovedRequest(requestId);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamInboxCancelApprovalToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamInboxCancelApprovalFailed"),
      });
    } finally {
      this.cancelling.update((s) => {
        const next = new Set(s);
        next.delete(requestId);
        return next;
      });
    }
  }
}
