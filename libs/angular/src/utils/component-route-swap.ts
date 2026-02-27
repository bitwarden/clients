import { Type } from "@angular/core";
import { CanMatchFn, Route, Routes } from "@angular/router";

/**
 * Helper function to swap between two components based on an async condition. The async condition is evaluated
 * as an `CanMatchFn` and supports Angular dependency injection via `inject()`.
 *
 * @example
 * ```ts
 * const routes = [
 *  ...componentRouteSwap(
 *     defaultComponent,
 *     altComponent,
 *     async () => {
 *       const configService = inject(ConfigService);
 *       return configService.getFeatureFlag(FeatureFlag.SomeFlag);
 *     },
 *     {
 *      path: 'some-path'
 *     }
 *   ),
 *   // Other routes...
 *  ];
 *  ```
 *
 * @param defaultComponent - The default component to render.
 * @param altComponent - The alternate component to render when the condition is met.
 * @param shouldSwapFn - The async function to determine if the alternate component should be rendered.
 * @param options - The shared route options to apply to the default component, and to the alt component if altOptions is not provided.
 * @param altOptions - The alt route options to apply to the alt component.
 */
export function componentRouteSwap(
  defaultComponent: Type<any>,
  altComponent: Type<any>,
  shouldSwapFn: CanMatchFn,
  options: Route,
  altOptions?: Route,
): Routes {
  const defaultRoute = {
    ...options,
    component: defaultComponent,
  };

  const selectedAltOptions = altOptions ?? options;

  const altRoute: Route = {
    ...selectedAltOptions,
    component: altComponent,
    canMatch: [shouldSwapFn, ...(selectedAltOptions.canMatch ?? [])],
  };

  // Return the alternate route first, so it is evaluated first.
  return [altRoute, defaultRoute];
}
