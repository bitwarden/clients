import { inject } from "@angular/core";

import { DefaultLoginComponentService, LoginComponentService } from "@bitwarden/auth/angular";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ToastService } from "@bitwarden/components";

export class DesktopLoginComponentService
  extends DefaultLoginComponentService
  implements LoginComponentService
{
  i18nService = inject(I18nService);
  toastService = inject(ToastService);

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
    } catch (err) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("ssoError"),
      });
    }
  }
}
