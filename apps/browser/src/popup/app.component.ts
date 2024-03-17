import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from "@angular/core";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import { ToastrService } from "ngx-toastr";
import { filter, concatMap, Subject, takeUntil, firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

import { BrowserApi } from "../platform/browser/browser-api";
import { ZonedMessageListenerService } from "../platform/browser/zoned-message-listener.service";
import { BrowserStateService } from "../platform/services/abstractions/browser-state.service";
import { ForegroundPlatformUtilsService } from "../platform/services/platform-utils/foreground-platform-utils.service";

import { routerTransition } from "./app-routing.animations";
import { DesktopSyncVerificationDialogComponent } from "./components/desktop-sync-verification-dialog.component";

@Component({
  selector: "app-root",
  styles: [],
  animations: [routerTransition],
  template: ` <div [@routerTransition]="getState(o)">
    <router-outlet #o="outlet"></router-outlet>
  </div>`,
})
export class AppComponent implements OnInit, OnDestroy {
  private lastActivity: number = null;
  private activeUserId: string;

  private destroy$ = new Subject<void>();

  constructor(
    private toastrService: ToastrService,
    private broadcasterService: BroadcasterService,
    private authService: AuthService,
    private i18nService: I18nService,
    private router: Router,
    private stateService: BrowserStateService,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private platformUtilsService: ForegroundPlatformUtilsService,
    private dialogService: DialogService,
    private browserMessagingApi: ZonedMessageListenerService,
  ) {}

  async ngOnInit() {
    // Component states must not persist between closing and reopening the popup, otherwise they become dead objects
    // Clear them aggressively to make sure this doesn't occur
    await this.clearComponentStates();

    this.stateService.activeAccount$.pipe(takeUntil(this.destroy$)).subscribe((userId) => {
      this.activeUserId = userId;
    });

    this.stateService.activeAccountUnlocked$
      .pipe(
        filter((unlocked) => unlocked),
        concatMap(async () => {
          await this.recordActivity();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.ngZone.runOutsideAngular(() => {
      window.onmousedown = () => this.recordActivity();
      window.ontouchstart = () => this.recordActivity();
      window.onclick = () => this.recordActivity();
      window.onscroll = () => this.recordActivity();
      window.onkeypress = () => this.recordActivity();
    });

    const bitwardenPopupMainMessageListener = (msg: any, sender: any) => {
      if (msg.command === "doneLoggingOut") {
        this.authService.logOut(async () => {
          if (msg.expired) {
            this.showToast({
              type: "warning",
              title: this.i18nService.t("loggedOut"),
              text: this.i18nService.t("loginExpired"),
            });
          }

          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate(["home"]);
        });
        this.changeDetectorRef.detectChanges();
      } else if (msg.command === "authBlocked") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["home"]);
      } else if (
        msg.command === "locked" &&
        (msg.userId == null || msg.userId == this.activeUserId)
      ) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["lock"]);
      } else if (msg.command === "showDialog") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.showDialog(msg);
      } else if (msg.command === "showNativeMessagingFinterprintDialog") {
        // TODO: Should be refactored to live in another service.
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.showNativeMessagingFingerprintDialog(msg);
      } else if (msg.command === "showToast") {
        this.showToast(msg);
      } else if (msg.command === "reloadProcess") {
        const forceWindowReload =
          this.platformUtilsService.isSafari() ||
          this.platformUtilsService.isFirefox() ||
          this.platformUtilsService.isOpera();
        // Wait to make sure background has reloaded first.
        window.setTimeout(
          () => BrowserApi.reloadExtension(forceWindowReload ? window : null),
          2000,
        );
      } else if (msg.command === "reloadPopup") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/"]);
      } else if (msg.command === "convertAccountToKeyConnector") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/remove-password"]);
      } else if (msg.command === "switchAccountFinish") {
        // TODO: unset loading?
        // this.loading = false;
      } else if (msg.command == "update-temp-password") {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["/update-temp-password"]);
      } else {
        msg.webExtSender = sender;
        this.broadcasterService.send(msg);
      }
    };

    (window as any).bitwardenPopupMainMessageListener = bitwardenPopupMainMessageListener;
    this.browserMessagingApi.messageListener("app.component", bitwardenPopupMainMessageListener);

    // eslint-disable-next-line rxjs/no-async-subscribe
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe(async (event) => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects || event.url || "";
        if (
          url.startsWith("/tabs/") &&
          (window as any).previousPopupUrl != null &&
          (window as any).previousPopupUrl.startsWith("/tabs/")
        ) {
          await this.clearComponentStates();
        }
        if (url.startsWith("/tabs/")) {
          await this.stateService.setAddEditCipherInfo(null);
        }
        (window as any).previousPopupUrl = url;

        // Clear route direction after animation (400ms)
        if ((window as any).routeDirection != null) {
          window.setTimeout(() => {
            (window as any).routeDirection = null;
          }, 400);
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getState(outlet: RouterOutlet) {
    if (outlet.activatedRouteData.state === "ciphers") {
      const routeDirection =
        (window as any).routeDirection != null ? (window as any).routeDirection : "";
      return (
        "ciphers_direction=" +
        routeDirection +
        "_" +
        (outlet.activatedRoute.queryParams as any).value.folderId +
        "_" +
        (outlet.activatedRoute.queryParams as any).value.collectionId
      );
    } else {
      return outlet.activatedRouteData.state;
    }
  }

  private async recordActivity() {
    if (this.activeUserId == null) {
      return;
    }

    const now = new Date().getTime();
    if (this.lastActivity != null && now - this.lastActivity < 250) {
      return;
    }

    this.lastActivity = now;
    await this.stateService.setLastActive(now, { userId: this.activeUserId });
  }

  private showToast(msg: any) {
    this.platformUtilsService.showToast(msg.type, msg.title, msg.text, msg.options);
  }

  private async showDialog(msg: SimpleDialogOptions) {
    await this.dialogService.openSimpleDialog(msg);
  }

  private async showNativeMessagingFingerprintDialog(msg: any) {
    const dialogRef = DesktopSyncVerificationDialogComponent.open(this.dialogService, {
      fingerprint: msg.fingerprint,
    });

    return firstValueFrom(dialogRef.closed);
  }

  private async clearComponentStates() {
    if (!(await this.stateService.getIsAuthenticated())) {
      return;
    }

    await Promise.all([
      this.stateService.setBrowserGroupingComponentState(null),
      this.stateService.setBrowserVaultItemsComponentState(null),
      this.stateService.setBrowserSendComponentState(null),
      this.stateService.setBrowserSendTypeComponentState(null),
    ]);
  }
}
