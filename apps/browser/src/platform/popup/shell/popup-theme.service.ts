import { inject, Injectable } from "@angular/core";

import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";

import { POPUP_THEME_STORAGE_KEY } from "../../browser/popup-view";

/**
 * Keeps a `localStorage` copy of the selected theme, as `PopupSizeService` does for the width, so
 * the popup shell can theme its first frame before the app runs (see `styleShell`). The selected
 * theme rather than the effective one, so a `system` choice still follows the OS at open time.
 */
@Injectable({ providedIn: "root" })
export class PopupThemeService {
  private readonly themeStateService = inject(ThemeStateService);

  /** Begin keeping the copy current. */
  init() {
    this.themeStateService.selectedTheme$.subscribe((theme) =>
      localStorage.setItem(POPUP_THEME_STORAGE_KEY, theme),
    );
  }
}
