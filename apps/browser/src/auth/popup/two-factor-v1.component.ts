// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, Subscription, firstValueFrom } from "rxjs";
import { filter, first, takeUntil } from "rxjs/operators";

import { TwoFactorComponentV1 as BaseTwoFactorComponent } from "@bitwarden/angular/auth/components/two-factor-v1.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

import { BrowserApi } from "../../platform/browser/browser-api";
import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";

import { closeTwoFactorAuthWebAuthnPopout } from "./utils/auth-popout-window";

@Component({
  selector: "app-two-factor",
  templateUrl: "two-factor-v1.component.html",
})
export class TwoFactorComponentV1 extends BaseTwoFactorComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  inPopout = BrowserPopupUtils.inPopout(window);

  constructor(
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    private syncService: SyncService,
    environmentService: EnvironmentService,
    stateService: StateService,
    route: ActivatedRoute,
    private messagingService: MessagingService,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    loginEmailService: LoginEmailServiceAbstraction,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    configService: ConfigService,
    ssoLoginService: SsoLoginServiceAbstraction,
    private dialogService: DialogService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    toastService: ToastService,
    @Inject(WINDOW) protected win: Window,
    private browserMessagingApi: ZonedMessageListenerService,
  ) {
    super(
      loginStrategyService,
      router,
      i18nService,
      apiService,
      platformUtilsService,
      win,
      environmentService,
      stateService,
      route,
      logService,
      twoFactorService,
      appIdService,
      loginEmailService,
      userDecryptionOptionsService,
      ssoLoginService,
      configService,
      masterPasswordService,
      accountService,
      toastService,
    );
    this.onSuccessfulLogin = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      syncService.fullSync(true);
    };

    this.onSuccessfulLoginTde = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      syncService.fullSync(true);
    };

    this.onSuccessfulLoginTdeNavigate = async () => {
      this.win.close();
    };

    this.successRoute = "/tabs/vault";
    // FIXME: Chromium 110 has broken WebAuthn support in extensions via an iframe
    this.webAuthnNewTab = true;
  }

  async ngOnInit() {
    if (this.route.snapshot.paramMap.has("webAuthnResponse")) {
      // WebAuthn fallback response
      this.selectedProviderType = TwoFactorProviderType.WebAuthn;
      this.token = this.route.snapshot.paramMap.get("webAuthnResponse");
      this.onSuccessfulLogin = async () => {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.syncService.fullSync(true);
        this.messagingService.send("reloadPopup");
        window.close();
      };
      this.remember = this.route.snapshot.paramMap.get("remember") === "true";
      await this.doSubmit();
      return;
    }

    await super.ngOnInit();
    if (this.selectedProviderType == null) {
      return;
    }

    // WebAuthn prompt appears inside the popup on linux, and requires a larger popup width
    // than usual to avoid cutting off the dialog.
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && (await this.isLinux())) {
      document.body.classList.add("linux-webauthn");
    }

    if (
      this.selectedProviderType === TwoFactorProviderType.Email &&
      BrowserPopupUtils.inPopup(window)
    ) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "popup2faCloseMessage" },
        type: "warning",
      });
      if (confirmed) {
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        BrowserPopupUtils.openCurrentPagePopout(window);
      }
    }

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.sso === "true") {
        this.onSuccessfulLogin = async () => {
          // This is not awaited so we don't pause the application while the sync is happening.
          // This call is executed by the service that lives in the background script so it will continue
          // the sync even if this tab closes.
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.syncService.fullSync(true);

          // Force sidebars (FF && Opera) to reload while exempting current window
          // because we are just going to close the current window.
          BrowserApi.reloadOpenWindows(true);

          // We don't need this window anymore because the intent is for the user to be left
          // on the web vault screen which tells them to continue in the browser extension (sidebar or popup)
          await closeTwoFactorAuthWebAuthnPopout();
        };
      }
    });
  }

  async ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && (await this.isLinux())) {
      document.body.classList.remove("linux-webauthn");
    }
    super.ngOnDestroy();
  }

  anotherMethod() {
    const sso = this.route.snapshot.queryParamMap.get("sso") === "true";

    if (sso) {
      // We must persist this so when the user returns to the 2FA comp, the
      // proper onSuccessfulLogin logic is executed.
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["2fa-options"], { queryParams: { sso: true } });
    } else {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["2fa-options"]);
    }
  }

  async popoutCurrentPage() {
    await BrowserPopupUtils.openCurrentPagePopout(window);
  }

  async isLinux() {
    return (await BrowserApi.getPlatformInfo()).os === "linux";
  }

  duoResultSubscription: Subscription;
  protected override setupDuoResultListener() {
    if (!this.duoResultSubscription) {
      this.duoResultSubscription = this.browserMessagingApi
        .messageListener$()
        .pipe(
          filter((msg: any) => msg.command === "duoResult"),
          takeUntil(this.destroy$),
        )
        .subscribe((msg: { command: string; code: string; state: string }) => {
          this.token = msg.code + "|" + msg.state;
          // This floating promise is intentional. We don't need to await the submit + awaiting in a subscription is not recommended.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.submit();
        });
    }
  }

  override async launchDuoFrameless() {
    if (this.duoFramelessUrl === null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("duoHealthCheckResultsInNullAuthUrlError"),
      });
      return;
    }

    const duoHandOffMessage = {
      title: this.i18nService.t("youSuccessfullyLoggedIn"),
      message: this.i18nService.t("youMayCloseThisWindow"),
      isCountdown: false,
    };

    // we're using the connector here as a way to set a cookie with translations
    // before continuing to the duo frameless url
    const env = await firstValueFrom(this.environmentService.environment$);
    const launchUrl =
      env.getWebVaultUrl() +
      "/duo-redirect-connector.html" +
      "?duoFramelessUrl=" +
      encodeURIComponent(this.duoFramelessUrl) +
      "&handOffMessage=" +
      encodeURIComponent(JSON.stringify(duoHandOffMessage));
    this.platformUtilsService.launchUri(launchUrl);
  }
}
