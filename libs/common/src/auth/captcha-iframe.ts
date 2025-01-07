import { I18nService } from "../platform/abstractions/i18n.service";

import { IFrameComponent } from "./iframe-component";

// TODO: PM-15162 - captcha is deprecated as part of UI refresh work
export class CaptchaIFrame extends IFrameComponent {
  constructor(
    win: Window,
    webVaultUrl: string,
    private i18nService: I18nService,
    successCallback: (message: string) => any,
    errorCallback: (message: string) => any,
    infoCallback: (message: string) => any,
  ) {
    super(
      win,
      webVaultUrl,
      "captcha-connector.html",
      "hcaptcha_iframe",
      successCallback,
      errorCallback,
      (message: string) => {
        const parsedMessage = JSON.parse(message);
        if (typeof parsedMessage !== "string") {
          this.iframe.height = parsedMessage.height.toString();
          this.iframe.width = parsedMessage.width.toString();
        } else {
          infoCallback(parsedMessage);
        }
      },
    );
  }

  init(siteKey: string): void {
    super.initComponent(
      this.createParams({ siteKey: siteKey, locale: this.i18nService.translationLocale }, 1),
    );
  }
}
