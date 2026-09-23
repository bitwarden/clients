import { Observable } from "rxjs";

import { AnonLayoutWrapperData } from "./anon-layout-wrapper.component";

/**
 * A simple data service to allow any child components of the AnonLayoutWrapperComponent to override
 * page route data and dynamically control the data fed into the AnonLayoutComponent via the AnonLayoutWrapperComponent.
 */
export abstract class AnonLayoutWrapperDataService {
  /**
   *
   * @param data - The data to set on the AnonLayoutWrapperComponent to feed into the AnonLayoutComponent.
   */
  abstract setAnonLayoutWrapperData(data: Partial<AnonLayoutWrapperData>): void;

  /**
   * Reactively gets the current AnonLayoutWrapperData.
   */
  abstract anonLayoutWrapperData$(): Observable<Partial<AnonLayoutWrapperData>>;

  /**
   * Caches the route-data payload so that `resetToCachedRouteData()` can later restore it.
   * Called by the wrapper components (`AnonLayoutWrapperComponent`,
   * `ExtensionAnonLayoutWrapperComponent`) when they apply route data. Does not emit.
   */
  abstract cacheRouteData(data: Partial<AnonLayoutWrapperData>): void;

  /**
   * Re-emits the most recently cached route-data payload through `anonLayoutWrapperData$()`,
   * undoing any subsequent imperative overrides applied via `setAnonLayoutWrapperData()`.
   *
   * Components with intra-route state transitions that imperatively override layout state
   * can call this to roll back to the original route-declared fields (while spreading
   * defaults for any fields the route omitted).
   */
  abstract resetToCachedRouteData(): void;
}
