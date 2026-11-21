import { inject, Injectable } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { LogService } from "@bitwarden/logging";
import { Endpoint, enableFlightRecorderForwarding } from "@bitwarden/sdk-internal";

/**
 * Sends this context's flight recorder events to the context that collects them for the client,
 * e.g. from the browser popup to the background.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderForwardingService {
  private readonly configService = inject(ConfigService);
  private readonly ipcService = inject(IpcService);
  private readonly logService = inject(LogService);

  /**
   * Starts forwarding to `collector` when the flight recorder flag is on. Events captured before
   * this call are forwarded too. Call after `IpcService.init()` resolves.
   */
  async enable(collector: Endpoint): Promise<void> {
    try {
      if (!(await this.configService.getFeatureFlag(FeatureFlag.PM30935_FlightRecorderTsLogging))) {
        return;
      }
      enableFlightRecorderForwarding(this.ipcService.client, collector);
    } catch (e) {
      this.logService.error("[FlightRecorder] Failed to enable forwarding", e);
    }
  }
}
