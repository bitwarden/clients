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
 * "Access requests" (`/pam`): a tabbed shell over Approvals, My requests, and History.
 * Approvals is hidden entirely for a non-approver, rather than shown empty.
 *
 * Each tab is a child route in the shell's `<router-outlet>`, which stays mounted across tab
 * navigation, as does the `/pam/requests/:id` dialog. {@link MyAccessService} and
 * {@link ApproverInboxService} are provided at the parent route so every tab shares one loaded
 * instance.
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

    // Only an approver has anything to load here; driven off the stream, not `canApprove()`,
    // which is still its initial `false` here since the privilege depends on an unresolved
    // organization lookup.
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
