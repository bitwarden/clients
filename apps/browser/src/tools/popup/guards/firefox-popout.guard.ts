import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";

import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
import BrowserPopupUtils from "@bitwarden/browser/platform/browser/browser-popup-utils";
import { BrowserPlatformUtilsService } from "@bitwarden/browser/platform/services/platform-utils/browser-platform-utils.service";
import { DeviceType } from "@bitwarden/common/enums";

/**
 * Guard that forces a popout window on Firefox browser when a file picker could be exposed.
 * Necessary to avoid a crash: https://bugzilla.mozilla.org/show_bug.cgi?id=1292701
 * Also disallows the user from closing a popout and re-opening the view exposing the file picker.
 *
 * @returns CanActivateFn that opens popout and blocks navigation on Firefox
 */
export function firefoxPopoutGuard(): CanActivateFn {
  return async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    // Check if browser is Firefox using the platform utils service
    const deviceType = BrowserPlatformUtilsService.getDevice(window);
    const isFirefox = deviceType === DeviceType.FirefoxExtension;

    // Check if already in popout/sidebar
    const inPopout = BrowserPopupUtils.inPopout(window);
    const inSidebar = BrowserPopupUtils.inSidebar(window);

    // Open popout if on Firefox and not already in popout/sidebar
    if (isFirefox && !inPopout && !inSidebar) {
      // Don't add autoClosePopout for file picker scenarios - user should manually close
      await BrowserPopupUtils.openPopout(`popup/index.html#${state.url}`);

      // Close the original popup window
      BrowserApi.closePopup(window);

      return false; // Block navigation - popout will reload
    }

    return true; // Allow navigation
  };
}
