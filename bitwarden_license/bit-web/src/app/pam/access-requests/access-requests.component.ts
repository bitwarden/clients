import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { combineLatest, filter, map } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { TabsModule, ToastService, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";

import { MyAccessService } from "./my-access.service";

/**
 * "Access requests" (`/pam`) — the persistent tabbed shell over the caller's access surface:
 *  - Approvals — reviewing other members' requests (deferred; the SDK exposes no approver read yet).
 *  - My requests — the caller's own pending/extension requests and active leases.
 *  - History — the caller's terminal requests.
 *
 * Each tab is a child route rendered in the shell's `<router-outlet>`; the shell stays mounted
 * across tab navigation. {@link MyAccessService} is provided at the parent route (see the routing
 * module) so every tab shares one loaded instance — this shell owns the single load and the
 * load-failure toast, and renders the tab nav with live berry counts. View concerns (the countdown
 * clock, action gating) live in the individual tabs.
 */
@Component({
  selector: "pam-access-requests",
  templateUrl: "./access-requests.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, HeaderModule, TabsModule, TypographyModule, I18nPipe],
})
export class AccessRequestsComponent implements OnInit {
  private readonly myAccess = inject(MyAccessService);
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

  /** The "History" berry: the caller's terminal requests. */
  protected readonly historyCount = toSignal(
    this.myAccess.historyRows$.pipe(map((rows) => rows.length)),
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
