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
    // Check if this is a text Send route (no file picker needed)
    if (isTextOnlySendRoute(state.url)) {
      return true; // Allow navigation without popout
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
 * Determines if the route is for a text Send that doesn't require file picker display.
 *
 * @param url The route URL with query parameters
 * @returns true if this is a Send route with explicitly text type (SendType.Text = 0)
 */
function isTextOnlySendRoute(url: string): boolean {
  // Only apply to Send routes
  if (!url.includes("/add-send") && !url.includes("/edit-send")) {
    return false;
  }

  // Parse query parameters to check Send type
  const queryStartIndex = url.indexOf("?");
  if (queryStartIndex === -1) {
    // No query params - default to requiring popout for safety
    return false;
  }

  const queryString = url.substring(queryStartIndex + 1);
  const params = new URLSearchParams(queryString);
  const typeParam = params.get("type");

  // Only skip popout for explicitly text-based Sends (SendType.Text = 0)
  // If type is missing, null, or not text, default to requiring popout
  return typeParam === String(SendType.Text);
}
