import { Component, Inject, OnDestroy, ViewChild, ViewContainerRef } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { TwoFactorComponent as BaseTwoFactorComponent } from "@bitwarden/angular/auth/components/two-factor.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  LoginStrategyServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { TwoFactorOptionsComponent } from "./two-factor-options.component";

@Component({
  selector: "app-two-factor",
  templateUrl: "two-factor.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorComponent extends BaseTwoFactorComponent implements OnDestroy {
  @ViewChild("twoFactorOptions", { read: ViewContainerRef, static: true })
  twoFactorOptionsModal: ViewContainerRef;

  constructor(
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    stateService: StateService,
    environmentService: EnvironmentService,
    private modalService: ModalService,
    route: ActivatedRoute,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    loginService: LoginService,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    configService: ConfigService,
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
      loginService,
      userDecryptionOptionsService,
      ssoLoginService,
      configService,
    );
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
  }

  async anotherMethod() {
    const [modal] = await this.modalService.openViewRef(
      TwoFactorOptionsComponent,
      this.twoFactorOptionsModal,
      (comp) => {
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onProviderSelected.subscribe(async (provider: TwoFactorProviderType) => {
          modal.close();
          this.selectedProviderType = provider;
          await this.init();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil
        comp.onRecoverSelected.subscribe(() => {
          modal.close();
        });
      },
    );
  }

  protected override handleMigrateEncryptionKey(result: AuthResult): boolean {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["migrate-legacy-encryption"]);
    return true;
  }

  goAfterLogIn = async () => {
    this.loginService.clearValues();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([this.successRoute], {
      queryParams: {
        identifier: this.orgIdentifier,
      },
    });
  };

  private duoResultChannel: BroadcastChannel;

  protected override setupDuoResultListener() {
    if (!this.duoResultChannel) {
      this.duoResultChannel = new BroadcastChannel("duoResult");
      this.duoResultChannel.addEventListener("message", this.handleDuoResultMessage);
    }
  }

  private handleDuoResultMessage = async (msg: { data: { code: string; state: string } }) => {
    this.token = msg.data.code + "|" + msg.data.state;
    await this.submit();
  };

  override async launchDuoFrameless() {
    const duoHandOffMessage = {
      title: this.i18nService.t("youSuccessfullyLoggedIn"),
      message: this.i18nService.t("thisWindowWillCloseIn5Seconds"),
      buttonText: this.i18nService.t("close"),
      isCountdown: true,
    };
    document.cookie = `duoHandOffMessage=${JSON.stringify(duoHandOffMessage)}; SameSite=strict;`;
    this.platformUtilsService.launchUri(this.duoFramelessUrl);
  }

  async ngOnDestroy() {
    super.ngOnDestroy();

    if (this.duoResultChannel) {
      // clean up duo listener if it was initialized.
      this.duoResultChannel.removeEventListener("message", this.handleDuoResultMessage);
      this.duoResultChannel.close();
    }
  }
}
