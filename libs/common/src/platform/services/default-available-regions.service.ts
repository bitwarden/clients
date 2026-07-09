import { Observable, map, startWith } from "rxjs";

import { FeatureFlag } from "../../enums/feature-flag.enum";
import { AvailableRegionsService } from "../abstractions/available-regions.service";
import { ConfigService } from "../abstractions/config/config.service";
import { EnvironmentService, Region, RegionConfig } from "../abstractions/environment.service";

export class DefaultAvailableRegionsService implements AvailableRegionsService {
  readonly availableRegions$: Observable<RegionConfig[]>;

  constructor(
    private environmentService: EnvironmentService,
    private configService: ConfigService,
  ) {
    this.availableRegions$ = this.configService.getFeatureFlag$(FeatureFlag.FedRampGovRegion).pipe(
      startWith(false),
      map((govEnabled) =>
        this.environmentService
          .availableRegions()
          .filter((r) => r.key !== Region.Gov || govEnabled),
      ),
    );
  }
}
