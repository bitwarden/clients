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
 * @param flaggedRouteProviders Optional providers scoped only to the flagged route. Use this to
 * register services that should only be instantiated when the feature flag is on.
 * @param defaultRouteProviders Optional providers scoped only to the default route. Use this to
 * register services that should only be instantiated when the feature flag is off.
 */
type FeatureFlaggedRouteConfig = {
  defaultComponent: Type<any>;
  flaggedComponent: Type<any>;
  featureFlag: FeatureFlag;
  routeOptions: Omit<Route, "component">;
  flaggedRouteProviders?: NonNullable<Route["providers"]>;
  defaultRouteProviders?: NonNullable<Route["providers"]>;
};

/**
 * Swap between two routes at runtime based on the value of a feature flag.
 * The routes share a common path and configuration but load different components.
 * @param config See {@link FeatureFlaggedRouteConfig}
 * @returns A tuple containing the conditional configuration for the two routes. This should be unpacked into your existing Routes array.
 * @example
 * // Basic usage — shared route options, no scoped providers:
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
 *
 * @example
 * // Scoped providers — each route only instantiates the services it needs:
 * const routes: Routes = [
 *   ...featureFlaggedRoute({
 *      defaultComponent: GroupsComponent,
 *      flaggedComponent: GroupsNewComponent,
 *      featureFlag: FeatureFlag.GroupsComponentRefactor,
 *      routeOptions: {
 *        path: "groups",
 *        canActivate: [OrganizationPermissionsGuard],
 *      },
 *      defaultRouteProviders: [
 *        // Only instantiated when the feature flag is OFF
 *        safeProvider({ provide: LegacyGroupsService, useClass: LegacyGroupsService, deps: [...] }),
 *      ],
 *      flaggedRouteProviders: [
 *        // Only instantiated when the feature flag is ON
 *        safeProvider({ provide: GroupsService, useClass: GroupsService, deps: [...] }),
 *      ],
 *   }),
 * ]
 */
export function featureFlaggedRoute(config: FeatureFlaggedRouteConfig): Routes {
  const canMatch$ = () =>
    inject(ConfigService)
      .getFeatureFlag$(config.featureFlag)
      .pipe(map((flagValue) => flagValue === true));

  const defaultRouteOptions = config.defaultRouteProviders
    ? { ...config.routeOptions, providers: config.defaultRouteProviders }
    : config.routeOptions;

  // When defaultRouteProviders is set, defaultRouteOptions carries those providers as part of
  // `options` passed to componentRouteSwap. Without an explicit flaggedRouteOptions, componentRouteSwap
  // would fall back to `options` for the flagged route, unintentionally inheriting the default
  // route's providers. Passing config.routeOptions directly avoids that.
  const flaggedRouteOptions: Route | undefined = config.flaggedRouteProviders
    ? { ...config.routeOptions, providers: config.flaggedRouteProviders }
    : config.defaultRouteProviders
      ? config.routeOptions
      : undefined;

  return componentRouteSwap(
    config.defaultComponent,
    config.flaggedComponent,
    canMatch$,
    defaultRouteOptions,
    flaggedRouteOptions,
  );
}
