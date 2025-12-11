import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";

import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
import BrowserPopupUtils from "@bitwarden/browser/platform/browser/browser-popup-utils";
import { BrowserPlatformUtilsService } from "@bitwarden/browser/platform/services/platform-utils/browser-platform-utils.service";
import { DeviceType } from "@bitwarden/common/enums";

/**
 * Composite guard that handles file picker popout requirements for all browsers.
 * Forces a popout window when file pickers could be exposed on browsers that require it.
 *
 * Browser-specific requirements:
 * - Firefox: Requires sidebar OR popout (crashes with file picker in popup: https://bugzilla.mozilla.org/show_bug.cgi?id=1292701)
 * - Safari: Requires popout only
 * - Chromium on Linux/Mac: Requires sidebar OR popout
 * - Chromium on Windows: No special requirement
 *
 * @returns CanActivateFn that opens popout and blocks navigation when file picker access is needed
 */
export function filePickerPopoutGuard(): CanActivateFn {
  return async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    // Check if browser is one that needs popout for file pickers
    const deviceType = BrowserPlatformUtilsService.getDevice(window);

    // Check current context
    const inPopout = BrowserPopupUtils.inPopout(window);
    const inSidebar = BrowserPopupUtils.inSidebar(window);

    let needsPopout = false;

    // Firefox: needs sidebar OR popout to avoid crash with file picker
    if (deviceType === DeviceType.FirefoxExtension && !inPopout && !inSidebar) {
      needsPopout = true;
    }

    // Safari: needs popout only (sidebar not available)
    if (deviceType === DeviceType.SafariExtension && !inPopout) {
      needsPopout = true;
    }

    // Chromium on Linux: needs sidebar OR popout for file picker access
    // All Chromium-based browsers (Chrome, Edge, Opera, Vivaldi) on Linux
    const isChromiumBased = [
      DeviceType.ChromeExtension,
      DeviceType.EdgeExtension,
      DeviceType.OperaExtension,
      DeviceType.VivaldiExtension,
    ].includes(deviceType);

    const isLinux = window?.navigator?.userAgent?.indexOf("Linux") !== -1;

    if (isChromiumBased && isLinux && !inPopout && !inSidebar) {
      needsPopout = true;
    }

    // Chrome (specifically) on Mac: needs sidebar OR popout for file picker access
    const isMac =
      deviceType === DeviceType.ChromeExtension &&
      window?.navigator?.appVersion.includes("Mac OS X");

    if (isMac && !inPopout && !inSidebar) {
      needsPopout = true;
    }

    // Open popout if needed
    if (needsPopout) {
      // Don't add autoClosePopout for file picker scenarios - user should manually close
      await BrowserPopupUtils.openPopout(`popup/index.html#${state.url}`);

      // Close the original popup window
      BrowserApi.closePopup(window);

      return false; // Block navigation - popout will reload
    }

    return true; // Allow navigation
  };
}
