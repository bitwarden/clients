// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { DESKTOP_SSO_CALLBACK, SsoUrlService } from "@bitwarden/auth/common";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

@Injectable()
export class DesktopLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected i18nService: I18nService,
    protected toastService: ToastService,
    protected ssoUrlService: SsoUrlService,
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
   * On the desktop, redirecting to the SSO login page is done via a new browser window, opened
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
    // For platforms that cannot support a protocol-based (e.g. bitwarden://) callback, we use a localhost callback
    // Otherwise, we launch the SSO component in a browser window and wait for the callback
    if (ipc.platform.isAppImage || ipc.platform.isDev) {
      await this.initiateSsoThroughLocalhostCallback(email, state, codeChallenge);
    } else {
      const env = await firstValueFrom(this.environmentService.environment$);
      const webVaultUrl = env.getWebVaultUrl();

      const redirectUri = DESKTOP_SSO_CALLBACK;

      const ssoWebAppUrl = this.ssoUrlService.buildSsoUrl(
        webVaultUrl,
        this.clientType,
        redirectUri,
        state,
        codeChallenge,
        email,
      );

      this.platformUtilsService.launchUri(ssoWebAppUrl);
    }
  }

  private async initiateSsoThroughLocalhostCallback(
    email: string,
    state: string,
    challenge: string,
  ): Promise<void> {
    try {
      await ipc.platform.localhostCallbackService.openSsoPrompt(challenge, state, email);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("ssoError"),
      });
    }
  }
}
