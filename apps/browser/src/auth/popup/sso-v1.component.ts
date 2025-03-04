import { Component, Inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";

import { SsoComponent as BaseSsoComponent } from "@bitwarden/angular/auth/components/sso.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { BrowserApi } from "../../platform/browser/browser-api";

@Component({
  selector: "app-sso",
  templateUrl: "sso-v1.component.html",
})
export class SsoComponentV1 extends BaseSsoComponent {
  constructor(
    ssoLoginService: SsoLoginServiceAbstraction,
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    route: ActivatedRoute,
    stateService: StateService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    cryptoFunctionService: CryptoFunctionService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    syncService: SyncService,
    environmentService: EnvironmentService,
    logService: LogService,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    configService: ConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    private authService: AuthService,
    @Inject(WINDOW) private win: Window,
    toastService: ToastService,
  ) {
    super(
      ssoLoginService,
      loginStrategyService,
      router,
      i18nService,
      route,
      stateService,
      platformUtilsService,
      apiService,
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      logService,
      userDecryptionOptionsService,
      configService,
      masterPasswordService,
      accountService,
      toastService,
    );

    environmentService.environment$.pipe(takeUntilDestroyed()).subscribe((env) => {
      this.redirectUri = env.getWebVaultUrl() + "/sso-connector.html";
    });
    this.clientId = "browser";

    this.onSuccessfulLogin = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      syncService.fullSync(true);

      // If the vault is unlocked then this will clear keys from memory, which we don't want to do
      if ((await this.authService.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
        BrowserApi.reloadOpenWindows();
      }

      this.win.close();
    };

    this.onSuccessfulLoginTde = async () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      syncService.fullSync(true);
    };

    this.onSuccessfulLoginTdeNavigate = async () => {
      this.win.close();
    };
  }
}
