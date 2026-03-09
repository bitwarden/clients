import { Injectable } from "@angular/core";

import { FlightRecorder } from "@bitwarden/logging";

/**
 * Angular wrapper for FlightRecorder.
 * Extends the framework-agnostic FlightRecorder class
 * and adds Angular dependency injection capability.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderService extends FlightRecorder {
  // Inherits all methods from FlightRecorder
}
