import { Injectable } from "@angular/core";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { flagEnabled } from "../../../platform/flags";
import { ExtensionAnonLayoutWrapperDataService } from "../extension-anon-layout-wrapper/extension-anon-layout-wrapper-data.service";

@Injectable()
export class ExtensionLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  constructor(
    cryptoFunctionService: CryptoFunctionService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    ssoLoginService: SsoLoginServiceAbstraction,
    private extensionAnonLayoutWrapperDataService: ExtensionAnonLayoutWrapperDataService,
  ) {
    super(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
    this.clientType = this.platformUtilsService.getClientType();
  }

  isLoginViaAuthRequestSupported(): boolean {
    return flagEnabled("showPasswordless");
  }

  showBackButton(showBackButton: boolean): void {
    this.extensionAnonLayoutWrapperDataService.setAnonLayoutWrapperData({ showBackButton });
  }
}
