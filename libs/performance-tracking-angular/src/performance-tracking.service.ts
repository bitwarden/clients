import { Injectable } from "@angular/core";

import { DefaultPerformanceTrackingService } from "@bitwarden/performance-tracking";

/**
 * `DefaultPerformanceTrackingService` as an Angular provider.
 */
@Injectable({ providedIn: "root" })
export class PerformanceTrackingAngularService extends DefaultPerformanceTrackingService {}
