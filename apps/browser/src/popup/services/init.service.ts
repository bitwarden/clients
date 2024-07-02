import { DOCUMENT } from "@angular/common";
import { Inject, Injectable } from "@angular/core";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService as LogServiceAbstraction } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/popup/browser-popup-utils";
@Injectable()
export class InitService {
  constructor(
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private stateService: StateService,
    private twoFactorService: TwoFactorService,
    private logService: LogServiceAbstraction,
    private themingService: AbstractThemingService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  init() {
    return async () => {
      await this.stateService.init({ runMigrations: false }); // Browser background is responsible for migrations
      await this.i18nService.init();
      this.twoFactorService.init();

      if (!BrowserPopupUtils.inPopup(window)) {
        window.document.body.classList.add("body-full");
      } else if (window.screen.availHeight < 600) {
        window.document.body.classList.add("body-xs");
      } else if (window.screen.availHeight <= 800) {
        window.document.body.classList.add("body-sm");
      }

      const htmlEl = window.document.documentElement;
      this.themingService.applyThemeChangesTo(this.document);
      htmlEl.classList.add("locale_" + this.i18nService.translationLocale);

      // Workaround for slow performance on external monitors on Chrome + MacOS
      // See: https://bugs.chromium.org/p/chromium/issues/detail?id=971701#c64
      if (
        this.platformUtilsService.isChrome() &&
        navigator.platform.indexOf("Mac") > -1 &&
        BrowserPopupUtils.inPopup(window) &&
        (window.screenLeft < 0 ||
          window.screenTop < 0 ||
          window.screenLeft > window.screen.width ||
          window.screenTop > window.screen.height)
      ) {
        htmlEl.classList.add("force_redraw");
        this.logService.info("Force redraw is on");
      }

      this.setupVaultPopupHeartbeat();
    };
  }

  /**
   * Sets up a runtime message listener to indicate to the background
   * script that the extension popup is open in some manner.
   */
  private setupVaultPopupHeartbeat() {
    const respondToHeartbeat = (
      message: { command: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: any) => void,
    ) => {
      if (message?.command === "checkVaultPopupHeartbeat") {
        sendResponse(true);
      }
    };

    BrowserApi.messageListener("vaultPopupHeartbeat", respondToHeartbeat);
  }
}
