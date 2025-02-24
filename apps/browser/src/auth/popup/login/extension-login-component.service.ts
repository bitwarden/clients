// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { SsoUrlService } from "@bitwarden/auth/common";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

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
    private ssoUrlService: SsoUrlService,
  ) {
    super(
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      platformUtilsService,
      ssoLoginService,
    );
  }

  /**
   * On the extension, redirecting to the SSO login page is done via a new browser window, opened
   * to the SSO component on the web client.
   * @param email the email of the user trying to log in, used to look up the org SSO identifier
   * @param state the state that will be used to verify the SSO login, which needs to be passed to the IdP
   * @param codeChallenge the challenge that will be verified after the code is returned from the IdP, which needs to be passed to the IdP
   */
  protected override async redirectToSso(
    email: string,
    state: string,
    codeChallenge: string,
  ): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    const redirectUri = webVaultUrl + "/sso-connector.html";

    const webAppSsoUrl = this.ssoUrlService.buildSsoUrl(
      webVaultUrl,
      this.clientType,
      redirectUri,
      state,
      codeChallenge,
      email,
    );

    this.platformUtilsService.launchUri(webAppSsoUrl);
  }

  showBackButton(showBackButton: boolean): void {
    this.extensionAnonLayoutWrapperDataService.setAnonLayoutWrapperData({ showBackButton });
  }
}
