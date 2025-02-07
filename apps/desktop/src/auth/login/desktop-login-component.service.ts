// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
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
    // For platforms that cannot support a protocol-based (e.g. bitwarden://) callback, we use a localhost callback
    // Otherwise, we launch the SSO component in a browser window and wait for the callback
    if (ipc.platform.isAppImage || ipc.platform.isSnapStore || ipc.platform.isDev) {
      await this.initiateSsoThroughLocalhostCallback(email, state, codeChallenge);
    } else {
      const env = await firstValueFrom(this.environmentService.environment$);
      const webVaultUrl = env.getWebVaultUrl();

      const redirectUri = "bitwarden://sso-callback";

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
  }

  private async initiateSsoThroughLocalhostCallback(
    email: string,
    state: string,
    challenge: string,
  ): Promise<void> {
    try {
      await ipc.platform.localhostCallbackService.openSsoPrompt(challenge, state);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("ssoError"),
      });
    }
  }
}
