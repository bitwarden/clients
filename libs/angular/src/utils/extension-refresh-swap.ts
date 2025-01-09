import { Type, inject } from "@angular/core";
import { Route, Routes } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { componentRouteSwap } from "./component-route-swap";

/**
 * Helper function to swap between two components based on the ExtensionRefresh feature flag.
 * @param defaultComponent - The current non-refreshed component to render.
 * @param refreshedComponent - The new refreshed component to render.
 * @param options - The shared route options to apply to the default component, and to the alt component if altOptions is not provided.
 * @param altOptions - The alt route options to apply to the alt component.
 */
export function extensionRefreshSwap(
  defaultComponent: Type<any>,
  refreshedComponent: Type<any>,
  options: Route,
  altOptions?: Route,
): Routes {
  return componentRouteSwap(
    defaultComponent,
    refreshedComponent,
    async () => {
      const configService = inject(ConfigService);
      return configService.getFeatureFlag(FeatureFlag.ExtensionRefresh);
    },
    options,
    altOptions,
  );
}
