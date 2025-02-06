// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, NgZone, OnDestroy, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { TwoFactorComponentV1 as BaseTwoFactorComponent } from "@bitwarden/angular/auth/components/two-factor-v1.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { ModalService } from "@bitwarden/angular/services/modal.service";
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
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";

import { TwoFactorOptionsComponentV1 } from "./two-factor-options-v1.component";

const BroadcasterSubscriptionId = "TwoFactorComponent";

@Component({
  selector: "app-two-factor",
  templateUrl: "two-factor-v1.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorComponentV1 extends BaseTwoFactorComponent implements OnDestroy {
  @ViewChild("twoFactorOptions", { read: ViewContainerRef, static: true })
  twoFactorOptionsModal: ViewContainerRef;

  showingModal = false;
  duoCallbackSubscriptionEnabled: boolean = false;

  constructor(
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    syncService: SyncService,
    environmentService: EnvironmentService,
    private broadcasterService: BroadcasterService,
    private modalService: ModalService,
    stateService: StateService,
    private ngZone: NgZone,
    route: ActivatedRoute,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    loginEmailService: LoginEmailServiceAbstraction,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    configService: ConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    toastService: ToastService,
    @Inject(WINDOW) protected win: Window,
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
  }

  async anotherMethod() {
    const [modal, childComponent] = await this.modalService.openViewRef(
      TwoFactorOptionsComponentV1,
      this.twoFactorOptionsModal,
    );

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    modal.onShown.subscribe(() => {
      this.showingModal = true;
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    modal.onClosed.subscribe(() => {
      this.showingModal = false;
    });

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    childComponent.onProviderSelected.subscribe(async (provider: TwoFactorProviderType) => {
      modal.close();
      this.selectedProviderType = provider;
      await this.init();
    });
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    childComponent.onRecoverSelected.subscribe(() => {
      modal.close();
    });
  }

  async submit() {
    await super.submit();
    if (this.captchaSiteKey) {
      const content = document.getElementById("content") as HTMLDivElement;
      content.setAttribute("style", "width:335px");
    }
  }

  protected override setupDuoResultListener() {
    if (!this.duoCallbackSubscriptionEnabled) {
      this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
        await this.ngZone.run(async () => {
          if (message.command === "duoCallback") {
            this.token = message.code + "|" + message.state;
            await this.submit();
          }
        });
      });
      this.duoCallbackSubscriptionEnabled = true;
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

  ngOnDestroy(): void {
    if (this.duoCallbackSubscriptionEnabled) {
      this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
      this.duoCallbackSubscriptionEnabled = false;
    }
  }
}
