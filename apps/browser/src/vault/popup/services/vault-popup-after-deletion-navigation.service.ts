import { Location } from "@angular/common";
import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import { PopupRouterCacheService } from "../../../platform/popup/view-cache/popup-router-cache.service";

import { VaultPopupScrollPositionService } from "./vault-popup-scroll-position.service";

/**
 * Available routes to navigate to after deleting a cipher.
 * Useful when the user could be coming from a different view other than the main vault (e.g., archive).
 */
export const ROUTES_AFTER_EDIT_DELETION = Object.freeze({
  tabsVault: "/tabs/vault",
  archive: "/archive",
} as const);

export type ROUTES_AFTER_EDIT_DELETION =
  (typeof ROUTES_AFTER_EDIT_DELETION)[keyof typeof ROUTES_AFTER_EDIT_DELETION];

/**
 * Service that handles navigation after a cipher is deleted.
 *
 * When the deletion target route is somewhere other than the default vault tab,
 * this service walks back through the popup history to find it (preserving the
 * browser-extension back-button behaviour). If the route is not found in
 * history it falls back to a normal `Router.navigate`.
 */
@Injectable({
  providedIn: "root",
})
export class VaultPopupAfterDeletionNavigationService {
  private router = inject(Router);
  private location = inject(Location);
  private popupRouterCacheService = inject(PopupRouterCacheService);
  private scrollPositionService = inject(VaultPopupScrollPositionService);
  private platformUtilsService = inject(PlatformUtilsService);

  /**
   * Navigate to the appropriate route after a cipher has been deleted.
   * Resets the vault scroll position on non-Firefox browsers to prevent
   * auto-scrolling to a stale position. Firefox is excluded because eagerly
   * clearing scroll state triggers its native scroll restoration, causing
   * unwanted scroll behavior.
   *
   * @param routeAfterDeletion - The target route to navigate to. Defaults to the main vault tab.
   */
  async navigateAfterDeletion(
    routeAfterDeletion: ROUTES_AFTER_EDIT_DELETION = ROUTES_AFTER_EDIT_DELETION.tabsVault,
  ): Promise<void> {
    if (!this.platformUtilsService.isFirefox()) {
      this.scrollPositionService.stop(true);
    }

    if (routeAfterDeletion !== ROUTES_AFTER_EDIT_DELETION.tabsVault) {
      const history = await firstValueFrom(this.popupRouterCacheService.history$());
      const targetIndex = history.map((h) => h.url).lastIndexOf(routeAfterDeletion);

      if (targetIndex !== -1) {
        const stepsBack = targetIndex - (history.length - 1);
        // Use historyGo to navigate back to the target route in history.
        // This allows downstream calls to `back()` to continue working as expected.
        this.location.historyGo(stepsBack);
        return;
      }

      await this.router.navigate([routeAfterDeletion]);
      return;
    }

    await this.router.navigate([routeAfterDeletion]);
  }
}
