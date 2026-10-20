import { APP_INITIALIZER } from "@angular/core";

import { DialogService } from "@bitwarden/components";
import { StateProvider } from "@bitwarden/state";
import { safeProvider, SafeInjectionToken, SafeProvider } from "@bitwarden/ui-common";

import { DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED } from "./feature-flag-override.tokens";
import { FeatureFlagOverrideMenuService } from "./services/feature-flag-override-menu.service";

/**
 * Providers for the feature flag override menu. Each client spreads these into its services module
 * and supplies {@link DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED} and `DEV_TOOLS_RELOAD_APP`.
 */
export const FeatureFlagOverrideProviders: SafeProvider[] = [
  safeProvider({
    provide: FeatureFlagOverrideMenuService,
    deps: [StateProvider, DialogService, DEFAULT_FEATURE_FLAG_OVERRIDE_MENU_ENABLED],
  }),
  safeProvider({
    provide: APP_INITIALIZER as SafeInjectionToken<() => void>,
    useFactory: (menuService: FeatureFlagOverrideMenuService) => () =>
      menuService.installGlobalHook(),
    deps: [FeatureFlagOverrideMenuService],
    multi: true,
  }),
];
