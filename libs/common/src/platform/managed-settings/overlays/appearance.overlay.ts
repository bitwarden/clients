import { Theme, ThemeTypes } from "../../enums/theme-type.enum";
import { LOCALE_KEY } from "../../services/i18n.service";
import { THEME_SELECTION } from "../../theming/theme-state.service";

import { defineScalarOverlay, enumLeaf, stringLeaf } from "./scalar.overlay";

/** Register managed overlays for the cross-client appearance keys (theme, locale). Idempotent. */
export function registerAppearanceOverlay(): void {
  const themes: readonly Theme[] = [ThemeTypes.System, ThemeTypes.Light, ThemeTypes.Dark];
  defineScalarOverlay(THEME_SELECTION, "theming.selection", enumLeaf(themes));
  defineScalarOverlay(LOCALE_KEY, "translation.locale", stringLeaf);
}
