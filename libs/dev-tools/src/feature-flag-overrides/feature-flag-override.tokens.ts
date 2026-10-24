import { SafeInjectionToken } from "@bitwarden/ui-common";

/**
 * Whether the override menu is on regardless of the developer's stored choice. Supplied per
 * client, because "is this a development build" is answered differently in each.
 */
export const DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED = new SafeInjectionToken<boolean>(
  "DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED",
);

/**
 * Restarts the client so flags read outside of a `getFeatureFlag$` subscription pick up an
 * override. Supplied per client — there is no cross-client reload primitive.
 */
export const DEV_TOOLS_RELOAD_APP = new SafeInjectionToken<() => void>("DEV_TOOLS_RELOAD_APP");
