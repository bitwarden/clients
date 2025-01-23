import { Location } from "@angular/common";
import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { LoginViaAuthRequestComponentV1 as BaseLoginViaAuthRequestComponentV1 } from "@bitwarden/angular/auth/components/login-via-auth-request-v1.component";
import {
  AuthRequestServiceAbstraction,
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AnonymousHubService } from "@bitwarden/common/auth/abstractions/anonymous-hub.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KeyService } from "@bitwarden/key-management";

@Component({
  selector: "app-login-via-auth-request",
  templateUrl: "login-via-auth-request-v1.component.html",
})
export class LoginViaAuthRequestComponentV1 extends BaseLoginViaAuthRequestComponentV1 {
  constructor(
    router: Router,
    keyService: KeyService,
    cryptoFunctionService: CryptoFunctionService,
    appIdService: AppIdService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    apiService: ApiService,
    authService: AuthService,
    logService: LogService,
    environmentService: EnvironmentService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    anonymousHubService: AnonymousHubService,
    validationService: ValidationService,
    loginEmailService: LoginEmailServiceAbstraction,
    syncService: SyncService,
    deviceTrustService: DeviceTrustServiceAbstraction,
    authRequestService: AuthRequestServiceAbstraction,
    loginStrategyService: LoginStrategyServiceAbstraction,
    accountService: AccountService,
    private location: Location,
    toastService: ToastService,
  ) {
    super(
      router,
      keyService,
      cryptoFunctionService,
      appIdService,
      passwordGenerationService,
      apiService,
      authService,
      logService,
      environmentService,
      i18nService,
      platformUtilsService,
      anonymousHubService,
      validationService,
      accountService,
      loginEmailService,
      deviceTrustService,
      authRequestService,
      loginStrategyService,
      toastService,
    );
    this.onSuccessfulLogin = async () => {
      await syncService.fullSync(true);
    };
  }

  protected back() {
    this.location.back();
  }
}
