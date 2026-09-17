import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/logging";
import { DefaultPerformanceTrackingService } from "@bitwarden/performance-tracking";

/**
 * `DefaultPerformanceTrackingService` with its debug sink wired to `LogService`.
 */
@Injectable({ providedIn: "root" })
export class PerformanceTrackingAngularService extends DefaultPerformanceTrackingService {
  constructor(logService: LogService) {
    super((message?: any, ...optionalParams: any[]) =>
      logService.debug(message, ...optionalParams),
    );
  }
}
