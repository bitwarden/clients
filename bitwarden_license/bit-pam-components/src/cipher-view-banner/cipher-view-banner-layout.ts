import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Where the banner lays out its actions. `dialog`, the web vault's item dialog: each action inside
 * its card, and the request form folds out in place. `popup`, the extension: Request access above
 * the cards, and the request form opens in a bottom sheet.
 */
export type CipherViewBannerLayout = "dialog" | "popup";

/** The popup binds `"popup"`; unbound, the banner uses the `dialog` layout. */
export const CIPHER_VIEW_BANNER_LAYOUT = new SafeInjectionToken<CipherViewBannerLayout>(
  "CipherViewBannerLayout",
);
