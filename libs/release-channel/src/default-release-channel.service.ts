import { Observable, distinctUntilChanged, map, of, shareReplay } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  getReleaseChannelType,
  ReleaseChannelType,
} from "@bitwarden/common/platform/misc/release-channel-type";

import { BetaStatus, ReleaseChannel, ReleaseChannelService } from "./release-channel.service";

/**
 * Reads the beta status from the `beta-channel-status` feature flag. A production build never
 * reads the flag.
 */
export class DefaultReleaseChannelService implements ReleaseChannelService {
  readonly channel$: Observable<ReleaseChannel>;

  constructor(configService: ConfigService) {
    if (getReleaseChannelType() !== ReleaseChannelType.Beta) {
      this.channel$ = of({ type: ReleaseChannelType.Production });
      return;
    }

    this.channel$ = configService.getFeatureFlag$(FeatureFlag.BetaChannelStatus).pipe(
      map(toBetaStatus),
      distinctUntilChanged(),
      map((status): ReleaseChannel => ({ type: ReleaseChannelType.Beta, status })),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}

/** Maps the flag value to a status. An unknown value means `Active`. */
function toBetaStatus(value: string): BetaStatus {
  switch (value) {
    case BetaStatus.Warning:
      return BetaStatus.Warning;
    case BetaStatus.Blocked:
      return BetaStatus.Blocked;
    default:
      return BetaStatus.Active;
  }
}
