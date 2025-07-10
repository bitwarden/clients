import { Type, inject } from "@angular/core";
import { Route, Routes } from "@angular/router";
import { map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { componentRouteSwap } from "../../utils/component-route-swap";

/**
 * @param defaultComponent The component to be used when the feature flag is off.
 * @param flaggedComponent The component to be used when the feature flag is on.
 * @param featureFlag The feature flag to evaluate
 * @param routeOptions The shared route options to apply to both components.
 */
type FeatureFlaggedRouteConfig = {
  defaultComponent: Type<any>;
  flaggedComponent: Type<any>;
  featureFlag: FeatureFlag;
  routeOptions: Omit<Route, "component">;
};

/**
 * Swap between two routes at runtime based on the value of a feature flag.
 * The routes share a common path and configuration but load different components.
 * @param config See {@link FeatureFlaggedRouteConfig}
 * @returns A tuple containing the conditional configuration for the two routes. This should be unpacked into your existing Routes array.
 * @example
 * const routes: Routes = [
 *   ...featureFlaggedRoute({
 *      defaultComponent: GroupsComponent,
 *      flaggedComponent: GroupsNewComponent,
 *      featureFlag: FeatureFlag.GroupsComponentRefactor,
 *      routeOptions: {
 *        path: "groups",
 *        canActivate: [OrganizationPermissionsGuard],
 *      },
 *   }),
 * ]
 */
export function featureFlaggedRoute(config: FeatureFlaggedRouteConfig): Routes {
  const canMatch$ = () =>
    inject(ConfigService)
      .getFeatureFlag$(config.featureFlag)
      .pipe(map((flagValue) => flagValue === true));

  return componentRouteSwap(
    config.defaultComponent,
    config.flaggedComponent,
    canMatch$,
    config.routeOptions,
  );
}
