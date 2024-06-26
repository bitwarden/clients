import { Type, inject } from "@angular/core";
import { Route, Routes } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { componentRouteSwap } from "./component-route-swap";
/**
 * Helper function to swap between two components based on the TwoFactorComponentRefactor feature flag.
 * @param defaultComponent - The current non-refactored component to render.
 * @param refreshedComponent - The new refactored component to render.
 * @param defaultOptions - The options to apply to the default component and the refactored component, if alt options are not provided.
 * @param altOptions - The options to apply to the refactored component.
 */
export function twofactorRefactorSwap(
  defaultComponent: Type<any>,
  refreshedComponent: Type<any>,
  defaultOptions: Route,
  altOptions?: Route,
): Routes {
  return componentRouteSwap(
    defaultComponent,
    refreshedComponent,
    async () => {
      const configService = inject(ConfigService);
      return configService.getFeatureFlag(FeatureFlag.TwoFactorComponentRefactor);
    },
    defaultOptions,
    altOptions,
  );
}
