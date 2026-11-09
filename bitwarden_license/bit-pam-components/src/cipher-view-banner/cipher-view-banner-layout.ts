import { inject } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Where the banner lays out its actions. `dialog`, the web vault's item dialog: each action is a
 * small button inside its card, and the request form folds out in place. `popup`, the extension:
 * full-width actions inside the cards, and the request form opens in a bottom sheet.
 */
export type CipherViewBannerLayout = "dialog" | "popup";

/** The popup binds `"popup"`; unbound, the banner uses the `dialog` layout. */
export const CIPHER_VIEW_BANNER_LAYOUT = new SafeInjectionToken<CipherViewBannerLayout>(
  "CipherViewBannerLayout",
);

/** Whether the banner sits in the popup. Call in an injection context. */
export function injectPopupLayout(): boolean {
  return (inject(CIPHER_VIEW_BANNER_LAYOUT, { optional: true }) ?? "dialog") === "popup";
}
