import { Injectable } from "@angular/core";

import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { FlightRecorderLogRecorder } from "@bitwarden/logging";
import { FlightRecorderClient } from "@bitwarden/sdk-internal";

/**
 * Angular wrapper for {@link FlightRecorderLogRecorder}.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderLogRecorderService extends FlightRecorderLogRecorder {
  constructor() {
    super(SdkLoadService.Ready.then(() => new FlightRecorderClient()));
  }
}
