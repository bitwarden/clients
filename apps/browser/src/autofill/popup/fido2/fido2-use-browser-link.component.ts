// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { animate, state, style, transition, trigger } from "@angular/animations";
import { A11yModule } from "@angular/cdk/a11y";
import { ConnectedPosition, CdkOverlayOrigin, CdkConnectedOverlay } from "@angular/cdk/overlay";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { NeverDomains } from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { fido2PopoutSessionData$ } from "../../../vault/popup/utils/fido2-popout-session-data";
import { BrowserFido2UserInterfaceSession } from "../../fido2/services/browser-fido2-user-interface.service";

@Component({
  selector: "app-fido2-use-browser-link",
  templateUrl: "fido2-use-browser-link.component.html",
  imports: [A11yModule, CdkConnectedOverlay, CdkOverlayOrigin, CommonModule, JslibModule],
  animations: [
    trigger("transformPanel", [
      state(
        "void",
        style({
          opacity: 0,
        }),
      ),
      transition(
        "void => open",
        animate(
          "100ms linear",
          style({
            opacity: 1,
          }),
        ),
      ),
      transition("* => void", animate("100ms linear", style({ opacity: 0 }))),
    ]),
  ],
})
export class Fido2UseBrowserLinkComponent {
  showOverlay = false;
  isOpen = false;
  overlayPosition: ConnectedPosition[] = [
    {
      originX: "start",
      originY: "bottom",
      overlayX: "start",
      overlayY: "top",
      offsetY: 5,
    },
  ];

  protected fido2PopoutSessionData$ = fido2PopoutSessionData$();

  constructor(
    private domainSettingsService: DomainSettingsService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
  ) {}

  toggle() {
    this.isOpen = !this.isOpen;
  }

  close() {
    this.isOpen = false;
  }

  /**
   * Aborts the current FIDO2 session and fallsback to the browser.
   * @param excludeDomain - Identifies if the domain should be excluded from future FIDO2 prompts.
   */
  protected async abort(excludeDomain = true) {
    this.close();
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
      null,
      this.i18nService.t("domainAddedToExcludedDomains", validDomain),
    );
  }

  private abortSession(sessionId: string) {
    BrowserFido2UserInterfaceSession.abortPopout(sessionId, true);
  }
}
