import { firstValueFrom, map, Observable } from "rxjs";

import { TwoFactorAuthDuoComponentService, Duo2faResult } from "@bitwarden/auth/angular";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";

// TODO: PM-16209 We should create a Duo2faMessageListenerService that listens for messages from duo
// and this command definition should move to that file.
// We should explore consolidating the messaging approach across clients - i.e., we
// should use the same command definition across all clients. We use duoResult on extension for no real
// benefit.
export const DUO_2FA_RESULT_COMMAND = new CommandDefinition<{ code: string; state: string }>(
  "duoCallback",
);

export class DesktopTwoFactorAuthDuoComponentService implements TwoFactorAuthDuoComponentService {
  constructor(
    private messageListener: MessageListener,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
  ) {}
  listenForDuo2faResult$(): Observable<Duo2faResult> {
    return this.messageListener.messages$(DUO_2FA_RESULT_COMMAND).pipe(
      map((msg) => {
        return {
          code: msg.code,
          state: msg.state,
          token: `${msg.code}|${msg.state}`,
        } as Duo2faResult;
      }),
    );
  }

  async launchDuoFrameless(duoFramelessUrl: string): Promise<void> {
    const duoHandOffMessage = {
      title: this.i18nService.t("youSuccessfullyLoggedIn"),
      message: this.i18nService.t("youMayCloseThisWindow"),
      isCountdown: false,
    };

    // we're using the connector here as a way to set a cookie with translations
    // before continuing to the duo frameless url
    const env = await firstValueFrom(this.environmentService.environment$);
    const launchUrl =
      env.getWebVaultUrl() +
      "/duo-redirect-connector.html" +
      "?duoFramelessUrl=" +
      encodeURIComponent(duoFramelessUrl) +
      "&handOffMessage=" +
      encodeURIComponent(JSON.stringify(duoHandOffMessage));
    this.platformUtilsService.launchUri(launchUrl);
  }
}
