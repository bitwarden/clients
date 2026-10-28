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
 * The "Access requests" shell at `/pam`, over the Approvals, My requests and History tab routes.
 * Approvals is hidden for a non-approver rather than shown empty.
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

  /** The My requests berry, counting everything the caller holds or can still act on. */
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

  protected readonly canApprove = toSignal(this.approvalPrivileges$, { initialValue: false });

  protected readonly approvalsCount = toSignal(this.inbox.pendingCount$, { initialValue: 0 });

  ngOnInit(): void {
    void this.myAccess.load();

    // Driven off the stream, since `canApprove()` still holds its initial `false` until the
    // organization lookup resolves.
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
