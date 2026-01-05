import { filter, firstValueFrom, map, Observable } from "rxjs";

import { Duo2faResult, TwoFactorAuthDuoComponentService } from "@bitwarden/auth/angular";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openTwoFactorAuthDuoPopout } from "../../auth/popup/utils/auth-popout-window";
import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";

interface Message {
  command: string;
  code: string;
  state: string;
}

export class ExtensionTwoFactorAuthDuoComponentService implements TwoFactorAuthDuoComponentService {
  constructor(
    private browserMessagingApi: ZonedMessageListenerService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
  ) {}
  listenForDuo2faResult$(): Observable<Duo2faResult> {
    return this.browserMessagingApi.messageListener$().pipe(
      filter((msg): msg is Message => {
        return (msg as Message).command === "duoResult";
      }),
      map((msg: Message) => {
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

  async openTwoFactorAuthDuoPopout(): Promise<void> {
    await openTwoFactorAuthDuoPopout();
  }
}
