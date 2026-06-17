import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { filter } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { TabsModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { HeaderModule } from "../../layouts/header/header.module";
import { MyAccessRequestsService } from "../my-access-requests/my-access-requests.service";

import { ApproverInboxService } from "./approver-inbox.service";

/**
 * Approver inbox page ("Access requests"). A persistent shell over the routable tabs:
 *  - Approvals — pending requests for collections the caller can Manage.
 *  - My requests — the caller's own active leases, pending requests, and request history.
 *  - Audit log — the managed-collection decision history merged with the caller's own resolved
 *    requests.
 *
 * Each tab is a child route rendered in the shell's `<router-outlet>`; the shell stays mounted
 * across tab navigation. The two page-scoped services are provided at the parent route (not on this
 * component) so every routed tab shares one instance. Those services own their own loading and live
 * refresh — fetched once on construction and kept fresh on push/mutation signals — so the shell only
 * renders the tab nav (with live badge counts) and surfaces a load failure; it issues no loads.
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
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly syncService = inject(SyncService);
  private readonly destroyRef = inject(DestroyRef);

  /** Pending-approval count for the Approvals tab berry. */
  protected readonly pendingApprovalsCount = toSignal(this.inbox.badgeCount$, { initialValue: 0 });
  /** The caller's own pending-request count for the My requests tab berry. */
  protected readonly myPendingCount = toSignal(this.myRequests.pendingCount$, { initialValue: 0 });

  ngOnInit(): void {
    // Collection (and cipher) names are read from local vault state, which isn't loaded on a fresh
    // navigation to this page — only the vault triggers a sync. Kick one here (a no-op when a recent
    // sync exists) so collection state populates; the services' reactive name resolution then fills
    // in the collection names without the user having to visit the vault first. Fire-and-forget so
    // the inbox renders immediately and names back-fill when the sync lands.
    void this.syncService.fullSync(false).catch((e: unknown) => this.logService.error(e));

    // Surface an inbox load failure (the service owns its own fetch + live refresh now). The
    // "My requests" tab surfaces its own load failures.
    this.inbox.loadError$
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamInboxLoadFailed"),
        });
      });
  }
}
