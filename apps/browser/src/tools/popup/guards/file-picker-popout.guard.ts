import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";

import { BrowserApi } from "@bitwarden/browser/platform/browser/browser-api";
import BrowserPopupUtils from "@bitwarden/browser/platform/browser/browser-popup-utils";
import { BrowserPlatformUtilsService } from "@bitwarden/browser/platform/services/platform-utils/browser-platform-utils.service";
import { DeviceType } from "@bitwarden/common/enums";
import { SendType } from "@bitwarden/common/tools/send/types/send-type";

/**
 * Composite guard that handles file picker popout requirements for all browsers.
 * Forces a popout window when file pickers could be exposed on browsers that require it.
 *
 * Browser-specific requirements:
 * - Firefox: Requires sidebar OR popout (crashes with file picker in popup: https://bugzilla.mozilla.org/show_bug.cgi?id=1292701)
 * - Safari: Requires popout only
 * - All Chromium browsers (Chrome, Edge, Opera, Vivaldi) on Linux/Mac: Requires sidebar OR popout
 * - Chromium on Windows: No special requirement
 *
 * Send-specific behavior:
 * - Text Sends: No popout required (no file picker needed)
 * - File Sends: Popout required on affected browsers
 *
 * @returns CanActivateFn that opens popout and blocks navigation when file picker access is needed
 */
export function filePickerPopoutGuard(): CanActivateFn {
  return async (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    // Text Sends have no file picker — never require a popout regardless of browser
    if (isTextSendRoute(state.url)) {
      return true;
    }

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

    // Chromium on Linux/Mac: needs sidebar OR popout for file picker access
    // All Chromium-based browsers (Chrome, Edge, Opera, Vivaldi)
    // Brave intentionally reports itself as Chrome for compatibility
    const isChromiumBased = [
      DeviceType.ChromeExtension,
      DeviceType.EdgeExtension,
      DeviceType.OperaExtension,
      DeviceType.VivaldiExtension,
    ].includes(deviceType);

    const isLinux = window?.navigator?.userAgent?.includes("Linux");
    const isMac = window?.navigator?.userAgent?.includes("Mac OS X");

    if (isChromiumBased && (isLinux || isMac) && !inPopout && !inSidebar) {
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

/**
 * Returns true when the add-send route targets a Text Send (type=0).
 * Text Sends have no file picker and never require a popout window.
 */
function isTextSendRoute(url: string): boolean {
  if (!url.includes("/add-send")) {
    return false;
  }
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return false;
  }
  return new URLSearchParams(url.substring(queryStart + 1)).get("type") === String(SendType.Text);
}
