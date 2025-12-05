import { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from "@angular/router";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";

/**
 * Guard that forces a popout window for specific platforms.
 * Useful when popup context would close during operations (e.g., WebAuthn on Linux).
 *
 * @param platforms - Array of platform OS strings (e.g., ["linux", "mac", "win"])
 * @param forcePopout - If true, always force popout regardless of platform (useful for testing)
 * @returns CanActivateFn that opens popout and blocks navigation if conditions met
 */
export function platformPopoutGuard(
  platforms: string[],
  forcePopout: boolean = false,
): CanActivateFn {
  return async (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    // Check if current platform matches
    const platformInfo = await BrowserApi.getPlatformInfo();
    const isPlatformMatch = platforms.includes(platformInfo.os);

    // Check if already in popout/sidebar
    const inPopout = BrowserPopupUtils.inPopout(window);
    const inSidebar = BrowserPopupUtils.inSidebar(window);

    // Open popout if conditions met
    if ((isPlatformMatch || forcePopout) && !inPopout && !inSidebar) {
      // Add autoClosePopout query param to signal the popout should close after completion
      const [path, existingQuery] = state.url.split("?");
      const params = new URLSearchParams(existingQuery || "");
      params.set("autoClosePopout", "true");
      const urlWithAutoClose = `${path}?${params.toString()}`;

      // Open the popout window
      await BrowserPopupUtils.openPopout(`popup/index.html#${urlWithAutoClose}`);

      // Close the original popup window
      BrowserApi.closePopup(window);

      return false; // Block navigation - popout will reload
    }

    return true; // Allow navigation
  };
}
