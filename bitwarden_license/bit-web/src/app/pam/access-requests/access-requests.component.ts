import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { combineLatest, filter, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { TabsModule, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { MyAccessService } from "./my-access.service";

/**
 * The "Access requests" shell at `/pam`, over the Approvals, My requests and History tab routes.
 * Approvals is hidden for a non-approver rather than shown empty.
 */
@Component({
  selector: "pam-access-requests",
  templateUrl: "./access-requests.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, HeaderModule, TabsModule, I18nPipe],
})
export class AccessRequestsComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
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

  ngOnInit(): void {
    void this.myAccess.load();

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
