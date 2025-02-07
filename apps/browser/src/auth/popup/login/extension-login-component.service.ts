// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { ExtensionAnonLayoutWrapperDataService } from "../extension-anon-layout-wrapper/extension-anon-layout-wrapper-data.service";
import { firstValueFrom } from "rxjs";

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

  protected override async redirectToSso(
    email: string,
    state: string,
    codeChallenge: string,
  ): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    const redirectUri = webVaultUrl + "/sso-connector.html";

    this.platformUtilsService.launchUri(
      webVaultUrl +
        "/#/sso?clientId=" +
        this.clientType +
        "&redirectUri=" +
        encodeURIComponent(redirectUri) +
        "&state=" +
        state +
        "&codeChallenge=" +
        codeChallenge +
        "&email=" +
        encodeURIComponent(email),
    );
  }

  showBackButton(showBackButton: boolean): void {
    this.extensionAnonLayoutWrapperDataService.setAnonLayoutWrapperData({ showBackButton });
  }
}
