import { inject, Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CredentialGeneratorService, SitePasswordSettings } from "@bitwarden/generator-core";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { sitePasswordSettings } from "../../password-rules/site-password-settings";

@Injectable()
export class SitePasswordSettingsService {
  private readonly generatorService = inject(CredentialGeneratorService);
  private readonly logService = inject(LogService);

  /** Password settings that match the current tab's password rules, or `null` when none apply. */
  async currentTab(): Promise<SitePasswordSettings | null> {
    // only the toolbar popup closes when the user changes tabs; a pop-out, sidebar or side
    // panel would keep the rules of a site the user has left
    if (!BrowserPopupUtils.inPopup(window)) {
      return null;
    }

    try {
      const tab = await BrowserApi.getTabFromCurrentWindow();
      return await sitePasswordSettings(tab?.url, this.generatorService);
    } catch (e: unknown) {
      this.logService.error(e);
      return null;
    }
  }
}
