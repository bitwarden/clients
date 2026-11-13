import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { combineLatest, filter, map, take } from "rxjs";

import {
  ApprovalPrivilegeService,
  ApproverInboxService,
  MyAccessService,
} from "@bitwarden/bit-pam-components";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { TabsModule, ToastService } from "@bitwarden/components";
import { DesktopHeaderComponent } from "@bitwarden/desktop/app/layout/header/desktop-header.component";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * The "Access requests" shell at `/pam`, over the Approvals, My requests and History tab routes.
 * Approvals is hidden for a non-approver rather than shown empty.
 */
@Component({
  selector: "pam-shell",
  templateUrl: "./pam-shell.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, DesktopHeaderComponent, TabsModule, I18nPipe],
})
export class PamShellComponent implements OnInit {
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
