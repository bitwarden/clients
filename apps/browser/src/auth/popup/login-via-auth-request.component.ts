import { Location } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { LoginViaAuthRequestComponent as BaseLoginWithDeviceComponent } from "@bitwarden/angular/auth/components/login-via-auth-request.component";
import {
  AuthRequestServiceAbstraction,
  LoginStrategyServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AnonymousHubService } from "@bitwarden/common/auth/abstractions/anonymous-hub.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

@Component({
  selector: "app-login-via-auth-request",
  templateUrl: "login-via-auth-request.component.html",
})
export class LoginViaAuthRequestComponent
  extends BaseLoginWithDeviceComponent
  implements OnInit, OnDestroy
{
  constructor(
    router: Router,
    cryptoService: CryptoService,
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
    stateService: StateService,
    loginService: LoginService,
    syncService: SyncService,
    deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    authRequestService: AuthRequestServiceAbstraction,
    loginStrategyService: LoginStrategyServiceAbstraction,
    private location: Location,
  ) {
    super(
      router,
      cryptoService,
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
      stateService,
      loginService,
      deviceTrustCryptoService,
      authRequestService,
      loginStrategyService,
    );
    super.onSuccessfulLogin = async () => {
      await syncService.fullSync(true);
    };
  }

  protected back() {
    this.location.back();
  }
}
