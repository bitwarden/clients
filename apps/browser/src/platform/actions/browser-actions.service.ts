import { DeviceType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ActionsService } from "@bitwarden/common/platform/actions/actions-service";
import { LogService } from "@bitwarden/logging";

import { SafariApp } from "../../browser/safariApp";
import { BrowserApi } from "../browser/browser-api";

export class BrowserActionsService implements ActionsService {
  constructor(
    private logService: LogService,
    private platformUtilsService: PlatformUtilsService,
  ) {}

  async openPopup(): Promise<void> {
    const deviceType = this.platformUtilsService.getDevice();

    try {
      switch (deviceType) {
        case DeviceType.FirefoxExtension:
        case DeviceType.ChromeExtension: {
          const browserAction = BrowserApi.getBrowserAction();

          if ("openPopup" in browserAction && typeof browserAction.openPopup === "function") {
            await browserAction.openPopup();
            return;
          } else {
            this.logService.warning(
              `No openPopup function found on browser actions. On browser: ${DeviceType[deviceType]} and manifest version: ${BrowserApi.manifestVersion}`,
            );
          }
          break;
        }
        case DeviceType.SafariExtension:
          await SafariApp.sendMessageToApp("showPopover", null, true);
          return;
        default:
          this.logService.warning(
            `Tried to open the popup from an unsupported device type: ${DeviceType[deviceType]}`,
          );
      }
    } catch (e) {
      this.logService.error(
        `Failed to open the popup on ${DeviceType[deviceType]} with manifest ${BrowserApi.manifestVersion} and error: ${e}`,
      );
    }
  }
}
