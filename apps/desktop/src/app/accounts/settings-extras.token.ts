import { Type } from "@angular/core";

import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * The shape of a settings extra. The dialog binds no inputs to it, so any component instance
 * qualifies; naming the type keeps the token from collapsing to `unknown` where it is injected.
 */
export type DesktopSettingsExtra = object;

/**
 * Standalone components a build adds to the settings dialog's app preferences tab, shown above the
 * theme field in provided order. Each brings its own state and form control. Unprovided, the
 * dialog is unchanged.
 */
export const DESKTOP_SETTINGS_EXTRAS = new SafeInjectionToken<Type<DesktopSettingsExtra>[]>(
  "DesktopSettingsExtras",
);
