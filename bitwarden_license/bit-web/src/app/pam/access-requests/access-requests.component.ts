import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { combineLatest, filter, map, take } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { TabsModule, ToastService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";

import { MyAccessService } from "./my-access.service";

/**
 * "Access requests" (`/pam`) — the persistent tabbed shell over the caller's access surface:
 *  - Approvals — other members' requests awaiting the caller's decision. Hidden entirely for a
 *    member with no approval privileges, rather than shown empty: a tab that can never have anything
 *    in it is noise, and `canViewApprovalsGuard` redirects the deep link to match.
 *  - My requests — the caller's own pending/extension requests and active leases.
 *  - History — the caller's terminal requests, plus (for approvers) the ones they decided. No
 *    berry: {@link MyAccessService.historyRows$} only grows (terminal requests never leave
 *    history), so a live count there would read as permanent unattended work rather than
 *    something to act on — unlike the My requests and Approvals berries below.
 *
 * Each tab is a child route rendered in the shell's `<router-outlet>`; the shell stays mounted
 * across tab navigation. So is `/pam/requests/:id`, which is not a tab — it renders the single
 * request as a dialog over this shell. {@link MyAccessService} is provided at the parent route (see the routing
 * module) so every tab shares one loaded instance — this shell owns the single load and the
 * load-failure toast, and renders the tab nav with live berry counts. {@link ApproverInboxService} is
 * provided the same way and loaded the same way, but only for a caller who can actually approve:
 * hitting the approver endpoints for everyone would mean two guaranteed-empty requests per page open.
 * View concerns (the countdown clock, action gating) live in the individual tabs.
 */
@Component({
  selector: "pam-access-requests",
  templateUrl: "./access-requests.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, HeaderModule, TabsModule, TypographyModule, I18nPipe],
})
export class AccessRequestsComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The "My requests" berry: everything the caller still holds or can act on — pending requests,
   * open extension requests, and active leases. Zero renders no berry (see `bit-tab-link`).
   */
  protected readonly myRequestsCount = toSignal(
    combineLatest([
      this.myAccess.pendingRows$,
      this.myAccess.extensionRows$,
      this.myAccess.leases$,
    ]).pipe(
      map(([pending, extensions, leases]) => pending.length + extensions.length + leases.length),
    ),
    { initialValue: 0 },
  );

  private readonly approvalPrivileges$ = inject(ApprovalPrivilegeService).canApprove$;

  /** Whether to render the Approvals tab at all. */
  protected readonly canApprove = toSignal(this.approvalPrivileges$, { initialValue: false });

  /** The "Approvals" berry: requests awaiting the caller's decision. */
  protected readonly approvalsCount = toSignal(this.inbox.pendingCount$, { initialValue: 0 });

  ngOnInit(): void {
    void this.myAccess.load();

    // Only an approver has anything to load here, and the inbox/history endpoints would otherwise be
    // called on every page open for members who can never see a row. Driven off the stream rather
    // than `canApprove()`, which is still on its initial `false` at this point: the privilege depends
    // on an organization lookup that has not resolved yet.
    this.approvalPrivileges$
      .pipe(filter(Boolean), take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => void this.inbox.load());

    this.inbox.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamInboxLoadFailed"),
        });
      });

    this.myAccess.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamMyRequestsLoadError"),
        });
      });
  }
}
