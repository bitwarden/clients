import { inject, Type } from "@angular/core";
import { Route, Router, Routes, UrlTree } from "@angular/router";

import { componentRouteSwap } from "@bitwarden/angular/utils/component-route-swap";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

/**
 * Helper function to swap between two components based on the ExtensionRefresh feature flag.
 * @param defaultComponent - The current non-refreshed component to render.
 * @param refreshedComponent - The new refreshed component to render.
 * @param options - The shared route options to apply to both components.
 */
export function extensionRefreshSwap(
  defaultComponent: Type<any>,
  refreshedComponent: Type<any>,
  options: Route,
): Routes {
  return componentRouteSwap(
    defaultComponent,
    refreshedComponent,
    async () => {
      const configService = inject(ConfigService);
      return configService.getFeatureFlag(FeatureFlag.ExtensionRefresh);
    },
    options,
  );
}

/**
 * Helper function to swap between two components based on the UnauthenticatedExtensionUIRefresh feature flag.
 * We need this because the auth teams's authenticated UI will be refreshed as part of the MVP but the
 * unauthenticated UIs will not necessarily make the cut.
 * @param defaultComponent - The current non-refreshed component to render.
 * @param refreshedComponent - The new refreshed component to render.
 * @param options - The shared route options to apply to both components.
 */
export function unauthExtensionRefreshSwap(
  defaultComponent: Type<any>,
  refreshedComponent: Type<any>,
  options: Route,
): Routes {
  return componentRouteSwap(
    defaultComponent,
    refreshedComponent,
    async () => {
      const configService = inject(ConfigService);
      return configService.getFeatureFlag(FeatureFlag.UnauthenticatedExtensionUIRefresh);
    },
    options,
  );
}

/**
 * Helper function to redirect to a new URL based on the ExtensionRefresh feature flag.
 * @param redirectUrl - The URL to redirect to if the ExtensionRefresh flag is enabled.
 */
export function extensionRefreshRedirect(redirectUrl: string): () => Promise<boolean | UrlTree> {
  return async () => {
    const configService = inject(ConfigService);
    const router = inject(Router);
    const shouldRedirect = await configService.getFeatureFlag(FeatureFlag.ExtensionRefresh);
    if (shouldRedirect) {
      return router.parseUrl(redirectUrl);
    } else {
      return true;
    }
  };
}
