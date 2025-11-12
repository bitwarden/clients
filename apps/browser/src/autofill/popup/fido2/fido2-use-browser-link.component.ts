import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { MenuModule } from "@bitwarden/components";

import { fido2PopoutSessionData$ } from "../../../vault/popup/utils/fido2-popout-session-data";
import { BrowserFido2UserInterfaceSession } from "../../fido2/services/browser-fido2-user-interface.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-fido2-use-browser-link",
  templateUrl: "fido2-use-browser-link.component.html",
  imports: [CommonModule, JslibModule, MenuModule],
})
export class Fido2UseBrowserLinkComponent {
  showOverlay = false;

  protected fido2PopoutSessionData$ = fido2PopoutSessionData$();

  constructor(
    private readonly domainSettingsService: DomainSettingsService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly i18nService: I18nService,
  ) {}

  /**
   * Aborts the current FIDO2 session and fallsback to the browser.
   * @param excludeDomain - Identifies if the domain should be excluded from future FIDO2 prompts.
   */
  protected async abort(excludeDomain = true) {
    const sessionData = await firstValueFrom(this.fido2PopoutSessionData$);

    if (!excludeDomain) {
      this.abortSession(sessionData.sessionId);
      return;
    }
    // Show overlay to prevent the user from interacting with the page.
    this.showOverlay = true;
    await this.handleDomainExclusion(sessionData.senderUrl);
    // Give the user a chance to see the toast before closing the popout.
    await Utils.delay(2000);
    this.abortSession(sessionData.sessionId);
  }

  /**
   * Excludes the domain from future FIDO2 prompts.
   * @param uri - The domain uri to exclude from future FIDO2 prompts.
   */
  private async handleDomainExclusion(uri: string) {
    const existingDomains = await firstValueFrom(this.domainSettingsService.neverDomains$);

    const validDomain = Utils.getHostname(uri);
    const savedDomains: NeverDomains = {
      ...existingDomains,
    };
    savedDomains[validDomain] = null;

    await this.domainSettingsService.setNeverDomains(savedDomains);

    this.platformUtilsService.showToast(
      "success",
      "",
      this.i18nService.t("domainAddedToExcludedDomains", validDomain),
    );
  }

  private abortSession(sessionId: string) {
    BrowserFido2UserInterfaceSession.abortPopout(sessionId, true);
  }
}
