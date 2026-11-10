import { concatMap, filter, firstValueFrom, Observable } from "rxjs";

import { Duo2faResult, TwoFactorAuthDuoComponentService } from "@bitwarden/auth/angular";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Message } from "@bitwarden/common/platform/messaging";

// FIXME (PM-22628): Popup imports are forbidden in background
// eslint-disable-next-line no-restricted-imports
import { openTwoFactorAuthDuoPopout } from "../../auth/popup/utils/auth-popout-window";
import { ZonedMessageListenerService } from "../../platform/browser/zoned-message-listener.service";
import { isValidVaultReferrer } from "../../platform/utils/valid-vault-referrer";

type DuoResultMessage = Message<{
  code: string;
  state: string;
  /**
   * Hostname the relaying content script derived from the posting frame's origin. Absent on a
   * message that never passed through that relay.
   */
  referrer?: string;
}>;

export class ExtensionTwoFactorAuthDuoComponentService implements TwoFactorAuthDuoComponentService {
  constructor(
    private browserMessagingApi: ZonedMessageListenerService,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private logService: LogService,
  ) {}
  listenForDuo2faResult$(): Observable<Duo2faResult> {
    return this.browserMessagingApi.messageListener$().pipe(
      filter((msg): msg is DuoResultMessage => {
        return (msg as DuoResultMessage)?.command === "duoResult";
      }),
      // concatMap, not switchMap: a validation still in flight must not be cancelled by a
      // later message, or the result it was vetting is lost.
      concatMap(async (msg: DuoResultMessage) => {
        let originIsKnown = false;
        try {
          originIsKnown = await isValidVaultReferrer(this.environmentService, msg.referrer);
        } catch (e) {
          // Contain the failure: letting it reach the subscriber would terminate this stream and
          // leave the Duo screen deaf to every later result.
          this.logService.error("Could not check the origin of a duoResult message.", e);
          return undefined;
        }

        if (!originIsKnown) {
          this.logService.warning("Ignored a duoResult message from an unrecognized origin.");
          return undefined;
        }

        return {
          code: msg.code,
          state: msg.state,
          token: `${msg.code}|${msg.state}`,
        } as Duo2faResult;
      }),
      filter((result): result is Duo2faResult => result !== undefined),
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
