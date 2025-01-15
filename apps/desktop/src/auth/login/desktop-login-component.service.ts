// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Injectable } from "@angular/core";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
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

  override async launchSsoBrowserWindow(email: string, clientId: "desktop"): Promise<void | null> {
    if (!ipc.platform.isAppImage && !ipc.platform.isSnapStore && !ipc.platform.isDev) {
      return super.launchSsoBrowserWindow(email, clientId);
    }

    // Save email for SSO
    await this.ssoLoginService.setSsoEmail(email);

    // Generate SSO params
    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };

    const state = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(codeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    // Save SSO params
    await this.ssoLoginService.setSsoState(state);
    await this.ssoLoginService.setCodeVerifier(codeVerifier);

    try {
      await ipc.platform.localhostCallbackService.openSsoPrompt(codeChallenge, state);
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
