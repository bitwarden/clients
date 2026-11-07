import { Observable, defer, of } from "rxjs";

import { AvailableRegionsService } from "../abstractions/available-regions.service";
import { EnvironmentService, RegionConfig } from "../abstractions/environment.service";

export class DefaultAvailableRegionsService implements AvailableRegionsService {
  readonly availableRegions$: Observable<RegionConfig[]>;

  constructor(private environmentService: EnvironmentService) {
    this.availableRegions$ = defer(() => of(this.environmentService.availableRegions()));
  }
}
