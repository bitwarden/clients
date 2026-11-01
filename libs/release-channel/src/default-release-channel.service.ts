import { Observable, distinctUntilChanged, map, of, shareReplay } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { isBetaChannel } from "./is-beta-channel";
import {
  BetaChannelStatus,
  BetaClientAccess,
  ReleaseChannelService,
} from "./release-channel.service";

/**
 * Reads the beta channel status from the `beta-channel-status` feature flag.
 *
 * The flag fails open: only an explicit `closing` or `closed` changes the channel, and anything
 * else, including a missing key, reports `Open`. The status
 * follows `ConfigService.getFeatureFlag$`, so before a server config loads it reports the default,
 * `Open`, and an offline launch uses the cached config.
 */
export class DefaultReleaseChannelService implements ReleaseChannelService {
  readonly betaChannelStatus$: Observable<BetaChannelStatus>;
  readonly betaClientAccess$: Observable<BetaClientAccess>;

  constructor(configService: ConfigService) {
    this.betaChannelStatus$ = configService
      .getFeatureFlag$(FeatureFlag.BetaChannelStatus)
      .pipe(
        map(toBetaChannelStatus),
        distinctUntilChanged(),
        shareReplay({ bufferSize: 1, refCount: true }),
      );

    this.betaClientAccess$ = isBetaChannel()
      ? this.betaChannelStatus$.pipe(map(toBetaClientAccess))
      : of(BetaClientAccess.Allowed);
  }
}

/** Maps the flag value to a status. Only exactly `closing` or `closed` changes the channel. */
function toBetaChannelStatus(value: unknown): BetaChannelStatus {
  switch (value) {
    case BetaChannelStatus.Closing:
      return BetaChannelStatus.Closing;
    case BetaChannelStatus.Closed:
      return BetaChannelStatus.Closed;
    default:
      return BetaChannelStatus.Open;
  }
}

function toBetaClientAccess(status: BetaChannelStatus): BetaClientAccess {
  switch (status) {
    case BetaChannelStatus.Open:
      return BetaClientAccess.Allowed;
    case BetaChannelStatus.Closing:
      return BetaClientAccess.Warning;
    case BetaChannelStatus.Closed:
      return BetaClientAccess.Blocked;
  }
}
