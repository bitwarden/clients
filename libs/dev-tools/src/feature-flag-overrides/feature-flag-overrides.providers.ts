import { APP_INITIALIZER } from "@angular/core";

import { StateProvider } from "@bitwarden/state";
import { safeProvider, SafeInjectionToken, SafeProvider } from "@bitwarden/ui-common";

import { FeatureFlagOverrideMenuService } from "./services/feature-flag-override-menu.service";
import { FeatureFlagOverrideService } from "./services/feature-flag-override.service";

/**
 * Whether the override menu is on when the developer has made no explicit choice. Supplied per
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

/**
 * Providers for the feature flag override menu. Each client spreads these into its services module
 * and supplies {@link DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED} and {@link DEV_TOOLS_RELOAD_APP}.
 */
export const FeatureFlagOverrideProviders: SafeProvider[] = [
  safeProvider({
    provide: FeatureFlagOverrideService,
    deps: [StateProvider],
  }),
  safeProvider({
    provide: FeatureFlagOverrideMenuService,
    deps: [StateProvider, DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED],
  }),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
    useFactory: (menuService: FeatureFlagOverrideMenuService) => () =>
      menuService.installGlobalHook(),
    deps: [FeatureFlagOverrideMenuService],
    multi: true,
  }),
];
