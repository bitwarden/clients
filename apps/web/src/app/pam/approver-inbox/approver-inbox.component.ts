import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { debounceTime, filter, merge } from "rxjs";

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SyncService } from "@bitwarden/common/platform/sync";
import { TabsModule, ToastService } from "@bitwarden/components";
import { PamApiService } from "@bitwarden/pam";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApproverInboxBadgeService } from "./approver-inbox-badge.service";
import { ApproverInboxService } from "./approver-inbox.service";

/**
 * Approver inbox page ("Access requests"). A persistent shell over the routable tabs:
 *  - Approvals — pending requests for collections the caller can Manage.
 *  - My requests — the caller's own active leases, pending requests, and request history.
 *  - Audit log — the managed-collection decision history merged with the caller's own resolved
 *    requests.
 *
 * Each tab is a child route rendered in the shell's `<router-outlet>`; the shell stays mounted
 * across tab navigation, so loading and live refresh run once for the whole page here. The two
 * page-scoped services are provided at the parent route (not on this component) so every routed tab
 * shares the one loaded instance. The shell only renders the tab nav (with live badge counts) and
 * orchestrates load + live refresh; per-tab views and actions live in the tab components.
 */
@Component({
  selector: "app-pam-approver-inbox",
  templateUrl: "./approver-inbox.component.html",
  imports: [I18nPipe, HeaderModule, TabsModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApproverInboxComponent implements OnInit {
  private readonly inbox = inject(ApproverInboxService);
  private readonly myRequests = inject(MyAccessRequestsService);
  private readonly badgeService = inject(ApproverInboxBadgeService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly pamApiService = inject(PamApiService);
  private readonly syncService = inject(SyncService);
  private readonly destroyRef = inject(DestroyRef);

  /** Pending-approval count for the Approvals tab berry. */
  protected readonly pendingApprovalsCount = toSignal(this.inbox.badgeCount$, { initialValue: 0 });
  /** The caller's own pending-request count for the My requests tab berry. */
  protected readonly myPendingCount = toSignal(this.myRequests.pendingCount$, { initialValue: 0 });

  async ngOnInit(): Promise<void> {
    // Collection (and cipher) names are read from local vault state, which isn't loaded on a fresh
    // navigation to this page — only the vault triggers a sync. Kick one here (a no-op when a recent
    // sync exists) so collection state populates; the services' reactive name resolution then fills
    // in the collection names without the user having to visit the vault first. Fire-and-forget so
    // the inbox renders immediately and names back-fill when the sync lands.
    void this.syncService.fullSync(false).catch((e: unknown) => this.logService.error(e));

    await this.refresh();

    // Keep both tabs fresh when state changes elsewhere, so a lease that ends drops out of the Active
    // group (its now-stale Revoke button disappears) and the "My requests" tab reflects a decision
    // without a manual refresh:
    // - RefreshApproverInbox fires to this user as an approver (a request they manage changed), and
    // - RefreshAccessRequest fires to this user as a requester (one of their own requests/leases changed
    //   — decided, activated, revoked, extended, or cancelled), and
    // - mutations$ fires for changes made in this same client (e.g. ending a lease from the cipher
    //   banner, or cancelling/activating from the My requests tab).
    // Debounced to coalesce bursts (several leases ending at once).
    merge(
      this.notificationsService.notifications$.pipe(
        filter(
          ([notification]) =>
            notification.type === NotificationType.RefreshApproverInbox ||
            notification.type === NotificationType.RefreshAccessRequest,
        ),
      ),
      this.pamApiService.mutations$,
    )
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.refresh());
  }

  protected async refresh(): Promise<void> {
    try {
      await Promise.all([this.inbox.load(), this.myRequests.load()]);
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
}
