import { Type, inject } from "@angular/core";
import { Route, Routes } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { componentRouteSwap } from "../../utils/component-route-swap";

/**
 * Helper function to swap between two components based on the UnauthenticatedExtensionUIRefresh feature flag.
 * We need this because the auth teams's authenticated UI will be refreshed as part of the MVP but the
 * unauthenticated UIs will not necessarily make the cut.
 * Note: Even though this is primarily an extension refresh initiative, this will be used across clients
 * as we are consolidating the unauthenticated UIs into single libs/auth components which affects all clients.
 * @param defaultComponent - The current non-refreshed component to render.
 * @param refreshedComponent - The new refreshed component to render.
 * @param options - The shared route options to apply to both components.
 * @param altOptions - The alt route options to apply to the alt component. If not provided, the base options will be used.
 */
export function unauthUiRefreshSwap(
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
      return configService.getFeatureFlag(FeatureFlag.UnauthenticatedExtensionUIRefresh);
    },
    options,
    altOptions,
  );
}
