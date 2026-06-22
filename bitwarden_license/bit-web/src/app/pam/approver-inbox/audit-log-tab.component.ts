import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { AccessRequestDetailsResponse, AccessRequestStatus } from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApproverInboxService } from "./approver-inbox.service";
import { AuditLogComponent } from "./audit-log.component";
import { resolvedOrSubmittedMs } from "./history-row";

/**
 * Route container for the Audit log tab. Merges the managed-collection decision history
 * ({@link ApproverInboxService}) with the viewer's own resolved requests
 * ({@link MyAccessRequestsService}) into the one record the presentational {@link AuditLogComponent}
 * renders, and owns the Revoke / Cancel-approval network calls + toasts. Both services are provided
 * at the parent route so every tab shares one loaded instance; loading + live refresh stay with the
 * persistent shell route.
 */
@Component({
  selector: "app-pam-audit-log-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuditLogComponent],
  template: `<app-pam-audit-log
    [items]="auditItems()"
    [managedIds]="managedIds()"
    [now]="now()"
    [revoking]="revoking()"
    [cancelling]="cancelling()"
    (revoke)="onRevoke($event)"
    (cancelApproval)="onCancelApproval($event)"
  ></app-pam-audit-log>`,
})
export class AuditLogTabComponent {
  private readonly inbox = inject(ApproverInboxService);
  private readonly myRequests = inject(MyAccessRequestsService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  private readonly history = toSignal(this.inbox.history$, { initialValue: [] });
  private readonly myResponses = toSignal(this.myRequests.responses$, {
    initialValue: [] as AccessRequestDetailsResponse[],
  });
  protected readonly now = toSignal(this.inbox.renderedAt$, { initialValue: new Date() });

  /** Lease ids currently being revoked (prevents double-click). */
  protected readonly revoking = signal<Set<string>>(new Set());
  /** Approved-request ids currently being cancelled (prevents double-click). */
  protected readonly cancelling = signal<Set<string>>(new Set());

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
