import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  POPUP_STYLE_DISK,
} from "@bitwarden/common/platform/state";

import BrowserPopupUtils, {
  PopupWidthOption,
  PopupWidthOptions,
} from "../../browser/browser-popup-utils";

const POPUP_WIDTH_KEY_DEF = new KeyDefinition<PopupWidthOption>(POPUP_STYLE_DISK, "popup-width", {
  deserializer: (s) => s,
});

/**
 * Handles sizing the popup based on available width/height, which can be affected by
 * user default zoom level.
 * Updates the extension popup width based on a user setting.
 **/
@Injectable({ providedIn: "root" })
export class PopupSizeService {
  private static readonly LocalStorageKey = "bw-popup-width";
  private readonly state = inject(GlobalStateProvider).get(POPUP_WIDTH_KEY_DEF);

  readonly width$: Observable<PopupWidthOption> = this.state.state$.pipe(
    map((state) => state ?? "default"),
  );

  async setWidth(width: PopupWidthOption) {
    await this.state.update(() => width);
  }

  /** Begin listening for state changes */
  async init() {
    this.width$.subscribe((width: PopupWidthOption) => {
      PopupSizeService.setStyle(width);
      localStorage.setItem(PopupSizeService.LocalStorageKey, width);
    });
  }

  async setHeight() {
    const isInChromeTab = await BrowserPopupUtils.isInTab();

    /**
     * To support both browser default zoom and system default zoom, we need to take into account
     * the full screen height. When system default zoom is >100%, window.innerHeight still outputs
     * a height equivalent to what it would be at 100%, which can cause the extension window to
     * render as too tall. So if the screen height is smaller than the max possible extension height,
     * we should use that to set our extension height. Otherwise, we want to use the window.innerHeight
     * to support browser zoom.
     *
     * This is basically a workaround for what we consider a bug with browsers reporting the wrong
     * available innerHeight when system zoom is turned on. If that gets fixed, we can remove the code
     * checking the screen height.
     */
    const MAX_EXT_HEIGHT = 600;
    const extensionInnerHeight = window.innerHeight;
    // Use a 100px offset when calculating screen height to account for browser container elements
    const screenAvailHeight = window.screen.availHeight - 100;
    const availHeight =
      screenAvailHeight < MAX_EXT_HEIGHT ? screenAvailHeight : extensionInnerHeight;

    if (!BrowserPopupUtils.inPopup(window) || isInChromeTab) {
      window.document.documentElement.classList.add("body-full");
    } else if (availHeight < 300) {
      window.document.documentElement.classList.add("body-3xs");
    } else if (availHeight < 400) {
      window.document.documentElement.classList.add("body-xxs");
    } else if (availHeight < 500) {
      window.document.documentElement.classList.add("body-xs");
    } else if (availHeight < 600) {
      window.document.documentElement.classList.add("body-sm");
    }
  }

  private static setStyle(width: PopupWidthOption) {
    if (!BrowserPopupUtils.inPopup(window)) {
      return;
    }
    const pxWidth = PopupWidthOptions[width] ?? PopupWidthOptions.default;

    document.body.style.minWidth = `${pxWidth}px`;
  }

  /**
   * To keep the popup size from flickering on bootstrap, we store the width in `localStorage` so we can quickly & synchronously reference it.
   **/
  static initBodyWidthFromLocalStorage() {
    const storedValue = localStorage.getItem(PopupSizeService.LocalStorageKey);
    this.setStyle(storedValue as any);
  }
}
