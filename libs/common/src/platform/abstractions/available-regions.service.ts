import { Observable } from "rxjs";

import { RegionConfig } from "./environment.service";

/**
 * UI display source for available cloud regions
 *
 * For URL resolution, origin validation, or stored-region rehydration
 * (anything that must succeed regardless of business logic like runtime
 * conditionals or feature flags), call EnvironmentService.availableRegions()
 * directly instead.
 */
export abstract class AvailableRegionsService {
  abstract availableRegions$: Observable<RegionConfig[]>;
}
