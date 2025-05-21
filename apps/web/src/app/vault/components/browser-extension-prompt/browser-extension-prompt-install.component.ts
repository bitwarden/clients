import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { map } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "../../services/browser-extension-prompt.service";

/** Device specific Urls for the extension  */
const WebStoreUrls: Partial<Record<DeviceType, string>> = {
  [DeviceType.ChromeBrowser]:
    "https://chrome.google.com/webstore/detail/bitwarden-password-manage/nngceckbapebfimnlniiiahkandclblb",
  [DeviceType.FirefoxBrowser]:
    "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/",
  [DeviceType.SafariBrowser]: "https://apps.apple.com/us/app/bitwarden/id1352778147?mt=12",
  [DeviceType.OperaBrowser]:
    "https://addons.opera.com/extensions/details/bitwarden-free-password-manager/",
  [DeviceType.EdgeBrowser]:
    "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
};

@Component({
  selector: "vault-browser-extension-prompt-install",
  templateUrl: "./browser-extension-prompt-install.component.html",
  standalone: true,
  imports: [CommonModule, I18nPipe, LinkModule],
})
export class BrowserExtensionPromptInstallComponent implements OnInit {
  /** The install link should only show for the error states */
  protected shouldShow$ = this.browserExtensionPromptService.pageState$.pipe(
    map((state) => state === BrowserPromptState.Error || state === BrowserPromptState.ManualOpen),
  );

  /** All available page states */
  protected BrowserPromptState = BrowserPromptState;

  /**
   * Installation link for the extension
   */
  protected webStoreUrl: string = "https://bitwarden.com/download/#downloads-web-browser";

  constructor(
    private browserExtensionPromptService: BrowserExtensionPromptService,
    private platformService: PlatformUtilsService,
  ) {}

  ngOnInit(): void {
    this.setBrowserStoreLink();
  }

  /** If available, set web store specific URL for the extension */
  private setBrowserStoreLink(): void {
    const deviceType = this.platformService.getDevice();
    const platformSpecificUrl = WebStoreUrls[deviceType];

    if (platformSpecificUrl) {
      this.webStoreUrl = platformSpecificUrl;
    }
  }
}
