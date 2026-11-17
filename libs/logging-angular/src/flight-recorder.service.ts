import { inject, Injectable } from "@angular/core";

import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { FlightRecorder } from "@bitwarden/logging";

/** Process label for events produced by this client's Angular context. */
function angularContextProcess(clientType: ClientType | undefined): string | undefined {
  switch (clientType) {
    case ClientType.Browser:
      return "browser-popup";
    case ClientType.Desktop:
      return "desktop-renderer";
    case ClientType.Web:
      return "web";
    default:
      return undefined;
  }
}

/**
 * Angular wrapper for {@link FlightRecorder}.
 *
 * Provides the flight recorder as an injectable service, wiring it
 * to {@link SdkLoadService.Ready} automatically.
 */
@Injectable({ providedIn: "root" })
export class FlightRecorderService extends FlightRecorder {
  constructor() {
    super(
      SdkLoadService.Ready,
      // Optional so consumers' tests need not provide it. Without it, local events stay unlabeled.
      angularContextProcess(inject(PlatformUtilsService, { optional: true })?.getClientType()),
    );
  }
}
