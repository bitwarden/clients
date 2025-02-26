import { inject, Injectable } from "@angular/core";
import { map, Observable } from "rxjs";

import {
  GlobalStateProvider,
  KeyDefinition,
  POPUP_STYLE_DISK,
} from "@bitwarden/common/platform/state";

import BrowserPopupUtils from "../browser-popup-utils";

/**
 *
 * Value represents width in pixels
 */
export const PopupWidthOptions = Object.freeze({
  default: 380,
  wide: 480,
  "extra-wide": 600,
});

type PopupWidthOptions = typeof PopupWidthOptions;
export type PopupWidthOption = keyof PopupWidthOptions;

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

    const isInChromeTab = await BrowserPopupUtils.isInTab();

    if (!BrowserPopupUtils.inPopup(window) || isInChromeTab) {
      window.document.body.classList.add("body-full");
    } else if (window.innerHeight < 400) {
      window.document.body.classList.add("body-xxs");
    } else if (window.innerHeight < 500) {
      window.document.body.classList.add("body-xs");
    } else if (window.innerHeight < 600) {
      window.document.body.classList.add("body-sm");
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
