import { DOCUMENT } from "@angular/common";
import { inject, Inject, Injectable } from "@angular/core";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService as LogServiceAbstraction } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { MigrationRunner } from "@bitwarden/common/platform/services/migration-runner";

import { BrowserApi } from "../../platform/browser/browser-api";
import BrowserPopupUtils from "../../platform/browser/browser-popup-utils";
import { PopupSizeService } from "../../platform/popup/layout/popup-size.service";
import { PopupViewCacheService } from "../../platform/popup/view-cache/popup-view-cache.service";

@Injectable()
export class InitService {
  private sizeService = inject(PopupSizeService);

  constructor(
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private stateService: StateService,
    private twoFactorService: TwoFactorService,
    private logService: LogServiceAbstraction,
    private themingService: AbstractThemingService,
    private sdkLoadService: SdkLoadService,
    private viewCacheService: PopupViewCacheService,
    private readonly migrationRunner: MigrationRunner,
    private configService: ConfigService,
    private encryptService: EncryptService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  init() {
    return async () => {
      await this.sdkLoadService.loadAndInit();
      await this.migrationRunner.waitForCompletion(); // Browser background is responsible for migrations
      await this.i18nService.init();
      this.twoFactorService.init();
      await this.viewCacheService.init();
      await this.sizeService.init();
      this.encryptService.init(this.configService);

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
