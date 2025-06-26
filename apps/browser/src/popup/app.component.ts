// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  NgZone,
  OnDestroy,
  OnInit,
  inject,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { NavigationEnd, Router, RouterOutlet } from "@angular/router";
import {
  Subject,
  takeUntil,
  firstValueFrom,
  concatMap,
  filter,
  tap,
  catchError,
  of,
  map,
} from "rxjs";

import { DeviceTrustToastService } from "@bitwarden/angular/auth/services/device-trust-toast.service.abstraction";
import { DocumentLangSetter } from "@bitwarden/angular/platform/i18n";
import { LogoutReason, UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AnimationControlService } from "@bitwarden/common/platform/abstractions/animation-control.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { MessageListener } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogService,
  SimpleDialogOptions,
  ToastOptions,
  ToastService,
} from "@bitwarden/components";
import { BiometricsService, BiometricStateService, KeyService } from "@bitwarden/key-management";

import { PopupCompactModeService } from "../platform/popup/layout/popup-compact-mode.service";
import { PopupSizeService } from "../platform/popup/layout/popup-size.service";
import { initPopupClosedListener } from "../platform/services/popup-view-cache-background.service";
import { VaultBrowserStateService } from "../vault/services/vault-browser-state.service";

import { routerTransition } from "./app-routing.animations";
import { DesktopSyncVerificationDialogComponent } from "./components/desktop-sync-verification-dialog.component";

@Component({
  selector: "app-root",
  styles: [],
  animations: [routerTransition],
  template: `
    @if (showSdkWarning | async) {
      <div class="tw-h-screen tw-flex tw-justify-center tw-items-center tw-p-4">
        <bit-callout type="danger">
          {{ "wasmNotSupported" | i18n }}
          <a
            bitLink
            href="https://bitwarden.com/help/wasm-not-supported/"
            target="_blank"
            rel="noreferrer"
          >
            {{ "learnMore" | i18n }}
          </a>
        </bit-callout>
      </div>
    } @else {
      <div [@routerTransition]="getRouteElevation(outlet)">
        <router-outlet #outlet="outlet"></router-outlet>
      </div>
      <bit-toast-container></bit-toast-container>
    }
  `,
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private compactModeService = inject(PopupCompactModeService);
  private sdkService = inject(SdkService);

  private lastActivity: Date;
  private activeUserId: UserId;
  private routerAnimations = false;

  private destroy$ = new Subject<void>();

  // Show a warning if the SDK is not available.
  protected showSdkWarning = this.sdkService.client$.pipe(
    map(() => false),
    catchError(() => of(true)),
  );

  constructor(
    private authService: AuthService,
    private i18nService: I18nService,
    private router: Router,
    private stateService: StateService,
    private vaultBrowserStateService: VaultBrowserStateService,
    private cipherService: CipherService,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
    private messageListener: MessageListener,
    private toastService: ToastService,
    private accountService: AccountService,
    private animationControlService: AnimationControlService,
    private biometricStateService: BiometricStateService,
    private biometricsService: BiometricsService,
    private deviceTrustToastService: DeviceTrustToastService,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private keyService: KeyService,
    private readonly destoryRef: DestroyRef,
    private readonly documentLangSetter: DocumentLangSetter,
    private popupSizeService: PopupSizeService,
    private logService: LogService,
  ) {
    this.deviceTrustToastService.setupListeners$.pipe(takeUntilDestroyed()).subscribe();

    const langSubscription = this.documentLangSetter.start();
    this.destoryRef.onDestroy(() => langSubscription.unsubscribe());
  }

  async ngOnInit() {
    initPopupClosedListener();

    this.compactModeService.init();
    await this.popupSizeService.setHeight();

    // Component states must not persist between closing and reopening the popup, otherwise they become dead objects
    // Clear them aggressively to make sure this doesn't occur
    await this.clearComponentStates();

    this.accountService.activeAccount$.pipe(takeUntil(this.destroy$)).subscribe((account) => {
      this.activeUserId = account?.id;
    });

    this.authService.activeAccountStatus$
      .pipe(
        filter((status) => status === AuthenticationStatus.Unlocked),
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

    this.messageListener.allMessages$
      .pipe(
        tap(async (msg: any) => {
          if (msg.command === "doneLoggingOut") {
            // TODO: PM-8544 - why do we call logout in the popup after receiving the doneLoggingOut message? Hasn't this already completeted logout?
            this.authService.logOut(async () => {
              if (msg.logoutReason) {
                await this.displayLogoutReason(msg.logoutReason);
              }
            });
            this.changeDetectorRef.detectChanges();
          } else if (msg.command === "authBlocked" || msg.command === "goHome") {
            await this.router.navigate(["login"]);
          } else if (msg.command === "locked") {
            if (msg.userId == null) {
              this.logService.error("'locked' message received without userId.");
              return;
            }

            if (msg.userId !== this.activeUserId) {
              this.logService.error(
                `'locked' message received with userId ${msg.userId} but active userId is ${this.activeUserId}.`,
              );
              return;
            }

            await this.biometricsService.setShouldAutopromptNow(false);

            // When user is locked, normally we can just send them the lock screen.
            // However, for account switching scenarios, we need to consider the TDE lock state.
            const tdeEnabled = await firstValueFrom(
              this.userDecryptionOptionsService
                .userDecryptionOptionsById$(msg.userId)
                .pipe(map((decryptionOptions) => decryptionOptions?.trustedDeviceOption != null)),
            );

            const everHadUserKey = await firstValueFrom(
              this.keyService.everHadUserKey$(msg.userId),
            );
            if (tdeEnabled && !everHadUserKey) {
              await this.router.navigate(["login-initiated"]);
              return;
            }

            await this.router.navigate(["lock"]);
          } else if (msg.command === "showDialog") {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.showDialog(msg);
          } else if (msg.command === "showNativeMessagingFingerprintDialog") {
            // TODO: Should be refactored to live in another service.
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.showNativeMessagingFingerprintDialog(msg);
          } else if (msg.command === "showUpdateDesktopAppOrDisableFingerprintDialog") {
            // TODO: Should be refactored to live in another service.
            await this.showDialog({
              title: this.i18nService.t("updateDesktopAppOrDisableFingerprintDialogTitle"),
              content: this.i18nService.t("updateDesktopAppOrDisableFingerprintDialogMessage"),
              type: "warning",
            });
          } else if (msg.command === "showToast") {
            this.toastService._showToast(msg);
          } else if (msg.command === "reloadProcess") {
            if (this.platformUtilsService.isSafari()) {
              window.setTimeout(async () => {
                await this.biometricStateService.updateLastProcessReload();
                window.location.reload();
              }, 2000);
            }
          } else if (msg.command === "reloadPopup") {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/"]);
          } else if (msg.command === "convertAccountToKeyConnector") {
            // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.router.navigate(["/remove-password"]);
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

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
          await this.cipherService.setAddEditCipherInfo(null, this.activeUserId);
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

    this.animationControlService.enableRoutingAnimation$
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.routerAnimations = state;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getRouteElevation(outlet: RouterOutlet) {
    if (!this.routerAnimations) {
      return;
    }

    return outlet.activatedRouteData.elevation;
  }

  private async recordActivity() {
    if (this.activeUserId == null) {
      return;
    }

    const now = new Date();
    if (this.lastActivity != null && now.getTime() - this.lastActivity.getTime() < 250) {
      return;
    }

    this.lastActivity = now;
    await this.accountService.setAccountActivity(this.activeUserId, now);
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
      this.vaultBrowserStateService.setBrowserGroupingsComponentState(null),
      this.vaultBrowserStateService.setBrowserVaultItemsComponentState(null),
    ]);
  }

  // Displaying toasts isn't super useful on the popup due to the reloads we do.
  // However, it is visible for a moment on the FF sidebar logout.
  private async displayLogoutReason(logoutReason: LogoutReason) {
    let toastOptions: ToastOptions | null = null;
    switch (logoutReason) {
      case "invalidSecurityStamp":
      case "sessionExpired": {
        toastOptions = {
          variant: "warning",
          title: this.i18nService.t("loggedOut"),
          message: this.i18nService.t("loginExpired"),
        };
        break;
      }
    }

    if (toastOptions == null) {
      // We don't have anything to show for this particular reason
      return;
    }

    this.toastService.showToast(toastOptions);
  }
}
